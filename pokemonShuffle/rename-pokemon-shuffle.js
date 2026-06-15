#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const WRITE = process.argv.includes("--write");
const PLAN_PATH = path.join(ROOT, WRITE ? "rename-manifest.json" : "rename-plan.json");
const PROTO_CURRENT = "/tmp/pogoproto-current.txt";
const PROTO_HISTORICAL = "/tmp/vdisplayproto.proto";
const GM_FORMS = "/tmp/gm-forms.tsv";
const POKEMON_DIR = path.resolve(ROOT, "../../data/pokemon");

function ascii(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .toLowerCase();
}

function loadSpecies() {
  const species = new Map();
  for (const filename of fs.readdirSync(POKEMON_DIR)) {
    if (!filename.endsWith(".json")) continue;
    const record = JSON.parse(fs.readFileSync(path.join(POKEMON_DIR, filename), "utf8"));
    species.set(record.dexNr, {
      id: record.id,
      slug: ascii(record.slug),
    });
  }
  species.set(0, { id: "UNKNOWN", slug: "unknown" });
  species.set(902, { id: "BASCULEGION", slug: "basculegion" });
  return species;
}

function loadEnumMap() {
  const forms = new Map();
  const costumes = new Map();

  if (fs.existsSync(PROTO_HISTORICAL)) {
    const text = fs.readFileSync(PROTO_HISTORICAL, "utf8");
    const formBlock = text.match(/enum Form \{([\s\S]*?)\n\t\}/)?.[1] || "";
    const costumeBlock = text.match(/enum Costume \{([\s\S]*?)\n\t\}/)?.[1] || "";
    for (const match of formBlock.matchAll(/^\s*([A-Z0-9_]+)\s*=\s*(\d+);/gm)) {
      forms.set(Number(match[2]), match[1]);
    }
    for (const match of costumeBlock.matchAll(/^\s*([A-Z0-9_]+)\s*=\s*(\d+);/gm)) {
      costumes.set(Number(match[2]), match[1]);
    }
  }

  if (fs.existsSync(PROTO_CURRENT)) {
    const [formBlock, costumeBlock = ""] = fs
      .readFileSync(PROTO_CURRENT, "utf8")
      .split("Available Costumes:");
    for (const match of formBlock.matchAll(/^(\d+):\s*([A-Z0-9_]+)/gm)) {
      forms.set(Number(match[1]), match[2]);
    }
    for (const match of costumeBlock.matchAll(/^(\d+):\s*([A-Z0-9_]+)/gm)) {
      costumes.set(Number(match[1]), match[2]);
    }
  }

  return { forms, costumes };
}

function loadGameMasterForms() {
  const result = new Map();
  if (!fs.existsSync(GM_FORMS)) return result;
  for (const line of fs.readFileSync(GM_FORMS, "utf8").split(/\r?\n/)) {
    if (!line) continue;
    const [pokemon, form, isCostume, assetBundleSuffix = ""] = line.split("\t");
    result.set(form, {
      pokemon,
      isCostume: isCostume === "true",
      assetBundleSuffix,
    });
  }
  return result;
}

const species = loadSpecies();
const { forms, costumes } = loadEnumMap();
const gmForms = loadGameMasterForms();

function normalizeOfficialPart(part) {
  const replacements = new Map([
    ["alolan", "alola"],
    ["galarian", "galar"],
    ["hisuian", "hisui"],
    ["paldean", "paldea"],
    ["female", "femelle"],
    ["pom_pom", "pompom"],
    ["ten_percent", "ten_percent"],
    ["fifty_percent", "fifty_percent"],
  ]);
  const normalized = ascii(part);
  return replacements.get(normalized) || normalized;
}

function looksLikeEvent(suffix, gm) {
  if (gm?.isCostume || /pgo_/.test(gm?.assetBundleSuffix || "")) return true;
  return /(?:^|_)(?:copy|costume|hat|cap|visor|balloon|shirt|scarf|crown|flower|fashion|holiday|winter|summer|spring|fall|halloween|anniversary|party|fest|tour|worlds|detective|explorer|rock_star|pop_star|libre|belle|ph_d|may|jan|pi|nightcap|royal|horizons|indonesia|noevolve|20\d\d)(?:_|$)/i.test(
    suffix,
  );
}

function decodeOfficialForm(formNumber, pokemon) {
  const enumName = forms.get(formNumber);
  if (!enumName) {
    if (formNumber === 3347) return { form: "eternal_flower", note: "forme 3347 identifiée visuellement" };
    if (formNumber === 2999) return { form: "chest", note: "forme coffre identifiée visuellement" };
    return { form: `form_unknown_${formNumber}`, note: `forme inconnue f${formNumber}` };
  }
  if (enumName === "FORM_UNSET") return {};

  const gm = gmForms.get(enumName);
  const pokemonId = gm?.pokemon || pokemon.id;
  let suffix = enumName;
  if (pokemonId && suffix.startsWith(`${pokemonId}_`)) suffix = suffix.slice(pokemonId.length + 1);

  if (suffix === "NORMAL") return {};
  if (suffix === "SHADOW") return { state: "shadow" };
  if (suffix === "PURIFIED") return { state: "purified" };
  if (suffix === "FEMALE") return { gender: "femelle" };
  if (["MEGA", "MEGA_X", "MEGA_Y", "PRIMAL"].includes(suffix)) {
    return { transformation: normalizeOfficialPart(suffix) };
  }
  if (looksLikeEvent(suffix, gm)) return { event: normalizeOfficialPart(suffix) };
  return { form: normalizeOfficialPart(suffix) };
}

function decodeAlcremie(token) {
  const raw = token.slice(1).toUpperCase();
  const decorations = [
    ["STRAWB", "strawberry"],
    ["CLOVER", "clover"],
    ["FLOWER", "flower"],
    ["BERRY", "berry"],
    ["LOVE", "love"],
    ["STAR", "star"],
    ["RIB", "ribbon"],
  ];
  const creams = [
    ["RUBYSWIRL", "ruby_swirl"],
    ["CARAMEL", "caramel"],
    ["RAINBOW", "rainbow"],
    ["MATCHA", "matcha"],
    ["SALTED", "salted"],
    ["LEMON", "lemon"],
    ["SHINY", "shiny_cream"],
    ["MINT", "mint"],
    ["RUBY", "ruby"],
    ["VAN", "vanilla"],
  ];
  const decoration = decorations.find(([prefix]) => raw.startsWith(prefix));
  if (!decoration) return ascii(raw);
  const remainder = raw.slice(decoration[0].length);
  const cream = creams.find(([prefix]) => remainder === prefix);
  return [decoration[1], cream?.[1]].filter(Boolean).join("_");
}

function manualForm(dex, remainder) {
  const lower = remainder.toLowerCase();
  if ([144, 145, 146].includes(dex) && /(?:^|_)f(?:_|$)/.test(lower)) return "galar";
  if (dex === 199 && lower.includes("galar")) return "galar";
  if (
    dex === 658 &&
    (lower.includes("ash") || lower.includes("form_a1sh") || /(?:^|_)f(?:_|$)/.test(lower))
  ) {
    return "ash";
  }
  if (dex === 716 && lower.includes("neutral")) return "neutral";
  if (dex === 718) {
    if (lower.includes("10%")) return "ten_percent";
    if (lower.includes("50%")) return "fifty_percent";
    if (lower.includes("complete")) return "complete";
    if (lower.includes("cell")) return "cell";
    if (lower.includes("core") || lower.includes("fcore")) return "core";
  }
  if (dex === 720 && lower.includes("unbound")) return "unbound";
  if (dex === 741) {
    if (lower.includes("baile")) return "baile";
    if (lower.includes("pom")) return "pompom";
    if (lower.includes("pau") || lower.includes("pa'u")) return "pau";
    if (lower.includes("sensu")) return "sensu";
  }
  if (dex === 849 && /(?:^|_)f1(?:_|$)/i.test(lower)) return "low_key";
  if (dex === 901 && /(?:^|_)fb(?:_|$)/i.test(lower)) return "bloodmoon";
  return null;
}

function parseLegacy(filename) {
  const basename = filename.slice(0, -4);
  const dexMatch = basename.match(/^(\d+)/);
  if (!dexMatch) throw new Error(`Numéro Pokédex absent : ${filename}`);
  const dex = Number(dexMatch[1]);
  const pokemon = species.get(dex);
  if (!pokemon) throw new Error(`Pokémon inconnu pour le dex ${dex} : ${filename}`);
  const remainder = basename.slice(dexMatch[1].length);
  const tokens = remainder
    .replace(/[^a-zA-Z0-9%]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .split("_")
    .filter(Boolean);

  const states = new Set();
  const transformations = new Set();
  const genders = new Set();
  const formsFound = [];
  const eventsFound = [];
  const notes = [];
  let shiny = false;

  const specialForm = manualForm(dex, remainder);
  if (specialForm) formsFound.push(specialForm);
  if (dex === 670 && /f3347/i.test(remainder)) formsFound.push("eternal_flower");
  if (dex === 809 && /memetal/i.test(remainder)) notes.push("faute historique memetal ignorée");
  if (dex === 144 && /(?:^|_)fa2(?:_|$)/i.test(remainder)) states.add("purified");

  for (const originalToken of tokens) {
    const token = originalToken.toLowerCase();
    if (token === "s") {
      shiny = true;
      continue;
    }
    if (token === "a1") {
      states.add("shadow");
      continue;
    }
    if (token === "a2") {
      states.add("purified");
      continue;
    }
    if (token === "b1") {
      transformations.add("dynamax");
      continue;
    }
    if (token === "b2") {
      transformations.add("gigantamax");
      continue;
    }
    if (token === "b3") {
      transformations.add("max_unknown_b3");
      notes.push("signification du code b3 non confirmée");
      continue;
    }
    if (token === "g2") {
      genders.add("femelle");
      continue;
    }
    if (/^e[1-4]$/.test(token)) {
      transformations.add({ e1: "mega", e2: "mega_x", e3: "mega_y", e4: "primal" }[token]);
      continue;
    }
    if (/^c\d+$/.test(token)) {
      const code = Number(token.slice(1));
      eventsFound.push(normalizeOfficialPart(costumes.get(code) || `unknown_${code}`));
      if (!costumes.has(code)) notes.push(`événement inconnu c${code}`);
      continue;
    }
    if (/^\d+$/.test(token)) {
      const code = Number(token);
      if (dex === 1024 && code === 2881) {
        const result = decodeOfficialForm(code, pokemon);
        if (result.form) formsFound.push(result.form);
        continue;
      }
      eventsFound.push(normalizeOfficialPart(costumes.get(code) || `unknown_${code}`));
      if (!costumes.has(code)) notes.push(`ancien événement inconnu ${code}`);
      continue;
    }
    if (/^f+\d+$/.test(token)) {
      if (dex === 849 && token === "f1") continue;
      const result = decodeOfficialForm(Number(token.match(/\d+/)[0]), pokemon);
      if (result.form && result.form !== specialForm) formsFound.push(result.form);
      if (result.event) eventsFound.push(result.event);
      if (result.state) states.add(result.state);
      if (result.gender) genders.add(result.gender);
      if (result.transformation) transformations.add(result.transformation);
      if (result.note) notes.push(result.note);
      continue;
    }
    if (/^f[a-z]/.test(token)) {
      if (token === "form" || (dex === 144 && token === "fa2")) continue;
      if (specialForm) continue;
      if (dex === 869) formsFound.push(decodeAlcremie(originalToken));
      else if (token === "fbelle") eventsFound.push("belle");
      else if (token === "fdada") formsFound.push("dada");
      else if (token === "fcell") formsFound.push("cell");
      else if (token === "fneutral") formsFound.push("neutral");
      else formsFound.push(ascii(token.slice(1)));
    }
  }

  const uniqueForms = [...new Set(formsFound.filter(Boolean))];
  const uniqueEvents = [...new Set(eventsFound.filter(Boolean))];
  const parts = [];
  for (const event of uniqueEvents) parts.push(`event_${event}`);
  for (const form of uniqueForms) parts.push(form);
  parts.push(...genders);
  parts.push(...transformations);
  parts.push(...states);
  if (shiny) parts.push("chromatique");
  if (parts.length === 0 || (parts.length === 1 && shiny)) parts.unshift("normal");

  return {
    oldFilename: filename,
    dexNr: dex,
    dexId: String(dex).padStart(4, "0"),
    slug: pokemon.slug,
    legacyCodes: tokens,
    semanticParts: parts,
    states: [...states],
    transformations: [...transformations],
    shiny,
    notes: [...new Set(notes)],
    stem: `${String(dex).padStart(4, "0")}_${pokemon.slug}_${parts.join("_")}`,
  };
}

function sourcePriority(filename) {
  const basename = filename.slice(0, -4);
  const simpleBase = /^\d+(?:_(?:s|a1|a2|b1|b2|b3|g2|e1|e2|e3|e4))*$/.test(basename);
  return [simpleBase ? 0 : 1, basename.length, filename];
}

function comparePriority(a, b) {
  const aa = sourcePriority(a.oldFilename);
  const bb = sourcePriority(b.oldFilename);
  return aa[0] - bb[0] || aa[1] - bb[1] || aa[2].localeCompare(bb[2], "en");
}

function isCanonical(filename) {
  const match = filename.match(/^(\d{4})_([a-z0-9]+(?:_[a-z0-9]+)*)\.png$/);
  if (!match) return false;
  const pokemon = species.get(Number(match[1]));
  return Boolean(pokemon && match[2].startsWith(`${pokemon.slug}_`));
}

const allPngFiles = fs.readdirSync(ROOT).filter((filename) => filename.endsWith(".png"));
const existingCanonical = allPngFiles.filter(isCanonical);
const legacyFiles = allPngFiles
  .filter((filename) => /^\d/.test(filename) && !isCanonical(filename))
  .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));

if (legacyFiles.length === 0) {
  console.log("Aucune icône héritée à renommer.");
  process.exit(0);
}

const entries = legacyFiles.map(parseLegacy);
const groups = new Map();

for (const entry of entries) {
  if (!groups.has(entry.stem)) groups.set(entry.stem, []);
  groups.get(entry.stem).push(entry);
}
const reservedDestinations = new Set(existingCanonical);
for (const group of groups.values()) {
  group.sort(comparePriority);
  let suffixNumber = 1;
  group.forEach((entry) => {
    let destination;
    do {
      destination = `${entry.stem}${suffixNumber > 1 ? `_${suffixNumber}` : ""}.png`;
      suffixNumber += 1;
    } while (reservedDestinations.has(destination));
    entry.newFilename = destination;
    reservedDestinations.add(destination);
    delete entry.stem;
  });
}

const destinations = new Set(entries.map((entry) => entry.newFilename));
if (destinations.size !== entries.length) throw new Error("Collision de destination non résolue.");

const manifest = {
  generatedAt: new Date().toISOString(),
  conventionVersion: 1,
  mode: WRITE ? "write" : "dry-run",
  totals: {
    images: entries.length,
    canonicalNames: groups.size,
    duplicateSourcesPreserved: entries.length - groups.size,
    entriesWithNotes: entries.filter((entry) => entry.notes.length).length,
  },
  entries,
};

fs.writeFileSync(PLAN_PATH, `${JSON.stringify(manifest, null, 2)}\n`);

if (WRITE) {
  const temporary = [];
  entries.forEach((entry, index) => {
    const temp = `.rename-tmp-${String(index).padStart(6, "0")}.png`;
    fs.renameSync(path.join(ROOT, entry.oldFilename), path.join(ROOT, temp));
    temporary.push([temp, entry.newFilename]);
  });
  for (const [temp, destination] of temporary) {
    fs.renameSync(path.join(ROOT, temp), path.join(ROOT, destination));
  }
  const index = [...existingCanonical, ...entries.map((entry) => entry.newFilename)].sort((a, b) =>
    a.localeCompare(b, "en"),
  );
  fs.writeFileSync(path.join(ROOT, "index.json"), `${JSON.stringify(index, null, 2)}\n`);
}

console.log(JSON.stringify(manifest.totals, null, 2));
console.log(`${WRITE ? "Manifeste" : "Plan"} : ${PLAN_PATH}`);
