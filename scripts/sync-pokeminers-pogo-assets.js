#!/usr/bin/env node

const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const repoRoot = path.resolve(__dirname, "..");
const downloadUrl =
  process.env.POKEMINERS_POGO_ASSETS_ZIP_URL ||
  "https://github.com/PokeMiners/pogo_assets/archive/refs/heads/master.zip";
const targetDir = path.join(repoRoot, "PokeMiners-pogo_assets");
const cacheDir = path.join(repoRoot, ".pokeminers-cache");
const zipFile = path.join(cacheDir, "pogo_assets-master.zip");
const extractDir = path.join(cacheDir, "extract");

function run(command, args, options = {}) {
  return childProcess.execFileSync(command, args, {
    cwd: options.cwd || repoRoot,
    stdio: options.stdio || "pipe",
    encoding: options.encoding || "utf8",
  });
}

function commandExists(command) {
  try {
    run("which", [command]);
    return true;
  } catch {
    return false;
  }
}

function rm(directory) {
  fs.rmSync(directory, { recursive: true, force: true });
}

function mkdir(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

function listFiles(directory, predicate, results = []) {
  if (!fs.existsSync(directory)) return results;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) listFiles(fullPath, predicate, results);
    else if (predicate(fullPath)) results.push(fullPath);
  }
  return results;
}

function downloadArchive() {
  mkdir(cacheDir);
  rm(zipFile);
  console.log(`[pokeminers] téléchargement ${downloadUrl}`);
  run("curl", ["-L", "--fail", "--silent", "--show-error", "-o", zipFile, downloadUrl], {
    stdio: "inherit",
  });
}

function extractZip() {
  rm(extractDir);
  mkdir(extractDir);
  console.log("[pokeminers] extraction zip");
  try {
    run("unzip", ["-q", zipFile, "-d", extractDir], { stdio: "inherit" });
  } catch (error) {
    const fallback = commandExists("ditto") ? "ditto" : commandExists("bsdtar") ? "bsdtar" : null;
    if (!fallback) throw error;

    rm(extractDir);
    mkdir(extractDir);
    console.warn(`[pokeminers] unzip a échoué, nouvelle tentative avec ${fallback}`);
    if (fallback === "ditto") {
      run("ditto", ["-x", "-k", zipFile, extractDir], { stdio: "inherit" });
    } else {
      run("bsdtar", ["-xf", zipFile, "-C", extractDir], { stdio: "inherit" });
    }
  }
  const children = fs
    .readdirSync(extractDir)
    .map((entry) => path.join(extractDir, entry))
    .filter((entry) => fs.statSync(entry).isDirectory());
  if (!children.length) throw new Error("Archive PokeMiners vide ou invalide.");
  rm(targetDir);
  fs.renameSync(children[0], targetDir);
}

function extractRarWithAvailableTool(archive) {
  const destination = path.join(path.dirname(archive), path.basename(archive, path.extname(archive)));
  mkdir(destination);

  if (commandExists("unar")) {
    run("unar", ["-quiet", "-force-overwrite", "-o", destination, archive], { stdio: "inherit" });
    return true;
  }
  if (commandExists("unrar")) {
    run("unrar", ["x", "-o+", archive, destination], { stdio: "inherit" });
    return true;
  }
  if (commandExists("7z")) {
    run("7z", ["x", "-y", `-o${destination}`, archive], { stdio: "inherit" });
    return true;
  }
  if (commandExists("bsdtar")) {
    run("bsdtar", ["-xf", archive, "-C", destination], { stdio: "inherit" });
    return true;
  }

  return false;
}

function extractRarArchives() {
  const rarFiles = listFiles(targetDir, (file) => /\.rar$/i.test(file));
  if (!rarFiles.length) {
    console.log("[pokeminers] aucun fichier rar à extraire");
    return;
  }

  console.log(`[pokeminers] ${rarFiles.length} fichier(s) rar détecté(s)`);
  for (const archive of rarFiles) {
    console.log(`[pokeminers] extraction rar ${path.relative(repoRoot, archive)}`);
    const ok = extractRarWithAvailableTool(archive);
    if (!ok) {
      throw new Error(
        `Impossible d'extraire ${archive}. Installe unar, unrar ou 7z sur la machine qui lance l'automatisation.`,
      );
    }
  }
}

function writeManifest() {
  const manifest = {
    source: "https://github.com/PokeMiners/pogo_assets",
    downloadedAt: new Date().toISOString(),
    host: os.hostname(),
    targetDir: path.relative(repoRoot, targetDir),
  };
  fs.writeFileSync(path.join(targetDir, ".sync-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

function main() {
  downloadArchive();
  extractZip();
  extractRarArchives();
  writeManifest();
  console.log(`[pokeminers] dossier synchronisé: ${targetDir}`);
}

main();
