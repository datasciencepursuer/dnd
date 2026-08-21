#!/usr/bin/env node

import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import process from "node:process";

function usage() {
  console.error(
    "Usage: node scripts/generate-character-options.mjs [--verify] --source-dir <SRD directory> [--manifest <manifest path>] [--output <catalog path>]"
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const verify = args.includes("--verify");
const sourceIndex = args.indexOf("--source-dir");
const manifestIndex = args.indexOf("--manifest");
const outputIndex = args.indexOf("--output");
const sourceDir = sourceIndex >= 0 ? args[sourceIndex + 1] : undefined;
const manifestPath = manifestIndex >= 0
  ? args[manifestIndex + 1]
  : "docs/data/2024-srd-catalog-manifest.json";
const outputPath = outputIndex >= 0
  ? args[outputIndex + 1]
  : "app/features/map-editor/data/character-options.ts";

if (!sourceDir || sourceDir.startsWith("--") || !manifestPath || manifestPath.startsWith("--") || !outputPath || outputPath.startsWith("--")) {
  usage();
}

const sourceRoot = path.resolve(sourceDir);
const manifestFile = path.resolve(manifestPath);
const outputFile = path.resolve(outputPath);

function readSource(fileName) {
  const filePath = path.join(sourceRoot, fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing SRD source file: ${filePath}`);
  }
  return fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
}

function verifySourceManifest(fileNames) {
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  } catch (error) {
    throw new Error(`Could not parse source manifest ${manifestFile}: ${error.message}`);
  }

  for (const fileName of fileNames) {
    const expected = manifest.extracts?.find((entry) => entry.file === fileName)?.sha256;
    if (!expected) throw new Error(`Source manifest has no SHA-256 for ${fileName}`);
    const actual = crypto
      .createHash("sha256")
      .update(fs.readFileSync(path.join(sourceRoot, fileName)))
      .digest("hex");
    if (actual !== expected) {
      throw new Error(`${fileName} does not match ${manifestFile}: expected ${expected}, got ${actual}`);
    }
  }
}

function json(value) {
  return JSON.stringify(value, null, 2);
}

function unique(values) {
  return [...new Set(values)];
}

function assertUnique(label, values) {
  const duplicates = values.filter((value, index) => values.indexOf(value) !== index);
  if (duplicates.length > 0) {
    throw new Error(`${label} contains duplicate names: ${unique(duplicates).join(", ")}`);
  }
}

function sectionBetween(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  if (start < 0) throw new Error(`Could not find source marker: ${startMarker}`);
  const end = endMarker ? text.indexOf(endMarker, start + startMarker.length) : text.length;
  if (endMarker && end < 0) throw new Error(`Could not find source marker: ${endMarker}`);
  return text.slice(start, end);
}

function stripHtml(value) {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function tableRows(text) {
  return [...text.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(([, row]) =>
    [...row.matchAll(/<(?:td|th)(?: [^>]*)?>([\s\S]*?)<\/(?:td|th)>/g)].map(([, cell]) =>
      stripHtml(cell)
    )
  );
}

function firstColumnAfter(text, marker, endMarker) {
  const rows = tableRows(sectionBetween(text, marker, endMarker));
  return rows
    .map((row) => row[0])
    .filter((name) => name && !["Name", "Item", "Form", "Type", "Ammunition", "Vehicle", "Ship"].includes(name));
}

function titleCase(value) {
  return value.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

const origins = readSource("character-origins.md");
const classesSource = readSource("classes.md");
const featsSource = readSource("feats.md");
const spellsSource = readSource("spells.md");
const equipmentSource = readSource("equipment.md");
const magicItemsSource = readSource("magic-items.md");
verifySourceManifest([
  "character-origins.md",
  "classes.md",
  "feats.md",
  "spells.md",
  "equipment.md",
  "magic-items.md",
]);

const speciesSection = sectionBetween(origins, "### Species Descriptions");
const speciesNames = [...speciesSection.matchAll(/^#### ([^\n]+)$/gm)].map(([, name]) => name);
const speciesMetadata = speciesNames.map((name, index) => {
  const start = speciesSection.indexOf(`#### ${name}`);
  const end = index + 1 < speciesNames.length
    ? speciesSection.indexOf(`#### ${speciesNames[index + 1]}`, start + 1)
    : speciesSection.length;
  const traits = [...speciesSection.slice(start, end).matchAll(/^_([^_\n]+)_/gm)].map(([, trait]) =>
    trait.replace(/\.$/, "")
  );
  return { name, traits };
});

const backgroundsSection = sectionBetween(origins, "### Background Descriptions", "## Character Species");
const backgroundMetadata = [...backgroundsSection.matchAll(/^#### ([^\n]+)$/gm)].map(([, name]) => ({ name }));

const subclassMetadata = [...classesSource.matchAll(/^### ([^\n]+) Subclass: ([^\n]+)$/gm)].map(
  ([, className, subclass]) => ({ className, subclass })
);
const classNames = [...classesSource.matchAll(/^## ([^\n]+)$/gm)].map(([, name]) => name);
const classMetadata = classNames.map((name) => ({
  name,
  subclasses: subclassMetadata.filter((entry) => entry.className === name).map((entry) => entry.subclass),
}));

const featCategories = [...featsSource.matchAll(/^### (.+) Feats$/gm)].map(([, category]) => category);
const featMetadata = featCategories.flatMap((category, index) => {
  const start = featsSource.indexOf(`### ${category} Feats`);
  const end = index + 1 < featCategories.length
    ? featsSource.indexOf(`### ${featCategories[index + 1]} Feats`, start + 1)
    : featsSource.length;
  return [...featsSource.slice(start, end).matchAll(/^#### ([^\n]+)$/gm)].map(([, name]) => ({
    name,
    category,
  }));
});

const spellMetadata = [...spellsSource.matchAll(/^#### ([^\n]+)\n\n(_(?:Level \d+|[^\n]*Cantrip)[^\n]*)/gm)].map(
  ([, name, details]) => ({
    name,
    level: details.includes("Cantrip") ? 0 : Number(details.match(/Level (\d+)/)?.[1]),
  })
);

const weaponsSection = sectionBetween(equipmentSource, "## Weapons", "## Armor");
let weaponCategory = "";
const weaponMetadata = [];
for (const match of weaponsSection.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
  const row = match[1];
  const heading = row.match(/<th colspan="6"><em>([^<]+)<\/em>/);
  if (heading) {
    weaponCategory = heading[1];
    continue;
  }
  const cells = tableRows(`<tr>${row}</tr>`)[0] ?? [];
  if (cells.length === 6 && cells[0] !== "Name") {
    weaponMetadata.push({ name: cells[0], category: weaponCategory });
  }
}

const armorSection = sectionBetween(equipmentSource, "## Armor", "### Armor Training");
let armorCategory = "";
const armorMetadata = [];
const armorHeaders = new Set([
  "Armor",
  "Armor Class",
  "Strength",
  "Stealth",
  "Weight",
  "Cost",
  "Light Armor (5 Minutes to Don and 1 Minute to Doff)",
  "Medium Armor (5 Minutes to Don and 1 Minute to Doff)",
  "Heavy Armor (10 Minutes to Don and 5 Minutes to Doff)",
  "Shield (Utilize Action to Don or Doff)",
]);
for (const match of armorSection.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
  const row = match[1];
  const heading = row.match(/<th colspan="6"><em>([^<]+)<\/em>/);
  if (heading) {
    armorCategory = heading[1];
    continue;
  }
  const cells = tableRows(`<tr>${row}</tr>`)[0] ?? [];
  if (cells.length === 6 && !armorHeaders.has(cells[0])) {
    armorMetadata.push({ name: cells[0], category: armorCategory });
  }
}

const adventuringSection = sectionBetween(equipmentSource, "## Adventuring Gear", "## Mounts and Vehicles");
const adventuringMetadata = [...adventuringSection.matchAll(/^#### ([^\n]+)$/gm)].map(([, sourceHeading]) => ({
  name: sourceHeading.replace(/ \([^)]*\)$/, ""),
  category: "Adventuring Gear",
  sourceHeading,
}));

const ammunitionNames = firstColumnAfter(equipmentSource, "**Ammunition**", "#### Antitoxin");
const ammunitionMetadata = ammunitionNames.map((name) => ({
  name,
  category: "Ammunition",
  sourceHeading: "Ammunition",
}));

function focusMetadata(marker, baseName, category, sourceHeading) {
  const variants = firstColumnAfter(equipmentSource, marker, "####");
  return variants.map((variant) => {
    const cleanVariant = variant.replace(/ \(also a Quarterstaff\)$/, "");
    return {
      name: `${baseName} (${titleCase(cleanVariant)})`,
      category,
      sourceHeading,
      variant: cleanVariant,
    };
  });
}

const arcaneFocusMetadata = focusMetadata("**Arcane Focuses**", "Arcane Focus", "Arcane Focus", "Arcane Focuses");
const druidicFocusMetadata = focusMetadata("**Druidic Focuses**", "Druidic Focus", "Druidic Focus", "Druidic Focuses");
const holySymbolMetadata = focusMetadata("**Holy Symbols**", "Holy Symbol", "Holy Symbol", "Holy Symbols");

const mountsSection = sectionBetween(equipmentSource, "## Mounts and Vehicles", "## Lifestyle Expenses");
const mountMetadata = firstColumnAfter(mountsSection, "**Mounts and Other Animals**", "**Tack, Harness, and Drawn Vehicles**").map((name) => ({
  name,
  category: "Mounts and Other Animals",
  sourceHeading: "Mounts and Other Animals",
}));

const tackRows = tableRows(sectionBetween(
  mountsSection,
  "**Tack, Harness, and Drawn Vehicles**",
  "### Large Vehicles"
));
const tackNames = tackRows
  .map((row) => row[0])
  .filter((name) => ["Carriage", "Cart", "Chariot", "Sled", "Wagon"].includes(name));
const saddleNames = ["Exotic", "Military", "Riding"];
const tackMetadata = [
  { name: "Barding", category: "Barding", sourceHeading: "Barding" },
  { name: "Saddle", category: "Saddles", sourceHeading: "Saddles" },
  ...saddleNames.map((variant) => ({
    name: `Saddle (${variant})`,
    category: "Saddles",
    sourceHeading: "Saddles",
    variant,
  })),
  ...tackNames.map((name) => ({
    name,
    category: "Tack, Harness, and Drawn Vehicles",
    sourceHeading: "Tack, Harness, and Drawn Vehicles",
  })),
];

const vehicleMetadata = firstColumnAfter(mountsSection, "### Large Vehicles").map((name) => ({
  name,
  category: "Large Vehicles",
  sourceHeading: "Airborne and Waterborne Vehicles",
}));

const equipmentMetadata = unique([
  ...armorMetadata,
  ...ammunitionMetadata,
  ...adventuringMetadata,
  ...arcaneFocusMetadata,
  ...druidicFocusMetadata,
  ...holySymbolMetadata,
  ...mountMetadata,
  ...tackMetadata,
  ...vehicleMetadata,
].map((entry) => JSON.stringify(entry))).map((entry) => JSON.parse(entry));

const toolSections = sectionBetween(equipmentSource, "## Tools", "## Adventuring Gear");
const artisanTools = sectionBetween(toolSections, "#### Artisan's Tools", "#### Other Tools");
const otherTools = sectionBetween(toolSections, "#### Other Tools");
const toolMetadata = [
  ...[...artisanTools.matchAll(/^\*\*([^*]+) \([^\n]+\)\*\*$/gm)].map(([, name]) => ({
    name,
    category: "Artisan's Tools",
  })),
  ...[...otherTools.matchAll(/^\*\*([^*]+) \([^\n]+\)\*\*$/gm)].map(([, name]) => ({
    name,
    category: "Other Tools",
  })),
];

const magicItemsSection = sectionBetween(magicItemsSource, "## Magic Items A–Z");
const magicItemNames = [...magicItemsSection.matchAll(/^#### ([^\n]+)$/gm)]
  .map(([, name]) => name)
  .filter((name) => name !== "Avatar of Death");
const magicItemMetadata = magicItemNames.map((name) => ({
  name,
  sourceHeading: name,
}));

const compatibilityLanguages = [
  "Common",
  "Common Sign Language",
  "Dwarvish",
  "Elvish",
  "Giant",
  "Gnomish",
  "Goblin",
  "Halfling",
  "Orc",
  "Abyssal",
  "Celestial",
  "Draconic",
  "Deep Speech",
  "Infernal",
  "Primordial",
  "Sylvan",
  "Undercommon",
  "Druidic",
  "Thieves' Cant",
];

const spellRanges = [
  "Self",
  "Touch",
  "5 feet",
  "10 feet",
  "30 feet",
  "60 feet",
  "90 feet",
  "100 feet",
  "120 feet",
  "150 feet",
  "300 feet",
  "500 feet",
  "1 mile",
  "Sight",
  "Unlimited",
  "Self (10-foot radius)",
  "Self (15-foot cone)",
  "Self (15-foot cube)",
  "Self (30-foot radius)",
  "Self (60-foot cone)",
  "Self (60-foot line)",
  "Self (100-foot line)",
];

const dice = ["d4", "d6", "d8", "d10", "d12", "d20", "d100"];

const catalogArrays = {
  species: speciesMetadata.map(({ name }) => name),
  classes: classMetadata.map(({ name }) => name),
  backgrounds: backgroundMetadata.map(({ name }) => name),
  spells: spellMetadata.map(({ name }) => name),
  weapons: weaponMetadata.map(({ name }) => name),
  equipment: equipmentMetadata.map(({ name }) => name),
  languages: compatibilityLanguages,
  tools: toolMetadata.map(({ name }) => name),
  feats: featMetadata.map(({ name }) => name),
  magicItems: magicItemMetadata.map(({ name }) => name),
  speciesTraits: unique(speciesMetadata.flatMap(({ traits }) => traits)),
};

for (const [label, values] of Object.entries(catalogArrays)) assertUnique(label, values);
if (speciesNames.length !== 9) throw new Error(`Expected 9 local SRD species headings, found ${speciesNames.length}`);
if (classMetadata.length !== 12) throw new Error(`Expected 12 local SRD class headings, found ${classMetadata.length}`);
if (subclassMetadata.length !== 12) throw new Error(`Expected 12 local SRD subclass headings, found ${subclassMetadata.length}`);
if (backgroundMetadata.length !== 4) throw new Error(`Expected 4 local SRD background headings, found ${backgroundMetadata.length}`);
if (featMetadata.length !== 17) throw new Error(`Expected 17 local SRD feat headings, found ${featMetadata.length}`);
if (spellMetadata.length !== 339) throw new Error(`Expected 339 local SRD spell headings, found ${spellMetadata.length}`);
if (weaponMetadata.length !== 38) throw new Error(`Expected 38 local SRD weapon entries, found ${weaponMetadata.length}`);
if (magicItemMetadata.length !== 259) throw new Error(`Expected 259 local SRD magic-item headings, found ${magicItemMetadata.length}`);
for (const forbidden of ["Half-Elf", "Half-Orc", "Artificer"]) {
  if (Object.values(catalogArrays).some((values) => values.includes(forbidden))) {
    throw new Error(`Forbidden non-SRD entry generated: ${forbidden}`);
  }
}

const generated = `// Generated from the supplied D&D 2024 SRD 5.2.1 Markdown extracts.
// Canonical source: System Reference Document v5.2.1, D&D Beyond — https://www.dndbeyond.com/srd
// Coverage is SRD-only and is not a claim of full 2024 Player's Handbook coverage.

export const DND_CATALOG_METADATA = {
  ruleset: "D&D 2024 rules",
  source: "System Reference Document v5.2.1",
  sourceVersion: "5.2.1",
  sourceUrl: "https://www.dndbeyond.com/srd",
  attribution: "D&D Beyond, System Reference Document v5.2.1",
  license: "Creative Commons Attribution 4.0 International (CC BY 4.0)",
  coverage: "SRD-only; not full 2024 Player's Handbook coverage",
  sourceFiles: [
    "character-origins.md",
    "classes.md",
    "feats.md",
    "spells.md",
    "equipment.md",
    "magic-items.md",
  ],
  sourceManifest: "docs/data/2024-srd-catalog-manifest.json",
} as const;

export const DND_2024_CATALOG_METADATA = DND_CATALOG_METADATA;

export const DND_SPECIES_METADATA = ${json(speciesMetadata)} as const;
export const DND_RACES: string[] = DND_SPECIES_METADATA.map(({ name }) => name);

export const DND_CLASS_METADATA = ${json(classMetadata)} as const;
export const DND_CLASSES: string[] = DND_CLASS_METADATA.map(({ name }) => name);
export const DND_SUBCLASSES: Record<string, string[]> = Object.fromEntries(
  DND_CLASS_METADATA.map(({ name, subclasses }) => [name, [...subclasses]] as const)
);

export const DND_BACKGROUND_METADATA = ${json(backgroundMetadata)} as const;
export const DND_BACKGROUNDS: string[] = DND_BACKGROUND_METADATA.map(({ name }) => name);

export const DND_FEAT_METADATA = ${json(featMetadata)} as const;
export const DND_FEATS: string[] = DND_FEAT_METADATA.map(({ name }) => name);

export const DND_SPELL_METADATA = ${json(spellMetadata)} as const;
export const DND_SPELLS: { name: string; level: number }[] = DND_SPELL_METADATA.map(({ name, level }) => ({ name, level }));

export const DND_WEAPON_METADATA = ${json(weaponMetadata)} as const;
export const DND_WEAPONS: string[] = DND_WEAPON_METADATA.map(({ name }) => name);

export const DND_EQUIPMENT_METADATA = ${json(equipmentMetadata)} as const;
export const DND_EQUIPMENT: string[] = DND_EQUIPMENT_METADATA.map(({ name }) => name);

export const DND_TOOL_METADATA = ${json(toolMetadata)} as const;
export const DND_TOOLS: string[] = DND_TOOL_METADATA.map(({ name }) => name);

export const DND_MAGIC_ITEM_METADATA = ${json(magicItemMetadata)} as const;
export const DND_MAGIC_ITEMS: string[] = DND_MAGIC_ITEM_METADATA.map(({ name }) => name);

export const DND_SPECIES_TRAITS: string[] = [...new Set(DND_SPECIES_METADATA.flatMap(({ traits }) => traits))];

// The supplied SRD extracts do not contain the Character Creation language tables.
// Keep this existing sheet-helper API explicit and separate from the SRD-derived catalog above.
export const DND_LANGUAGES: string[] = ${json(compatibilityLanguages)};
export const DND_LANGUAGE_METADATA = {
  sourceCoverage: "Compatibility helper retained; language tables are outside the supplied SRD extracts.",
  entries: DND_LANGUAGES,
} as const;

// These are sheet input helpers rather than claims about the supplied SRD catalog.
export const DND_SPELL_RANGES: string[] = ${json(spellRanges)};
export const DND_DICE: string[] = ${json(dice)};

export function getSubclasses(className: string | null): string[] {
  if (!className) return [];
  if (DND_SUBCLASSES[className]) return DND_SUBCLASSES[className];
  const key = Object.keys(DND_SUBCLASSES).find(
    (k) => k.toLowerCase() === className.toLowerCase()
  );
  return key ? DND_SUBCLASSES[key] : [];
}

export function getSpellNames(level?: number): string[] {
  if (level === undefined) return DND_SPELLS.map((s) => s.name);
  return DND_SPELLS.filter((s) => s.level === level).map((s) => s.name);
}
`;

if (verify) {
  if (!fs.existsSync(outputFile)) {
    throw new Error(`Cannot verify missing generated catalog: ${outputFile}`);
  }
  const current = fs.readFileSync(outputFile, "utf8");
  if (current !== generated) {
    throw new Error(`${outputFile} does not match generator output; regenerate it from the supplied sources`);
  }
  console.log(JSON.stringify({ verified: true, outputFile }, null, 2));
} else {
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, generated);

  console.log(JSON.stringify({
    sourceDir: sourceRoot,
    outputFile,
    counts: Object.fromEntries(Object.entries(catalogArrays).map(([key, values]) => [key, values.length])),
  }, null, 2));
}
