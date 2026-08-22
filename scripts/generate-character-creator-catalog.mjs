#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const sourceIndex = args.indexOf("--source-dir");
const outputIndex = args.indexOf("--output-dir");
const manifestIndex = args.indexOf("--manifest");
const verify = args.includes("--verify");
const sourceDir = sourceIndex >= 0 ? args[sourceIndex + 1] : undefined;
const outputDir = outputIndex >= 0
  ? args[outputIndex + 1]
  : "app/features/character-creator/data/dnd-2024-basic";
const manifestPath = manifestIndex >= 0
  ? args[manifestIndex + 1]
  : "docs/data/2024-srd-catalog-manifest.json";

if (!sourceDir || sourceDir.startsWith("--")) {
  console.error(
    "Usage: node scripts/generate-character-creator-catalog.mjs --source-dir <SRD directory> [--output-dir <catalog directory>] [--manifest <manifest path>] [--verify]",
  );
  process.exit(1);
}

const sourceRoot = path.resolve(sourceDir);
const outputRoot = path.resolve(outputDir);
const manifestFile = path.resolve(manifestPath);
const sourceFiles = [
  "character-origins.md",
  "classes.md",
  "feats.md",
  "spells.md",
  "equipment.md",
  "magic-items.md",
];

const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
const sourceMetadata = {
  ruleset: "dnd-2024-basic",
  sourceBook: "D&D Beyond System Reference Document v5.2.1",
  sourceVersion: "5.2.1",
  sourceManifest: "docs/data/2024-srd-catalog-manifest.json",
  sourceUrl: "https://www.dndbeyond.com/srd",
  attribution: "D&D Beyond, System Reference Document v5.2.1",
  license: "Creative Commons Attribution 4.0 International (CC BY 4.0)",
  coverage: "SRD-only; not full 2024 Player's Handbook coverage",
};

function readSource(fileName) {
  const filePath = path.join(sourceRoot, fileName);
  if (!fs.existsSync(filePath)) throw new Error(`Missing SRD source file: ${filePath}`);
  const buffer = fs.readFileSync(filePath);
  const expected = manifest.extracts?.find((entry) => entry.file === fileName)?.sha256;
  if (!expected) throw new Error(`Manifest has no SHA-256 for ${fileName}`);
  const actual = crypto.createHash("sha256").update(buffer).digest("hex");
  if (actual !== expected) {
    throw new Error(`${fileName} hash mismatch: expected ${expected}, got ${actual}`);
  }
  return buffer.toString("utf8").replace(/^\uFEFF/, "");
}

const origins = readSource("character-origins.md");
const classesSource = readSource("classes.md");
const featsSource = readSource("feats.md");
const spellsSource = readSource("spells.md");
const equipmentSource = readSource("equipment.md");
const magicItemsSource = readSource("magic-items.md");

const supplementalManifest = manifest.supplemental?.characterCreator;
if (!supplementalManifest?.file || !supplementalManifest.sha256) {
  throw new Error("Manifest must pin the character-creator supplemental JSON");
}
const supplementalPath = path.resolve(path.dirname(manifestFile), supplementalManifest.file);
const supplementalBuffer = fs.readFileSync(supplementalPath);
const supplementalHash = crypto.createHash("sha256").update(supplementalBuffer).digest("hex");
if (supplementalHash !== supplementalManifest.sha256) {
  throw new Error(`Character creator supplemental hash mismatch: expected ${supplementalManifest.sha256}, got ${supplementalHash}`);
}
const supplemental = JSON.parse(supplementalBuffer.toString("utf8"));

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[’']/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function id(kind, name) {
  return `dnd-2024-basic:${kind}:${slugify(name)}`;
}

function cleanHtml(value) {
  return value
    .replace(/<br\s*\/?>(\s*)/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tableRows(text) {
  return [...text.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(([, row]) =>
    [...row.matchAll(/<(?:td|th)(?: [^>]*)?>([\s\S]*?)<\/(?:td|th)>/g)].map(([, cell]) =>
      cleanHtml(cell),
    ),
  );
}

function sectionAfter(text, marker, endMarker) {
  const start = text.indexOf(marker);
  if (start < 0) return "";
  const end = endMarker ? text.indexOf(`\n${endMarker}`, start + marker.length) : -1;
  return text.slice(start, end < 0 ? text.length : end);
}

function sourceDefinition(kind, displayName, extra = {}) {
  return {
    id: id(kind, displayName),
    ...sourceMetadata,
    displayName,
    ...extra,
  };
}

function abilityId(value) {
  const normalized = value.toLowerCase().replace(/[^a-z]/g, "");
  const names = {
    strength: "strength",
    dexterity: "dexterity",
    constitution: "constitution",
    intelligence: "intelligence",
    wisdom: "wisdom",
    charisma: "charisma",
  };
  return names[normalized] ?? normalized;
}

function listFromText(value) {
  return value
    .replace(/^Choose (?:any )?\d+:?\s*/i, "")
    .replace(/^Choose one type of\s*/i, "")
    .replace(/\s*\(see[^)]*\)/gi, "")
    .replace(/\.$/, "")
    .split(/,| or | and /)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseChoiceCount(value) {
  const match = value.match(/Choose(?: any)? (\d+)/i);
  return match ? Number(match[1]) : null;
}

function parseAbilityList(value) {
  return listFromText(value)
    .map(abilityId)
    .filter((value) => ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"].includes(value));
}

function parseSkillList(value) {
  return listFromText(value).map(slugify);
}

function parseEquipmentPackages(text, packagePrefix) {
  const equipmentText = text.replace(/\.$/, "");
  const packages = [];
  const packageMatches = [...equipmentText.matchAll(/\(([A-Z])\)\s*([\s\S]*?)(?=;\s*(?:or\s+)?\([A-Z]\)|$)/g)];
  for (const [, label, rawContents] of packageMatches) {
    const grants = [];
    let contents = rawContents.replace(/,\s*and\s+/g, ", ").replace(/\s+and\s+/g, ", ");
    const coinMatches = [...contents.matchAll(/(\d[\d,]*)\s*(GP|SP|CP|EP|PP)\b/gi)];
    for (const [, amountText, currency] of coinMatches) {
      const amount = Number(amountText.replace(/,/g, ""));
      grants.push({ type: "coins", currency: currency.toLowerCase(), amount });
    }
    contents = contents.replace(/\d[\d,]*\s*(?:GP|SP|CP|EP|PP)\b/gi, "");
    const entries = contents.split(",").map((entry) => entry.trim()).filter(Boolean);
    for (const entry of entries) {
      const quantityMatch = entry.match(/^(\d+)\s+(.+)$/);
      const quantity = quantityMatch ? Number(quantityMatch[1]) : 1;
      const displayName = (quantityMatch ? quantityMatch[2] : entry)
        .replace(/\s+of your choice$/i, "")
        .trim();
      if (!displayName || /^choose /i.test(displayName)) continue;
      const choice = /of your choice|same as above|chosen for/i.test(entry);
      const normalized = displayName.replace(/\s+\([^)]*\)$/, "").trim();
      grants.push({
        type: choice ? "equipment-choice" : "equipment",
        equipmentId: choice ? undefined : id("equipment", normalized),
        displayName: normalized,
        quantity,
        ...(choice ? { choiceKey: slugify(normalized) } : {}),
        sourceText: entry,
      });
    }
    packages.push({
      id: `${packagePrefix}-${label.toLowerCase()}`,
      label: `Package ${label}`,
      sourceText: rawContents.trim(),
      grants,
    });
  }
  return packages;
}

function parseClassSpellLists(_section, className) {
  // The spell-list tables live in the shared Class Spell Lists section after
  // the individual class descriptions, not inside each class's section.
  const listSection = sectionAfter(classesSource, `### ${className} Spell List`, "### ");
  const tables = [...listSection.matchAll(/<table>[\s\S]*?<\/table>/g)].map((match) => tableRows(match[0]));
  return tables.flatMap((rows) => rows.slice(1).map((row) => row[0]).filter((name) => name && name !== "Spell"));
}

function parseClassFeatureText(section, className, level) {
  const marker = `#### Level ${level}:`;
  const start = section.indexOf(marker);
  if (start < 0) return [];
  const end = section.indexOf("\n#### ", start + marker.length);
  const featureSection = section.slice(start, end < 0 ? section.length : end);
  return {
    sourceText: featureSection.replace(/^####[^\n]+\n?/, "").trim(),
    choices: [...featureSection.matchAll(/^_([^_\n]+)_\./gm)].map(([, name]) => name.trim()),
  };
}

function parseClassDefinitions() {
  const classNames = [...classesSource.matchAll(/^## ([^\n]+)$/gm)].map(([, name]) => name);
  return classNames.map((className) => {
    const start = classesSource.indexOf(`## ${className}`);
    const next = classesSource.indexOf("\n## ", start + 1);
    const section = classesSource.slice(start, next < 0 ? classesSource.length : next);
    const tables = [...section.matchAll(/<table>[\s\S]*?<\/table>/g)].map((match) => tableRows(match[0]));
    const coreRows = Object.fromEntries((tables[0] ?? []).map(([key, value]) => [key, value]));
    const progression = tables[1] ?? [];
    const header = progression[0] ?? [];
    const levelOne = progression.find((row) => row[0] === "1") ?? [];
    const progressionRows = progression
      .filter((row) => /^\d+$/.test(row[0] ?? ""))
      .map((row) => {
        const values = Object.fromEntries(header.map((key, index) => [key, row[index] ?? ""]));
        return {
          level: Number(row[0]),
          proficiencyBonus: Number(String(row[1] ?? "").replace("+", "")) || 2,
          features: String(row[2] ?? "").split(/,\s*/).filter((value) => value && value !== "—"),
          ...Object.fromEntries(Object.entries(values).filter(([key]) =>
            !["Level", "Proficiency Bonus", "Class Features"].includes(key),
          )),
        };
      });
    const skillText = coreRows["Skill Proficiencies"] ?? "";
    const toolText = coreRows["Tool Proficiencies"] ?? "";
    const spellcasting = ["Bard", "Cleric", "Druid", "Paladin", "Ranger", "Sorcerer", "Warlock", "Wizard"].includes(className)
      ? {
          ability: className === "Bard" || className === "Paladin" || className === "Sorcerer" || className === "Warlock"
            ? "charisma"
            : className === "Wizard"
              ? "intelligence"
              : "wisdom",
          cantrips: Number(levelOne[header.indexOf("Cantrips")] ?? 0) || 0,
          preparedSpells: Number(levelOne[header.indexOf("Prepared Spells")] ?? 0) || 0,
          spellSlots: header.includes("Spell Slots") && header.includes("Slot Level")
            ? { [String(levelOne[header.indexOf("Slot Level")])]: String(levelOne[header.indexOf("Spell Slots")]) }
            : Object.fromEntries(
                (progression.find((row) => row[0] === "" && row.some((value) => /^\d$/.test(value))) ?? [])
                  .map((key, index) => [key, levelOne[index]])
                  .filter(([key, value]) => /^\d$/.test(String(key)) && /^\d+$/.test(String(value))),
              ),
          spellIds: parseClassSpellLists(section, className).map((name) => id("spell", name)),
        }
      : null;
    const features = (parseClassFeatureText(section, className, 1)?.sourceText ?? "")
      ? (levelOne[2] ?? "").split(/,\s*/).filter((value) => value && value !== "—").map((name) => ({
          id: id("feature", `${className}-${name}`),
          name,
          level: 1,
          category: "class",
        }))
      : [];
    const choices = [];
    const skillCount = parseChoiceCount(skillText) ?? (skillText.includes("any 3") ? 3 : null);
    if (skillCount) {
      choices.push({
        id: `${id("class", className)}:skills`,
        kind: "skills",
        label: "Class skill proficiencies",
        count: skillCount,
        options: skillText.includes("any") ? "all-skills" : parseSkillList(skillText),
        unique: true,
        required: true,
        explanation: `Choose ${skillCount} skill proficiencies granted by ${className}.`,
      });
    }
    if (/Choose/.test(toolText)) {
      const count = parseChoiceCount(toolText) ?? 1;
      choices.push({
        id: `${id("class", className)}:tools`,
        kind: "tools",
        label: "Class tool proficiencies",
        count,
        options: toolText.includes("Musical Instruments") ? "musical-instruments" : "artisan-tools-or-musical-instruments",
        unique: true,
        required: true,
        explanation: `Choose ${count} tool proficiencies from the class options.`,
      });
    }
    const weaponMasteryIndex = header.indexOf("Weapon Mastery");
    const featureNames = (levelOne[2] ?? "").split(/,\s*/).filter((value) => value && value !== "—");
    const masteryCount = weaponMasteryIndex >= 0
      ? Number(levelOne[weaponMasteryIndex])
      : featureNames.includes("Weapon Mastery")
        ? ({ Paladin: 2, Ranger: 2, Rogue: 2 }[className] ?? 2)
        : 0;
    if (masteryCount > 0) {
      choices.push({
        id: `${id("class", className)}:weapon-mastery`,
        kind: "weapon-mastery",
        label: "Weapon mastery",
        count: masteryCount,
        options: "proficient-weapons",
        unique: true,
        required: true,
        explanation: `Choose ${masteryCount} weapons whose mastery properties you can use.`,
      });
    }
    const featureChoiceMap = {
      Cleric: { key: "divineOrder", heading: "Divine Order", options: ["Protector", "Thaumaturge"] },
      Druid: { key: "primalOrder", heading: "Primal Order", options: ["Magician", "Warden"] },
      Fighter: { key: "fightingStyle", heading: "Fighting Style", options: ["Archery", "Defense", "Great Weapon Fighting", "Two-Weapon Fighting"] },
      Rogue: { key: "expertise", heading: "Expertise", options: "selected-skills", count: 2 },
      Warlock: { key: "eldritchInvocation", heading: "Eldritch Invocation", options: "level-one-invocations" },
    };
    const featureChoice = featureChoiceMap[className];
    if (featureChoice) {
      choices.push({
        id: `${id("class", className)}:${slugify(featureChoice.key)}`,
        kind: featureChoice.key,
        label: featureChoice.heading,
        count: featureChoice.count ?? 1,
        options: featureChoice.options,
        unique: true,
        required: true,
        explanation: `Resolve the level 1 ${featureChoice.heading} choice from the ${className} rules.`,
      });
    }
    if (className === "Rogue") {
      choices.push({
        id: `${id("class", className)}:language`,
        kind: "languages",
        label: "Rogue language",
        count: 1,
        options: "standard-or-rare-languages",
        unique: true,
        required: true,
        explanation: "Rogue grants Thieves' Cant and one additional language.",
      });
    }
    return sourceDefinition("class", className, {
      primaryAbilities: parseAbilityList(coreRows["Primary Ability"] ?? ""),
      hitDie: Number((coreRows["Hit Point Die"] ?? "").match(/D(\d+)/i)?.[1] ?? 8),
      savingThrowProficiencies: parseAbilityList(coreRows["Saving Throw Proficiencies"] ?? ""),
      skillProficiencies: {
        fixed: [],
        options: skillText.includes("any") ? "all-skills" : parseSkillList(skillText),
        count: skillCount ?? 0,
      },
      weaponProficiencies: coreRows["Weapon Proficiencies"] ?? "",
      armorTraining: coreRows["Armor Training"] ?? "None",
      toolProficiencies: toolText || null,
      startingEquipment: {
        sourceText: coreRows["Starting Equipment"] ?? "",
        packages: parseEquipmentPackages(coreRows["Starting Equipment"] ?? "", `${slugify(className)}-equipment`),
      },
      progression: progressionRows,
      features,
      choices,
      spellcasting,
      grants: [
        ...parseAbilityList(coreRows["Saving Throw Proficiencies"] ?? "").map((ability) => ({ type: "saving-throw-proficiency", target: ability })),
        { type: "hit-die", sides: Number((coreRows["Hit Point Die"] ?? "").match(/D(\d+)/i)?.[1] ?? 8) },
        { type: "proficiency-text", target: "weapon", value: coreRows["Weapon Proficiencies"] ?? "" },
        { type: "proficiency-text", target: "armor", value: coreRows["Armor Training"] ?? "None" },
      ],
      effects: features.map((feature) => ({ type: "feature", featureId: feature.id, level: 1 })),
    });
  });
}

function parseBackgroundDefinitions() {
  const section = sectionAfter(origins, "### Background Descriptions", "## Character Species");
  const names = [...section.matchAll(/^#### ([^\n]+)$/gm)].map(([, name]) => name);
  return names.map((name) => {
    const start = section.indexOf(`#### ${name}`);
    const end = section.indexOf("\n#### ", start + 1);
    const body = section.slice(start, end < 0 ? section.length : end);
    const read = (label) => body.match(new RegExp(`\\*\\*${label}:\\*\\* ([^\\n]+)`))?.[1]?.trim() ?? "";
    const abilityScores = parseAbilityList(read("Ability Scores"));
    const skills = parseSkillList(read("Skill Proficiencies"));
    const tool = read("Tool Proficiency").replace(/^_Choose one kind of_\s*/i, "").trim();
    const featText = read("Feat").replace(/\s*\(see[^)]*\)/i, "").trim();
    const equipmentText = read("Equipment");
    const toolChoice = /Choose one/i.test(read("Tool Proficiency"));
    return sourceDefinition("background", name, {
      abilityScores,
      abilityScoreIncrease: {
        cap: 20,
        patterns: ["two-plus-one", "one-plus-one-plus-one"],
      },
      originFeatId: id("feat", featText.replace(/\s*\([^)]*\)$/, "")),
      skillProficiencies: skills,
      toolProficiencies: toolChoice ? [] : [slugify(tool)],
      startingEquipment: {
        sourceText: equipmentText,
        packages: parseEquipmentPackages(equipmentText, `${slugify(name)}-equipment`),
      },
      choices: [
        {
          id: `${id("background", name)}:ability-score-increase`,
          kind: "background-ability-scores",
          label: "Background ability-score increases",
          count: 3,
          options: abilityScores,
          required: true,
          unique: true,
          explanation: "Increase one listed ability by 2 and a different listed ability by 1, or increase all three by 1. Scores cannot exceed 20.",
        },
        {
          id: `${id("background", name)}:equipment`,
          kind: "equipment-package",
          label: "Background equipment",
          count: 1,
          options: ["a", "b"],
          required: true,
          unique: true,
          explanation: "Choose the background equipment package or the 50 GP alternative.",
        },
        ...(toolChoice ? [{
          id: `${id("background", name)}:tool`,
          kind: "tools",
          label: "Background tool",
          count: 1,
          options: "gaming-sets",
          required: true,
          unique: true,
          explanation: "Choose one kind of Gaming Set.",
        }] : []),
      ],
      grants: [
        ...skills.map((skill) => ({ type: "skill-proficiency", target: skill })),
        ...(toolChoice ? [] : [{ type: "tool-proficiency", target: slugify(tool) }]),
        { type: "origin-feat", featId: id("feat", featText.replace(/\s*\([^)]*\)$/, "")) },
      ],
    });
  });
}

function parseSpeciesDefinitions() {
  const section = sectionAfter(origins, "### Species Descriptions");
  const names = [...section.matchAll(/^#### ([^\n]+)$/gm)].map(([, name]) => name);
  const choices = Object.fromEntries(Object.entries(supplemental.speciesChoices).map(([speciesName, speciesChoices]) => [
    speciesName,
    speciesChoices.map((choice) => ({
      ...choice,
      options: Array.isArray(choice.options) && choice.options.every((option) => Array.isArray(option))
        ? choice.options.map(([name, damageType]) => ({
            id: slugify(name),
            label: name,
            effects: [{ type: "damage-resistance", damageType: damageType.toLowerCase() }],
          }))
        : Array.isArray(choice.options) && choice.options.every((option) => typeof option === "string")
          ? choice.options.map((label) => ({ id: slugify(label), label }))
          : choice.options,
    })),
  ]));
  return names.map((name) => {
    const start = section.indexOf(`#### ${name}`);
    const end = section.indexOf("\n#### ", start + 1);
    const body = section.slice(start, end < 0 ? section.length : end);
    const type = body.match(/\*\*Creature Type:\*\* ([^\n]+)/)?.[1] ?? "Humanoid";
    const sizeText = body.match(/\*\*Size:\*\* ([^\n]+)/)?.[1] ?? "Medium";
    const speed = Number(body.match(/\*\*Speed:\*\* (\d+) feet/)?.[1] ?? 30);
    const sizeOptions = /or Small/.test(sizeText) ? ["S", "M"] : sizeText.startsWith("Small") ? ["S"] : ["M"];
    const traits = [...body.matchAll(/^_([^_\n]+)\._/gm)].map(([, trait]) => trait.trim());
    const speciesChoices = (choices[name] ?? []).map((choice) => ({
      id: `${id("species", name)}:${slugify(choice.key)}`,
      kind: choice.key,
      label: choice.label,
      count: 1,
      options: choice.options,
      unique: true,
      required: true,
      explanation: `Resolve the ${choice.label} granted by ${name}.`,
    }));
    return sourceDefinition("species", name, {
      creatureType: type,
      size: sizeOptions,
      speed: { walk: speed },
      traits: traits.map((trait) => ({
        ...sourceDefinition("species-trait", `${name}-${trait}`),
        displayName: trait,
        level: 1,
      })),
      choices: speciesChoices,
      grants: [
        { type: "creature-type", value: type.toLowerCase() },
        { type: "speed", walk: speed },
        ...traits.map((trait) => ({ type: "species-trait", traitId: id("species-trait", `${name}-${trait}`) })),
      ],
    });
  });
}

function parseFeatDefinitions() {
  const section = sectionAfter(featsSource, "## Feat Descriptions");
  const categories = [...section.matchAll(/^### (.+) Feats$/gm)].map(([, category]) => category);
  return categories.flatMap((category, categoryIndex) => {
    const start = section.indexOf(`### ${category} Feats`);
    const endMarker = categories[categoryIndex + 1] ? `### ${categories[categoryIndex + 1]} Feats` : undefined;
    const body = section.slice(start, endMarker ? section.indexOf(endMarker, start + 1) : section.length);
    const names = [...body.matchAll(/^#### ([^\n]+)$/gm)].map(([, name]) => name);
    return names.map((name, index) => {
      const featStart = body.indexOf(`#### ${name}`);
      const featEnd = names[index + 1] ? body.indexOf(`#### ${names[index + 1]}`, featStart + 1) : body.length;
      const content = body.slice(featStart + name.length + 6, featEnd);
      const prerequisite = content.match(/_.*?Prerequisite: ([^_]+)_/)?.[1]?.trim() ?? null;
      const choices = [...content.matchAll(/Choose (?:one|a|an|three|two|one of) ([^\.\n]+)/gi)].map(([, value]) => value.trim());
      return sourceDefinition("feat", name, {
        category: category.toLowerCase(),
        prerequisite,
        description: content.trim().split("\n\n").slice(-1)[0]?.trim() ?? "",
        choices: choices.length > 0 ? choices : [],
        effects: [{ type: "feat", featId: id("feat", name) }],
      });
    });
  });
}

function parseSpellDefinitions() {
  return [...spellsSource.matchAll(/^#### ([^\n]+)\n\n_([^\n]+)_\n\n([\s\S]*?)(?=^#### |$)/gm)].map(([, name, levelLine, content]) => {
    const levelMatch = levelLine.match(/^(?:Level (\d+)|.*?Cantrip)/);
    if (!levelMatch) return null;
    const level = levelLine.includes("Cantrip") ? 0 : Number(levelMatch?.[1] ?? 0);
    const classesMatch = levelLine.match(/\(([^)]+)\)/)?.[1] ?? "";
    const classes = classesMatch.split(", ").filter((value) => value && !value.includes("—")).map((value) => id("class", value));
    return sourceDefinition("spell", name, {
      level,
      school: levelLine.match(/(?:Level \d+|Cantrip) ([A-Za-z]+)/)?.[1] ?? "Unknown",
      classes,
      concentration: /\*\*Duration:\*\* Concentration/i.test(content),
      ritual: /\bR\b|Ritual/i.test(levelLine) || /Ritual/i.test(content.slice(0, 400)),
      castingTime: content.match(/\*\*Casting Time:\*\* ([^\n]+)/)?.[1] ?? null,
      range: content.match(/\*\*Range:\*\* ([^\n]+)/)?.[1] ?? null,
      components: content.match(/\*\*Components?:\*\* ([^\n]+)/)?.[1] ?? null,
      description: content.trim().split("\n\n").slice(-1)[0]?.trim() ?? "",
    });
  }).filter(Boolean);
}

function parseEquipmentDefinitions() {
  const definitions = [];
  const weaponsSection = sectionAfter(equipmentSource, "**Weapons**", "## Armor");
  let weaponCategory = "";
  for (const match of weaponsSection.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const rowHtml = match[1];
    const heading = rowHtml.match(/<th colspan="6"><em>([^<]+)<\/em>/);
    if (heading) {
      weaponCategory = heading[1];
      continue;
    }
    const row = tableRows(`<tr>${rowHtml}</tr>`)[0] ?? [];
    if (row.length !== 6 || row[0] === "Name") continue;
    const [name, damage, properties, mastery, weight, cost] = row;
    definitions.push(sourceDefinition("equipment", name, {
      category: "weapon",
      weaponCategory,
      damage,
      properties: properties === "—" ? [] : properties.split(", "),
      mastery,
      weight,
      cost,
      kind: "weapon",
    }));
  }
  const armorSection = sectionAfter(equipmentSource, "**Armor**", "### Armor Training");
  let armorCategory = "";
  for (const match of armorSection.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const rowHtml = match[1];
    const heading = rowHtml.match(/<th colspan="6"><em>([^<]+)<\/em>/);
    if (heading) {
      armorCategory = heading[1];
      continue;
    }
    const row = tableRows(`<tr>${rowHtml}</tr>`)[0] ?? [];
    if (row.length !== 6 || row[0] === "Armor") continue;
    const [name, armorClass, strength, stealth, weight, cost] = row;
    definitions.push(sourceDefinition("equipment", name, {
      category: "armor",
      armorCategory,
      armorClass,
      strength,
      stealth,
      weight,
      cost,
      kind: "armor",
    }));
  }
  const adventuringSection = sectionAfter(equipmentSource, "## Adventuring Gear", "## Mounts and Vehicles");
  for (const [, name, detail] of adventuringSection.matchAll(/^#### ([^\n]+)\n\n([\s\S]*?)(?=^#### |\z)/gm)) {
    const displayName = name.replace(/ \([^)]*\)$/, "");
    if (definitions.some((entry) => entry.displayName === displayName)) continue;
    definitions.push(sourceDefinition("equipment", displayName, {
      category: "adventuring-gear",
      detail: detail.trim().split("\n\n")[0] ?? "",
      kind: "gear",
    }));
  }
  const toolsSection = sectionAfter(equipmentSource, "## Tools", "## Adventuring Gear");
  for (const [, name] of toolsSection.matchAll(/^\*\*([^*]+) \(/gm)) {
    if (definitions.some((entry) => entry.displayName === name)) continue;
    definitions.push(sourceDefinition("equipment", name, { category: "tool", kind: "tool" }));
  }
  const focusVariants = supplemental.equipment.focusVariants;
  for (const [baseName, variants] of focusVariants) {
    for (const variant of variants) {
      const displayName = `${baseName} (${variant})`;
      if (!definitions.some((entry) => entry.displayName === displayName)) {
        definitions.push(sourceDefinition("equipment", displayName, { category: "focus", kind: "focus" }));
      }
    }
  }
  for (const name of supplemental.equipment.fallbackEntries) {
    if (!definitions.some((entry) => entry.displayName === name)) {
      definitions.push(sourceDefinition("equipment", name, { category: "tool", kind: "tool-choice" }));
    }
  }
  for (const name of supplemental.equipment.musicalVariants) {
    if (!definitions.some((entry) => entry.displayName === name)) {
      definitions.push(sourceDefinition("equipment", name, {
        category: "tool",
        kind: "tool",
        variantOf: id("equipment", "Musical Instrument"),
      }));
    }
  }
  const aliases = supplemental.equipment.aliases;
  for (const [alias, target] of aliases) {
    const targetDefinition = definitions.find((entry) => entry.displayName === target);
    if (targetDefinition && !definitions.some((entry) => entry.displayName === alias)) {
      definitions.push({
        ...targetDefinition,
        id: id("equipment", alias),
        displayName: alias,
      });
    }
  }
  return definitions;
}

const standardLanguages = supplemental.languages.standard;
const rareLanguages = supplemental.languages.rare;
const languages = [...standardLanguages, ...rareLanguages].map(([name, origin]) => sourceDefinition("language", name, {
  category: standardLanguages.some(([standard]) => standard === name) ? "standard" : "rare",
  origin,
  sourceCoverage: "The pinned character-origins extract omits the language tables; this table is transcribed from the canonical Creating a Character section.",
  sourceUrl: "https://www.dndbeyond.com/sources/dnd/br-2024/creating-a-character",
}));

const classes = parseClassDefinitions();
const backgrounds = parseBackgroundDefinitions();
const species = parseSpeciesDefinitions();
const feats = parseFeatDefinitions();
const spells = parseSpellDefinitions();
const equipment = parseEquipmentDefinitions();

const catalog = {
  ...sourceMetadata,
  id: "dnd-2024-basic",
  version: "5.2.1",
  generatedAt: "source-manifest",
  files: {
    classes: "classes.json",
    backgrounds: "backgrounds.json",
    species: "species.json",
    feats: "feats.json",
    spells: "spells.json",
    equipment: "equipment.json",
    languages: "languages.json",
  },
  languagePolicy: {
    fixed: [id("language", "Common")],
    choose: 2,
    options: languages.filter((entry) => entry.category === "standard" && entry.displayName !== "Common").map((entry) => entry.id),
    explanation: "Every character knows Common plus two languages chosen from the Standard Languages table. Class features can add more languages.",
  },
  scoreMethods: ["standard-array", "point-buy", "rolling"],
  level: 1,
  multiclassing: false,
  counts: {
    classes: classes.length,
    backgrounds: backgrounds.length,
    species: species.length,
    feats: feats.length,
    spells: spells.length,
    equipment: equipment.length,
    languages: languages.length,
  },
};

const artifacts = { catalog, classes, backgrounds, species, feats, spells, equipment, languages };
const serialized = Object.fromEntries(Object.entries(artifacts).map(([name, value]) => [name, `${JSON.stringify(value, null, 2)}\n`]));

if (verify) {
  for (const [name, contents] of Object.entries(serialized)) {
    const filePath = path.join(outputRoot, `${name}.json`);
    if (!fs.existsSync(filePath)) throw new Error(`Missing generated artifact: ${filePath}`);
    if (fs.readFileSync(filePath, "utf8") !== contents) throw new Error(`${filePath} does not match pinned source output`);
  }
  console.log(JSON.stringify({ verified: true, outputDir: outputRoot, counts: catalog.counts }, null, 2));
} else {
  fs.mkdirSync(outputRoot, { recursive: true });
  for (const [name, contents] of Object.entries(serialized)) {
    fs.writeFileSync(path.join(outputRoot, `${name}.json`), contents);
  }
  console.log(JSON.stringify({ outputDir: outputRoot, counts: catalog.counts }, null, 2));
}
