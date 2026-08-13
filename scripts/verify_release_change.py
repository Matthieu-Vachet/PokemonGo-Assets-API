#!/usr/bin/env python3
import json
import os
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT, text=True, stderr=subprocess.DEVNULL).strip()


def file_at(reference, filename):
    try:
        return git("show", f"{reference}:{filename}")
    except subprocess.CalledProcessError:
        return None


def resolve_base():
    requested = os.environ.get("RELEASE_GUARD_BASE")
    if requested and not re.fullmatch(r"0+", requested):
        try:
            git("cat-file", "-e", f"{requested}^{{commit}}")
            return requested
        except subprocess.CalledProcessError:
            pass
    try:
        return git("rev-parse", "HEAD^")
    except subprocess.CalledProcessError:
        return None


def main():
    version = json.loads((ROOT / "version.json").read_text())
    changelog = (ROOT / "CHANGELOG.md").read_text()
    errors = []
    if not re.fullmatch(r"\d+\.\d+\.\d+", version.get("version", "")):
        errors.append("version doit respecter SemVer")
    if not re.fullmatch(r"\d{4}\.\d{2}\.\d{2}\.\d+", version.get("assetVersion", "")):
        errors.append("assetVersion doit respecter YYYY.MM.DD.N")
    if not re.search(rf"^## {re.escape(version['version'])} - ", changelog, re.MULTILINE):
        errors.append("CHANGELOG.md doit contenir la version courante")
    base = resolve_base()
    if base:
        changed = [value for value in git("diff", "--name-only", f"{base}..HEAD").splitlines() if value]
        ignored = re.compile(r"^(?:\.github/|scripts/|CHANGELOG\.md$|VERSIONING\.md$|version\.json$|.*\.md$)")
        relevant = [filename for filename in changed if not ignored.match(filename)]
        previous_text = file_at(base, "version.json")
        if relevant and previous_text:
            previous = json.loads(previous_text)
            if previous.get("version") == version.get("version"):
                errors.append("version doit changer pour une modification d’assets")
            if previous.get("assetVersion") == version.get("assetVersion"):
                errors.append("assetVersion doit changer pour une modification d’assets")
            if file_at(base, "CHANGELOG.md") == changelog.strip():
                errors.append("CHANGELOG.md doit décrire la release")
        print(f"Release guard: {len(relevant)} fichier(s) d’assets concerné(s).")
    if errors:
        raise SystemExit("Release guard:\n- " + "\n- ".join(errors))
    print(f"Version Assets alignée : {version['version']} / {version['assetVersion']}")


if __name__ == "__main__":
    main()
