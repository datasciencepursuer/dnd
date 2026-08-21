#!/usr/bin/env node

import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const DEFAULT_OUTPUT = path.join(
  REPO_ROOT,
  "app/features/map-editor/data/srd-monsters.json"
);
const DEFAULT_SPELL_LEVELS = path.join(
  REPO_ROOT,
  "app/features/map-editor/data/character-options.ts"
);
const DEFAULT_MANIFEST = path.join(
  REPO_ROOT,
  "docs/data/2024-srd-catalog-manifest.json"
);
const EXPECTED_COUNT = 330;
const SOURCE_METADATA = Object.freeze({
  edition: "2024 SRD 5.2.1",
  attributionUrl: "https://www.dndbeyond.com/srd",
});

const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"];
const ABILITY_NAMES = {
  str: "STR",
  dex: "DEX",
  con: "CON",
  int: "INT",
  wis: "WIS",
  cha: "CHA",
};
const ABILITY_INDEXES = {
  strength: "str",
  dexterity: "dex",
  constitution: "con",
  intelligence: "int",
  wisdom: "wis",
  charisma: "cha",
  str: "str",
  dex: "dex",
  con: "con",
  int: "int",
  wis: "wis",
  cha: "cha",
};
const SPEED_KEYS = ["walk", "swim", "fly", "burrow", "climb"];
const SENSE_KEYS = ["blindsight", "darkvision", "tremorsense", "truesight"];
const DAMAGE_TYPES = [
  "acid",
  "bludgeoning",
  "cold",
  "fire",
  "force",
  "lightning",
  "necrotic",
  "piercing",
  "poison",
  "psychic",
  "radiant",
  "slashing",
  "thunder",
];

function fail(message) {
  throw new Error(`[srd-2024-monsters] ${message}`);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    fail(`could not parse ${filePath}: ${error.message}`);
  }
}

function readSpellLevels(filePath) {
  let text;
  try {
    text = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  } catch (error) {
    fail(`could not read spell-level catalog ${filePath}: ${error.message}`);
  }

  let entries;
  try {
    entries = JSON.parse(text);
  } catch {
    const match = text.match(/export const DND_SPELL_METADATA = (\[[\s\S]*?\]) as const;/);
    if (!match) {
      fail(`spell-level catalog ${filePath} must be a JSON array or generated character-options.ts`);
    }
    try {
      entries = JSON.parse(match[1]);
    } catch (error) {
      fail(`could not parse spell metadata in ${filePath}: ${error.message}`);
    }
  }

  assert(Array.isArray(entries), `spell-level catalog ${filePath} must contain an array`);
  const levels = new Map();
  for (const entry of entries) {
    assert(entry && typeof entry.name === "string" && Number.isInteger(entry.level), `invalid spell metadata in ${filePath}`);
    assert(entry.level >= 0 && entry.level <= 9, `invalid spell level for ${entry.name}`);
    assert(!levels.has(entry.name), `duplicate spell metadata for ${entry.name}`);
    levels.set(entry.name, entry.level);
  }
  assert(levels.size > 0, `spell-level catalog ${filePath} is empty`);
  return levels;
}

function verifySourceManifest(sourcePath, manifestPath) {
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (error) {
    fail(`could not parse source manifest ${manifestPath}: ${error.message}`);
  }

  const expected = manifest.extracts?.find((entry) => entry.file === path.basename(sourcePath))?.sha256;
  assert(expected, `source manifest has no SHA-256 for ${path.basename(sourcePath)}`);
  const actual = crypto.createHash("sha256").update(fs.readFileSync(sourcePath)).digest("hex");
  assert(actual === expected, `${sourcePath} does not match ${manifestPath}: expected ${expected}, got ${actual}`);
}

function cleanText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\u00ad/g, "")
    // Keep line-wrapped compound units such as "5-foot-wide" intact.
    .replace(/(\d+-[\p{L}]+)-\s*\n\s*(?=\p{L})/gu, "$1-")
    .replace(/(\p{L})-\s*\n\s*(?=\p{L})/gu, "$1")
    .replace(/(\p{L})-\s+(?=\p{L})/gu, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function appendContinuation(description, continuation) {
  const base = cleanText(description);
  const next = cleanText(continuation);
  if (!base) return next;
  if (!next) return base;

  const startsNewSentence = /^(?:the|while|until|when|if|it|this|that|failure|success)\b/i.test(next);
  const separator = startsNewSentence && !/[.!?:;]$/.test(base) ? ". " : " ";
  return cleanText(`${base}${separator}${next}`);
}

/**
 * The source extract represents wrapped stat-block rows as follow-up entries
 * with a name but no description (for example, "Slashing damage" or the
 * continuation of a Multiattack sentence). Fold those rows back into the
 * preceding ability before converting it so the generated snapshot does not
 * expose table fragments as standalone monster abilities.
 */
function normalizeAbilityEntries(entries) {
  const normalized = [];

  for (const entry of entries ?? []) {
    assert(entry && typeof entry === "object" && !Array.isArray(entry), "ability entry must be an object");

    const name = cleanText(entry.name);
    const description = cleanText(entry.description);
    const isContinuation = /\bdamage\b|\bconditions?\b/i.test(name)
      || /^(?:half damage|hit points?|points\b|it can replace\b|this effect\b|disadvantage\b|water on\b|short rests?\b|short or long rest\b|the\b|a\b|an\b|medium\b|small\b|large\b|tiny\b|huge\b|gargantuan\b|failure\b|success\b|while\b|until\b|when\b|if\b|it\b|that\b|from\b|within\b|for\b|each\b|dc\b|ac\s+to\b|grappled\b|any\b|material components\b)/i.test(name)
      || /\bin any combination$/i.test(name)
      || /^(?:strength|dexterity|constitution|intelligence|wisdom|charisma)\b.*\b(?:ability|spellcasting|save)\b/i.test(name);
    if (!description || isContinuation) {
      const previous = normalized.at(-1);
      if (previous && name) {
        normalized[normalized.length - 1] = {
          ...previous,
          description: appendContinuation(previous.description, name),
        };
        if (description) {
          normalized[normalized.length - 1].description = appendContinuation(
            normalized[normalized.length - 1].description,
            description
          );
        }
      }
      continue;
    }

    normalized.push({ ...entry, name, description });
  }

  return normalized;
}

function cleanFormula(value) {
  return cleanText(value).replace(/\s+/g, "");
}

function toKebabCase(value) {
  // This transform is intentionally independent of source ordering and locale:
  // the same display name always produces the same persisted map/AI key.
  const normalized = String(value ?? "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[’'`]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  assert(normalized.length > 0, `could not create an index from ${value}`);
  return normalized;
}

function normalizeType(value) {
  return cleanText(value).toLowerCase();
}

function normalizeLanguages(value) {
  const languages = cleanText(value);
  return languages.toLowerCase() === "none" ? "" : languages;
}

function normalizeSpeedValue(value) {
  if (typeof value === "number") return `${value} ft.`;
  const text = cleanText(value);
  return /^\d+$/.test(text) ? `${text} ft.` : text;
}

function convertSpeed(source, name) {
  assert(source && typeof source === "object" && !Array.isArray(source), `${name} has invalid speed`);
  const speed = {};
  for (const key of SPEED_KEYS) {
    if (source[key] != null) speed[key] = normalizeSpeedValue(source[key]);
  }
  if (source.hover === true) speed.hover = true;
  assert(Object.keys(speed).length > 0, `${name} has no speed values`);
  return speed;
}

function convertSenses(value, name) {
  const source = cleanText(value);
  const passiveMatch = source.match(/\bPassive Perception\s+(-?\d+)/i);
  assert(passiveMatch, `${name} has no passive perception in senses`);

  const senses = { passive_perception: Number(passiveMatch[1]) };
  const senseText = source.split(";")[0];
  for (const segment of senseText.split(",")) {
    const match = segment.trim().match(
      /^(Blindsight|Darkvision|Tremorsense|Truesight)\s+(.+)$/i
    );
    if (!match) continue;
    senses[match[1].toLowerCase()] = cleanText(match[2]);
  }
  return senses;
}

function convertDamage(sourceDamage) {
  if (sourceDamage == null) return [];
  assert(Array.isArray(sourceDamage), "damage must be an array");
  return sourceDamage.map((damage) => {
    assert(damage && typeof damage === "object" && !Array.isArray(damage), "damage entry must be an object");
    assert(typeof damage.type === "string", "damage entry has no type");
    return {
      damage_type: {
        index: toKebabCase(damage.type),
        name: cleanText(damage.type),
      },
      damage_dice: cleanFormula(damage.dice),
      ...(typeof damage.average === "number" ? { average: damage.average } : {}),
    };
  });
}

function deriveDamageFromDescription(description) {
  const text = cleanText(description);
  const results = [];
  const typePattern = DAMAGE_TYPES.join("|");
  const withDice = new RegExp(
    `(\\d+)\\s*\\(([^)]+)\\)\\s+(${typePattern})\\s+damage`,
    "gi"
  );
  for (const match of text.matchAll(withDice)) {
    results.push({
      damage_type: {
        index: match[3].toLowerCase(),
        name: match[3].charAt(0).toUpperCase() + match[3].slice(1).toLowerCase(),
      },
      damage_dice: cleanFormula(match[2]),
      average: Number(match[1]),
    });
  }
  if (results.length > 0) return results;

  const withoutDice = new RegExp(
    `(\\d+)\\s+(${typePattern})\\s+damage`,
    "gi"
  );
  for (const match of text.matchAll(withoutDice)) {
    results.push({
      damage_type: {
        index: match[2].toLowerCase(),
        name: match[2].charAt(0).toUpperCase() + match[2].slice(1).toLowerCase(),
      },
      damage_dice: match[1],
      average: Number(match[1]),
    });
  }
  return results;
}

function deriveAttackFields(source) {
  const description = cleanText(source.description);
  const attackMatch = description.match(
    /^(Melee or Ranged|Melee|Ranged) Attack Roll:\s*\+?(-?\d+)/i
  );
  if (!attackMatch) return {};

  const fields = {
    attack_type: attackMatch[1].toLowerCase(),
    attack_bonus: Number(attackMatch[2]),
  };
  const reachMatch = description.match(/\breach\s+(\d+)\s*(?:ft\.?|feet\b)/i);
  if (reachMatch) fields.reach = Number(reachMatch[1]);

  const rangeMatch = description.match(
    /\brange\s+(\d+)\s*(?:\/\s*(\d+)\s*)?(?:ft\.?|feet\b)/i
  );
  if (rangeMatch) {
    fields.range_normal = Number(rangeMatch[1]);
    if (rangeMatch[2]) fields.range_long = Number(rangeMatch[2]);
  }
  return fields;
}

function deriveUsageFromName(source) {
  const text = `${source.name ?? ""} ${source.description ?? ""}`;
  const rechargeMatch = text.match(/\bRecharge\s+(\d)(?:\s*[-–]\s*(\d))?\b/i);
  if (!rechargeMatch) return undefined;
  return {
    type: "recharge on roll",
    dice: "1d6",
    min_value: Number(rechargeMatch[1]),
  };
}

function convertUsage(source) {
  if (source.uses_per_day != null) {
    assert(Number.isFinite(source.uses_per_day), "uses_per_day must be numeric");
    return {
      type: "per day",
      times: source.uses_per_day,
      ...(source.lair_uses_per_day != null
        ? { lair_times: source.lair_uses_per_day }
        : {}),
    };
  }

  if (source.recharge != null) {
    const match = String(source.recharge).match(/^(\d)(?:\s*[-–]\s*(\d))?$/);
    if (match) {
      return {
        type: "recharge on roll",
        dice: "1d6",
        min_value: Number(match[1]),
      };
    }
  }

  return deriveUsageFromName(source);
}

function convertDc(source, description) {
  if (source.save_type == null && source.save_dc == null) return undefined;
  assert(typeof source.save_type === "string", "save_type must be a string");
  assert(typeof source.save_dc === "number", "save_dc must be numeric");
  const ability = source.save_type.toLowerCase();
  const index = ABILITY_INDEXES[ability] ?? toKebabCase(ability);
  return {
    dc_type: {
      index,
      name: ABILITY_NAMES[index] ?? cleanText(source.save_type).toUpperCase(),
    },
    dc_value: source.save_dc,
    success_type: /Success:\s*Half damage/i.test(cleanText(description))
      ? "half"
      : "none",
  };
}

function convertSpellUsage(bucket) {
  const source = cleanText(bucket).replace(/_/g, " ");
  const perDay = source.match(/^(\d+)\/day(?:\s+each)?$/i);
  if (perDay) return { type: "per day", times: Number(perDay[1]) };
  if (source.toLowerCase() === "at will") return { type: "at will" };
  return { type: source };
}

function normalizeSpellValues(values) {
  const result = [];
  let pending = "";

  for (const value of values ?? []) {
    const text = cleanText(value);
    if (!text) continue;

    pending = pending ? `${pending} ${text}` : text;
    const openParentheses = (pending.match(/\(/g) ?? []).length;
    const closeParentheses = (pending.match(/\)/g) ?? []).length;
    if (openParentheses <= closeParentheses) {
      result.push(pending);
      pending = "";
    }
  }

  if (pending) result.push(pending);
  return result;
}

function spellLookupName(value) {
  return cleanText(value)
    .replace(/[’‘]/g, "'")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim();
}

function convertSpellcasting(source, spellLevels) {
  if (!source || typeof source !== "object" || Array.isArray(source)) return undefined;
  const abilityText = cleanText(source.ability).toLowerCase();
  const abilityIndex = ABILITY_INDEXES[abilityText] ?? toKebabCase(abilityText);
  const spells = [];
  if (source.spells && typeof source.spells === "object" && !Array.isArray(source.spells)) {
    for (const [bucket, values] of Object.entries(source.spells)) {
      if (!Array.isArray(values)) continue;
      for (const spellName of normalizeSpellValues(values)) {
        const normalizedSpellName = spellName.replace(/[’‘]/g, "'");
        const levelMatch = normalizedSpellName.match(/\(level\s+(\d+)\s+version\)/i);
        const baseName = spellLookupName(normalizedSpellName.replace(/\s*\(level\s+\d+\s+version\)\s*$/i, ""));
        const catalogLevel = spellLevels.get(baseName);
        assert(levelMatch || catalogLevel != null, `${normalizedSpellName} is missing from the 2024 spell-level catalog`);
        const level = levelMatch
          ? Number(levelMatch[1])
          : catalogLevel;
        spells.push({
          name: normalizedSpellName,
          level,
          notes: cleanText(bucket).replace(/_/g, " "),
          usage: convertSpellUsage(bucket),
        });
      }
    }
  }

  return {
    ability: {
      index: abilityIndex,
      name: ABILITY_NAMES[abilityIndex] ?? cleanText(source.ability).toUpperCase(),
    },
    ...(typeof source.save_dc === "number" ? { dc: source.save_dc } : {}),
    spells,
  };
}

function convertCommonAbility(source, spellLevels) {
  assert(source && typeof source === "object" && !Array.isArray(source), "ability entry must be an object");
  const description = cleanText(source.description);
  const derivedAttack = deriveAttackFields(source);
  const explicitDamage = Array.isArray(source.damage) ? convertDamage(source.damage) : [];
  const derivedDamage = deriveDamageFromDescription(description);
  // Prefer the complete description-derived damage when available. Some
  // source rows contain truncated types such as "Ra" or "Ne"; the normalized
  // description has the complete type and prevents duplicate bad entries.
  const damage = derivedDamage.length > 0 ? derivedDamage : explicitDamage;
  const result = {
    name: cleanText(source.name),
    desc: description,
    damage,
  };

  if (source.attack_bonus != null || derivedAttack.attack_bonus != null) {
    result.attack_bonus = source.attack_bonus ?? derivedAttack.attack_bonus;
  }
  if (source.attack_type != null || derivedAttack.attack_type != null) {
    result.attack_type = cleanText(source.attack_type ?? derivedAttack.attack_type);
  }
  if (source.reach != null || derivedAttack.reach != null) {
    result.reach = source.reach ?? derivedAttack.reach;
  }
  if (source.range_normal != null || derivedAttack.range_normal != null) {
    result.range_normal = source.range_normal ?? derivedAttack.range_normal;
  }
  if (source.range_long != null || derivedAttack.range_long != null) {
    result.range_long = source.range_long ?? derivedAttack.range_long;
  }

  const dc = convertDc(source, description);
  if (dc) result.dc = dc;
  const usage = convertUsage(source);
  if (usage) result.usage = usage;
  const spellcasting = convertSpellcasting(source.spellcasting, spellLevels);
  if (spellcasting) result.spellcasting = spellcasting;
  return result;
}

function convertTrait(source, spellLevels) {
  return convertCommonAbility(source, spellLevels);
}

function convertAction(source, spellLevels) {
  return convertCommonAbility(source, spellLevels);
}

function convertSensesAndDefenses(source) {
  const immunities = source.immunities ?? {};
  return {
    damage_vulnerabilities: (source.vulnerabilities ?? []).map((value) => cleanText(value).toLowerCase()),
    damage_resistances: (source.resistances ?? []).map((value) => cleanText(value).toLowerCase()),
    damage_immunities: (immunities.damage ?? []).map((value) => cleanText(value).toLowerCase()),
    condition_immunities: (immunities.condition ?? []).map((value) => ({
      index: toKebabCase(value),
      name: cleanText(value),
    })),
  };
}

function convertProficiencies(source) {
  const proficiencies = [];
  for (const key of ABILITY_KEYS) {
    const ability = source.abilities[key];
    if (ability.save !== ability.modifier) {
      proficiencies.push({
        value: ability.save,
        proficiency: {
          index: `saving-throw-${key}`,
          name: `Saving Throw: ${ABILITY_NAMES[key]}`,
        },
      });
    }
  }

  for (const [skill, value] of Object.entries(source.skills ?? {})) {
    proficiencies.push({
      value,
      proficiency: {
        index: `skill-${toKebabCase(skill)}`,
        name: `Skill: ${cleanText(skill)}`,
      },
    });
  }
  return proficiencies;
}

function convertMonster(source, ordinal, spellLevels) {
  assert(source && typeof source === "object" && !Array.isArray(source), `entry ${ordinal} is not an object`);
  assert(typeof source.name === "string" && source.name.trim(), `entry ${ordinal} has no name`);
  assert(source.hp && typeof source.hp === "object" && !Array.isArray(source.hp), `${source.name} has invalid hp`);
  assert(typeof source.hp.average === "number" && typeof source.hp.dice === "string", `${source.name} has invalid hp values`);
  assert(source.abilities && typeof source.abilities === "object" && !Array.isArray(source.abilities), `${source.name} has invalid abilities`);
  for (const key of ABILITY_KEYS) {
    const ability = source.abilities[key];
    assert(ability && typeof ability.score === "number" && typeof ability.save === "number", `${source.name} has invalid ${key} ability`);
  }

  const index = toKebabCase(source.name);
  const hitDiceMatch = cleanFormula(source.hp.dice).match(/^(\d+d\d+)/i);
  const legendary = source.legendary_actions;
  const traits = normalizeAbilityEntries(source.traits);
  const actions = normalizeAbilityEntries(source.actions);
  const bonusActions = normalizeAbilityEntries(source.bonus_actions);
  const reactions = normalizeAbilityEntries(source.reactions);
  const legendaryActions = normalizeAbilityEntries(legendary?.actions);
  const converted = {
    index,
    name: cleanText(source.name),
    size: cleanText(source.size),
    type: normalizeType(source.type),
    ...(source.subtype ? { subtype: normalizeType(source.subtype) } : {}),
    alignment: normalizeType(source.alignment),
    armor_class: [{ type: "base", value: source.ac }],
    hit_points: source.hp.average,
    hit_dice: hitDiceMatch ? hitDiceMatch[1] : cleanFormula(source.hp.dice),
    hit_points_roll: cleanFormula(source.hp.dice),
    speed: convertSpeed(source.speed, source.name),
    strength: source.abilities.str.score,
    dexterity: source.abilities.dex.score,
    constitution: source.abilities.con.score,
    intelligence: source.abilities.int.score,
    wisdom: source.abilities.wis.score,
    charisma: source.abilities.cha.score,
    proficiencies: convertProficiencies(source),
    ...convertSensesAndDefenses(source),
    senses: convertSenses(source.senses, source.name),
    languages: normalizeLanguages(source.languages),
    challenge_rating: source.cr,
    proficiency_bonus: source.proficiency_bonus,
    xp: source.xp,
    special_abilities: traits.map((entry) => convertTrait(entry, spellLevels)),
    actions: actions.map((entry) => convertAction(entry, spellLevels)),
    bonus_actions: bonusActions.map((entry) => convertAction(entry, spellLevels)),
    legendary_actions: legendaryActions.map((entry) => convertAction(entry, spellLevels)),
    reactions: reactions.map((entry) => convertAction(entry, spellLevels)),
    ...(source.telepathy != null ? { telepathy: source.telepathy } : {}),
    ...(source.initiative && typeof source.initiative === "object"
      ? { initiative: source.initiative }
      : {}),
    ...(Array.isArray(source.gear)
      ? { gear: source.gear.map((value) => cleanText(value)) }
      : {}),
    ...(source.lair_xp != null ? { lair_xp: source.lair_xp } : {}),
    ...(legendary?.uses != null ? { legendary_actions_uses: legendary.uses } : {}),
    ...(legendary?.lair_uses != null
      ? { legendary_actions_lair_uses: legendary.lair_uses }
      : {}),
  };

  assert(Number.isInteger(converted.armor_class[0].value), `${source.name} has invalid AC`);
  assert(Number.isInteger(converted.challenge_rating) || typeof converted.challenge_rating === "number", `${source.name} has invalid CR`);
  return converted;
}

function validateSource(source) {
  assert(Array.isArray(source), "source JSON must be an array");
  assert(source.length === EXPECTED_COUNT, `source entry count is ${source.length}; expected ${EXPECTED_COUNT}`);
  assert(source.every((entry) => entry && typeof entry === "object" && !Array.isArray(entry)), "source entries must all be objects");
  return source;
}

function validateGenerated(generated, source) {
  assert(Array.isArray(generated), "generated JSON must be an array");
  assert(generated.length === EXPECTED_COUNT, `generated entry count is ${generated.length}; expected ${EXPECTED_COUNT}`);
  const indexes = new Set();
  const sourceByName = new Map(source.map((entry) => [cleanText(entry.name), entry]));

  for (const monster of generated) {
    assert(monster && typeof monster === "object" && !Array.isArray(monster), "generated entries must be objects");
    assert(typeof monster.index === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(monster.index), `invalid index ${monster.index}`);
    assert(!indexes.has(monster.index), `duplicate index ${monster.index}`);
    indexes.add(monster.index);

    const sourceMonster = sourceByName.get(monster.name);
    assert(sourceMonster, `generated monster ${monster.name} is not in source`);
    assert(monster.index === toKebabCase(sourceMonster.name), `${monster.name} has unstable index`);
    assert(monster.size === cleanText(sourceMonster.size), `${monster.name} size mismatch`);
    assert(monster.type === normalizeType(sourceMonster.type), `${monster.name} type mismatch`);
    assert(monster.alignment === normalizeType(sourceMonster.alignment), `${monster.name} alignment mismatch`);
    assert(monster.armor_class?.[0]?.value === sourceMonster.ac, `${monster.name} AC mismatch`);
    assert(monster.hit_points === sourceMonster.hp.average, `${monster.name} HP mismatch`);
    assert(monster.hit_points_roll === cleanFormula(sourceMonster.hp.dice), `${monster.name} hit dice mismatch`);
    assert(monster.challenge_rating === sourceMonster.cr, `${monster.name} CR mismatch`);
    assert(monster.proficiency_bonus === sourceMonster.proficiency_bonus, `${monster.name} PB mismatch`);
    assert(monster.actions.length === normalizeAbilityEntries(sourceMonster.actions).length, `${monster.name} action count mismatch`);
    assert(monster.bonus_actions.length === normalizeAbilityEntries(sourceMonster.bonus_actions).length, `${monster.name} bonus action count mismatch`);
    assert(monster.reactions.length === normalizeAbilityEntries(sourceMonster.reactions).length, `${monster.name} reaction count mismatch`);
    assert(monster.special_abilities.length === normalizeAbilityEntries(sourceMonster.traits).length, `${monster.name} trait count mismatch`);
    assert(monster.legendary_actions.length === normalizeAbilityEntries(sourceMonster.legendary_actions?.actions).length, `${monster.name} legendary action count mismatch`);

    for (const field of ["special_abilities", "actions", "bonus_actions", "legendary_actions", "reactions"]) {
      assert(Array.isArray(monster[field]), `${monster.name} ${field} must be an array`);
      for (const ability of monster[field]) {
        assert(ability && typeof ability.name === "string" && typeof ability.desc === "string" && ability.desc.trim().length > 0, `${monster.name} has an invalid or empty ${field} entry`);
        assert(Array.isArray(ability.damage), `${monster.name} ${field} damage must be an array`);
      }
    }

    for (const key of ABILITY_KEYS) {
      const outputKey = {
        str: "strength",
        dex: "dexterity",
        con: "constitution",
        int: "intelligence",
        wis: "wisdom",
        cha: "charisma",
      }[key];
      assert(monster[outputKey] === sourceMonster.abilities[key].score, `${monster.name} ${key} score mismatch`);
      const saveProficiency = monster.proficiencies.find(
        (proficiency) => proficiency.proficiency.index === `saving-throw-${key}`
      );
      if (sourceMonster.abilities[key].save !== sourceMonster.abilities[key].modifier) {
        assert(saveProficiency?.value === sourceMonster.abilities[key].save, `${monster.name} ${key} save mismatch`);
      } else {
        assert(!saveProficiency, `${monster.name} has an unexpected ${key} save proficiency`);
      }
    }

    const expectedSkills = Object.entries(sourceMonster.skills ?? {});
    const skillProficiencies = monster.proficiencies.filter((proficiency) =>
      proficiency.proficiency.index.startsWith("skill-")
    );
    assert(skillProficiencies.length === expectedSkills.length, `${monster.name} skill count mismatch`);
    for (const [skill, value] of expectedSkills) {
      const skillProficiency = skillProficiencies.find(
        (proficiency) => proficiency.proficiency.index === `skill-${toKebabCase(skill)}`
      );
      assert(skillProficiency?.value === value, `${monster.name} ${skill} mismatch`);
    }

    const expectedDefenses = convertSensesAndDefenses(sourceMonster);
    assert(JSON.stringify(monster.damage_vulnerabilities) === JSON.stringify(expectedDefenses.damage_vulnerabilities), `${monster.name} vulnerability mismatch`);
    assert(JSON.stringify(monster.damage_resistances) === JSON.stringify(expectedDefenses.damage_resistances), `${monster.name} resistance mismatch`);
    assert(JSON.stringify(monster.damage_immunities) === JSON.stringify(expectedDefenses.damage_immunities), `${monster.name} damage immunity mismatch`);
    assert(JSON.stringify(monster.condition_immunities) === JSON.stringify(expectedDefenses.condition_immunities), `${monster.name} condition immunity mismatch`);
    assert(JSON.stringify(monster.senses) === JSON.stringify(convertSenses(sourceMonster.senses, sourceMonster.name)), `${monster.name} senses mismatch`);

    for (const key of ["walk", "swim", "fly", "burrow", "climb"]) {
      const sourceValue = sourceMonster.speed[key];
      if (sourceValue == null) {
        assert(monster.speed[key] == null, `${monster.name} has unexpected ${key} speed`);
      } else {
        assert(monster.speed[key] === normalizeSpeedValue(sourceValue), `${monster.name} ${key} speed mismatch`);
      }
    }
    if (sourceMonster.speed.hover === true) {
      assert(monster.speed.hover === true, `${monster.name} hover mismatch`);
    }
  }

  assert(indexes.size === EXPECTED_COUNT, "generated indexes are not unique");
}

function generate(source, spellLevels) {
  validateSource(source);
  const generated = source.map((entry, index) => convertMonster(entry, index, spellLevels));
  validateGenerated(generated, source);
  return generated;
}

function parseArguments(args) {
  let command = "generate";
  let sourcePath;
  let outputPath = DEFAULT_OUTPUT;
  let spellLevelsPath = DEFAULT_SPELL_LEVELS;
  let manifestPath = DEFAULT_MANIFEST;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "generate" || argument === "verify") {
      command = argument;
      continue;
    }
    if (argument === "--source") {
      sourcePath = args[++index];
      continue;
    }
    if (argument.startsWith("--source=")) {
      sourcePath = argument.slice("--source=".length);
      continue;
    }
    if (argument === "--spell-levels") {
      spellLevelsPath = args[++index];
      continue;
    }
    if (argument.startsWith("--spell-levels=")) {
      spellLevelsPath = argument.slice("--spell-levels=".length);
      continue;
    }
    if (argument === "--manifest") {
      manifestPath = args[++index];
      continue;
    }
    if (argument.startsWith("--manifest=")) {
      manifestPath = argument.slice("--manifest=".length);
      continue;
    }
    if (argument === "--output") {
      outputPath = path.resolve(REPO_ROOT, args[++index]);
      continue;
    }
    if (argument.startsWith("--output=")) {
      outputPath = path.resolve(REPO_ROOT, argument.slice("--output=".length));
      continue;
    }
    if (argument === "--help" || argument === "-h") {
      console.log(
        [
          "Usage:",
          "  node scripts/generate-srd-2024-monsters.mjs generate --source <monsters.json> [--spell-levels <catalog>] [--manifest <path>] [--output <path>]",
          "  node scripts/generate-srd-2024-monsters.mjs verify --source <monsters.json> [--spell-levels <catalog>] [--manifest <path>] [--output <path>]",
          "",
          `Source: ${SOURCE_METADATA.edition}`,
          `Attribution: ${SOURCE_METADATA.attributionUrl}`,
        ].join("\n")
      );
      process.exit(0);
    }
    if (!argument.startsWith("-")) {
      sourcePath ??= argument;
      continue;
    }
    fail(`unknown argument ${argument}; use --help for usage`);
  }

  assert(sourcePath, "an input path is required; pass --source <monsters.json>");
  assert(spellLevelsPath, "a spell-level catalog path is required");
  assert(manifestPath, "a source manifest path is required");
  return {
    command,
    sourcePath: path.resolve(sourcePath),
    spellLevelsPath: path.resolve(REPO_ROOT, spellLevelsPath),
    manifestPath: path.resolve(REPO_ROOT, manifestPath),
    outputPath,
  };
}

function main() {
  const { command, sourcePath, spellLevelsPath, manifestPath, outputPath } = parseArguments(process.argv.slice(2));
  verifySourceManifest(sourcePath, manifestPath);
  const source = validateSource(readJson(sourcePath));
  const generated = generate(source, readSpellLevels(spellLevelsPath));

  if (command === "verify") {
    const output = readJson(outputPath);
    validateGenerated(output, source);
    assert(JSON.stringify(output) === JSON.stringify(generated), `${outputPath} does not match generator output; regenerate it from the supplied sources`);
    console.log(
      `Verified ${output.length} ${SOURCE_METADATA.edition} monsters, unique kebab-case indexes, and core stat/category shape. Attribution: ${SOURCE_METADATA.attributionUrl}`
    );
    return;
  }

  assert(command === "generate", `unknown command ${command}; use generate or verify`);
  fs.writeFileSync(outputPath, `${JSON.stringify(generated, null, 2)}\n`, "utf8");
  console.log(
    `Generated ${generated.length} ${SOURCE_METADATA.edition} monsters at ${path.relative(REPO_ROOT, outputPath)}. Attribution: ${SOURCE_METADATA.attributionUrl}`
  );
}

main();
