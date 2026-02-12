import type { CharacterSheet, CreatureSize, SkillProficiencies, ClassFeature, Weapon, DamageType, RechargeCondition } from "../types";
import type { SrdMonster, SrdAction, SrdDamage } from "../data/monster-types";
import { formatCR } from "../data/monster-types";
import {
  createDefaultCharacterSheet,
  calculateModifier,
  calculatePassivePerception,
  createDefaultSkills,
  createDefaultAbilityScore,
  SKILL_ABILITIES,
} from "./character-utils";

/** Map SRD size string to CharacterSheet CreatureSize */
function mapMonsterSize(srdSize: string): CreatureSize {
  switch (srdSize) {
    case "Tiny":
    case "Small":
      return "S";
    case "Medium":
      return "M";
    case "Large":
    case "Huge":
    case "Gargantuan":
      return "L";
    default:
      return "M";
  }
}

/** Map SRD size to token grid size (in cells) */
export function mapMonsterTokenSize(srdSize: string): number {
  switch (srdSize) {
    case "Tiny":
    case "Small":
    case "Medium":
      return 1;
    case "Large":
      return 2;
    case "Huge":
      return 3;
    case "Gargantuan":
      return 4;
    default:
      return 1;
  }
}

/** Get a color based on monster type */
export function getMonsterColor(type: string): string {
  const lowerType = type.toLowerCase();
  const colorMap: Record<string, string> = {
    aberration: "#7c3aed",  // purple
    beast: "#16a34a",       // green
    celestial: "#facc15",   // yellow
    construct: "#78716c",   // gray
    dragon: "#dc2626",      // red
    elemental: "#f97316",   // orange
    fey: "#a855f7",         // violet
    fiend: "#991b1b",       // dark red
    giant: "#92400e",       // brown
    humanoid: "#2563eb",    // blue
    monstrosity: "#b91c1c", // crimson
    ooze: "#84cc16",        // lime
    plant: "#15803d",       // dark green
    undead: "#1f2937",      // charcoal
  };
  // Check for swarm in subtype
  if (lowerType.includes("swarm")) return "#78716c";
  return colorMap[lowerType] || "#6b7280";
}

// SRD skill index -> SkillProficiencies key mapping
const SKILL_INDEX_MAP: Record<string, keyof SkillProficiencies> = {
  "skill-athletics": "athletics",
  "skill-acrobatics": "acrobatics",
  "skill-sleight-of-hand": "sleightOfHand",
  "skill-stealth": "stealth",
  "skill-arcana": "arcana",
  "skill-history": "history",
  "skill-investigation": "investigation",
  "skill-nature": "nature",
  "skill-religion": "religion",
  "skill-animal-handling": "animalHandling",
  "skill-insight": "insight",
  "skill-medicine": "medicine",
  "skill-perception": "perception",
  "skill-survival": "survival",
  "skill-deception": "deception",
  "skill-intimidation": "intimidation",
  "skill-performance": "performance",
  "skill-persuasion": "persuasion",
};

// Saving throw proficiency index -> ability key
const SAVE_INDEX_MAP: Record<string, string> = {
  "saving-throw-str": "strength",
  "saving-throw-dex": "dexterity",
  "saving-throw-con": "constitution",
  "saving-throw-int": "intelligence",
  "saving-throw-wis": "wisdom",
  "saving-throw-cha": "charisma",
};

/** Parse speed string like "30 ft." to number */
export function parseSpeed(speed: string | undefined): number {
  if (!speed) return 0;
  const match = speed.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

/** Extract damage type from SrdDamage, coercing to our DamageType where possible */
function extractDamageType(damages: SrdDamage[]): DamageType | string {
  if (damages.length === 0) return "Physical";
  const name = damages[0].damage_type?.name;
  if (!name) return "Physical";
  // Capitalize first letter to match our DamageType union
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

/** Extract damage dice string from action's damages */
function extractDamageDice(damages: SrdDamage[]): string {
  return damages.map((d) => d.damage_dice).filter(Boolean).join(" + ");
}

/** Convert an SRD action with attack_bonus into a Weapon */
function actionToWeapon(action: SrdAction): Weapon | null {
  if (action.attack_bonus == null) return null;

  return {
    id: crypto.randomUUID(),
    name: action.name,
    bonus: action.attack_bonus,
    dice: extractDamageDice(action.damage),
    damageType: extractDamageType(action.damage),
    notes: action.dc
      ? `DC ${action.dc.dc_value} ${action.dc.dc_type?.name ?? ""}`
      : "",
  };
}

/** Map SRD usage type to our RechargeCondition */
function mapRecharge(usage?: { type: string; times?: number; rest_types?: string[] }): RechargeCondition {
  if (!usage) return "none";
  switch (usage.type) {
    case "per day":
      return "daily";
    case "recharge after rest":
      // Short rest recharge also covers long rest
      if (usage.rest_types?.includes("short")) return "shortRest";
      if (usage.rest_types?.includes("long")) return "longRest";
      return "shortRest";
    // "recharge on roll" has no direct mapping — stays "none", noted in feature name
    default:
      return "none";
  }
}

/** Convert a non-attack action/ability into a ClassFeature */
function abilityToFeature(
  name: string,
  desc: string,
  prefix?: string,
  usage?: { type: string; times?: number; rest_types?: string[] }
): ClassFeature {
  const displayName = prefix ? `[${prefix}] ${name}` : name;
  const hasCharges = usage?.times != null && usage.times > 0;
  const recharge = mapRecharge(usage);

  return {
    id: crypto.randomUUID(),
    name: `${displayName}: ${desc}`,
    category: prefix === "Reaction" ? "reaction" : "action",
    charges: hasCharges ? { current: usage!.times!, max: usage!.times! } : null,
    recharge,
  };
}

/** Convert an SRD monster to a CharacterSheet */
export function monsterToCharacterSheet(monster: SrdMonster): CharacterSheet {
  const sheet = createDefaultCharacterSheet();

  // Basic info
  sheet.alignment = monster.alignment || null;
  sheet.characterClass = monster.type + (monster.subtype ? ` (${monster.subtype})` : "");
  sheet.race = monster.type + (monster.subtype ? ` (${monster.subtype})` : "");
  sheet.background = `CR ${formatCR(monster.challenge_rating)} (${monster.xp.toLocaleString()} XP)`;
  sheet.level = Math.max(1, Math.ceil(monster.challenge_rating) || 1);
  sheet.creatureSize = mapMonsterSize(monster.size);

  // Combat stats
  sheet.ac = monster.armor_class?.[0]?.value ?? 10;
  sheet.hpMax = monster.hit_points;
  sheet.hpCurrent = monster.hit_points;
  sheet.hitDice = monster.hit_dice || "1d8";
  sheet.proficiencyBonus = monster.proficiency_bonus || 2;
  sheet.speed = {
    walk: parseSpeed(monster.speed?.walk),
    fly: parseSpeed(monster.speed?.fly),
    swim: parseSpeed(monster.speed?.swim),
    burrow: parseSpeed(monster.speed?.burrow),
    climb: parseSpeed(monster.speed?.climb),
    hover: monster.speed?.hover ?? false,
  };
  sheet.initiative = calculateModifier(monster.dexterity);

  // Ability scores
  const abilities: [string, number][] = [
    ["strength", monster.strength],
    ["dexterity", monster.dexterity],
    ["constitution", monster.constitution],
    ["intelligence", monster.intelligence],
    ["wisdom", monster.wisdom],
    ["charisma", monster.charisma],
  ];

  for (const [key, score] of abilities) {
    sheet.abilities[key as keyof typeof sheet.abilities] = createDefaultAbilityScore(score);
  }

  // Proficiencies - saving throws and skills
  const skills = createDefaultSkills();

  for (const prof of monster.proficiencies || []) {
    const idx = prof.proficiency?.index;
    if (!idx) continue;

    // Saving throws
    const saveAbility = SAVE_INDEX_MAP[idx];
    if (saveAbility) {
      const ability = sheet.abilities[saveAbility as keyof typeof sheet.abilities];
      if (ability) ability.savingThrowProficient = true;
      continue;
    }

    // Skills
    const skillKey = SKILL_INDEX_MAP[idx];
    if (skillKey) {
      // Determine if proficient or expertise by comparing bonus
      const abilityKey = SKILL_ABILITIES[skillKey];
      const abilityMod = calculateModifier(
        sheet.abilities[abilityKey].score
      );
      const expectedProficient = abilityMod + (monster.proficiency_bonus || 2);
      const expectedExpertise = abilityMod + (monster.proficiency_bonus || 2) * 2;

      if (prof.value >= expectedExpertise) {
        skills[skillKey] = "expertise";
      } else if (prof.value >= expectedProficient) {
        skills[skillKey] = "proficient";
      } else {
        skills[skillKey] = "proficient"; // Default to proficient if in proficiency list
      }
    }
  }
  sheet.skills = skills;

  // Weapons from attack actions
  const weapons: Weapon[] = [];
  const features: ClassFeature[] = [];

  for (const action of monster.actions || []) {
    const weapon = actionToWeapon(action);
    if (weapon) {
      weapons.push(weapon);
    } else if (action.name !== "Multiattack") {
      // Non-attack actions become features
      features.push(abilityToFeature(action.name, action.desc, undefined, action.usage));
    } else {
      // Multiattack as a feature
      features.push(abilityToFeature(action.name, action.desc));
    }
  }
  sheet.weapons = weapons;

  // Special abilities → features
  for (const ability of monster.special_abilities || []) {
    features.push(abilityToFeature(ability.name, ability.desc, undefined, ability.usage));
  }

  // Legendary actions → features with [Legendary] prefix
  for (const action of monster.legendary_actions || []) {
    features.push(abilityToFeature(action.name, action.desc, "Legendary"));
  }

  // Reactions → features with [Reaction] prefix
  for (const reaction of monster.reactions || []) {
    features.push(abilityToFeature(reaction.name, reaction.desc, "Reaction"));
  }

  sheet.classFeatures = features;

  // Species traits: senses, resistances/immunities
  const traits: string[] = [];

  // Senses
  if (monster.senses?.darkvision) traits.push(`Darkvision ${monster.senses.darkvision}`);
  if (monster.senses?.blindsight) traits.push(`Blindsight ${monster.senses.blindsight}`);
  if (monster.senses?.tremorsense) traits.push(`Tremorsense ${monster.senses.tremorsense}`);
  if (monster.senses?.truesight) traits.push(`Truesight ${monster.senses.truesight}`);

  // Damage info
  if (monster.damage_resistances?.length) {
    traits.push(`Resistances: ${monster.damage_resistances.join(", ")}`);
  }
  if (monster.damage_immunities?.length) {
    traits.push(`Immunities: ${monster.damage_immunities.join(", ")}`);
  }
  if (monster.damage_vulnerabilities?.length) {
    traits.push(`Vulnerabilities: ${monster.damage_vulnerabilities.join(", ")}`);
  }
  if (monster.condition_immunities?.length) {
    traits.push(
      `Condition Immunities: ${monster.condition_immunities.map((c) => c.name).join(", ")}`
    );
  }

  sheet.speciesTraits = traits.join("; ");

  // Languages
  sheet.languages = monster.languages || "";

  // Passive perception from SRD (may differ from calculated due to special abilities)
  if (monster.senses?.passive_perception != null) {
    const calculated = calculatePassivePerception(sheet);
    // Only store override if SRD value differs from what we'd auto-calculate
    if (monster.senses.passive_perception !== calculated) {
      sheet.passivePerception = monster.senses.passive_perception;
    }
  }

  // Spellcasting detection
  const spellcasting = monster.special_abilities?.find(
    (a) => a.spellcasting
  )?.spellcasting;
  if (spellcasting) {
    const abilityIndex = spellcasting.ability?.index;
    if (abilityIndex === "int" || abilityIndex === "intelligence") {
      sheet.spellcastingAbility = "intelligence";
    } else if (abilityIndex === "wis" || abilityIndex === "wisdom") {
      sheet.spellcastingAbility = "wisdom";
    } else if (abilityIndex === "cha" || abilityIndex === "charisma") {
      sheet.spellcastingAbility = "charisma";
    }

    // Map spell slots
    if (spellcasting.slots) {
      for (const [level, count] of Object.entries(spellcasting.slots)) {
        const slotKey = `level${level}` as keyof typeof sheet.spellSlots;
        if (sheet.spellSlots[slotKey]) {
          sheet.spellSlots[slotKey] = { max: count, used: 0 };
        }
      }
    }

    // Map spells
    if (spellcasting.spells) {
      sheet.spells = spellcasting.spells.map((s) => ({
        id: crypto.randomUUID(),
        level: s.level,
        name: s.name,
        concentration: false,
        range: "",
        material: "",
        notes: s.notes || (s.usage ? `${s.usage.times}x ${s.usage.type}` : ""),
      }));
    }
  }

  sheet.lastModified = Date.now();
  return sheet;
}

/** Overrides a DM can apply to a monster template before creation */
export interface MonsterOverrides {
  name?: string;
  ac?: number;
  hp?: number;
  walkSpeed?: number;
  strength?: number;
  dexterity?: number;
  constitution?: number;
  intelligence?: number;
  wisdom?: number;
  charisma?: number;
}

/** Apply DM overrides to a monster character sheet */
export function applyMonsterOverrides(
  sheet: CharacterSheet,
  overrides: MonsterOverrides
): CharacterSheet {
  const result = { ...sheet };

  if (overrides.ac != null) result.ac = overrides.ac;
  if (overrides.hp != null) {
    result.hpMax = overrides.hp;
    result.hpCurrent = overrides.hp;
  }
  if (overrides.walkSpeed != null) {
    result.speed = { ...result.speed, walk: overrides.walkSpeed };
  }

  // Ability scores
  const abilityKeys = [
    "strength",
    "dexterity",
    "constitution",
    "intelligence",
    "wisdom",
    "charisma",
  ] as const;

  const abilities = { ...result.abilities };
  for (const key of abilityKeys) {
    const val = overrides[key];
    if (val != null) {
      abilities[key] = {
        ...abilities[key],
        score: val,
        modifier: calculateModifier(val),
      };
    }
  }
  result.abilities = abilities;

  // Recalculate initiative from (potentially overridden) dexterity
  result.initiative = abilities.dexterity.modifier;

  result.lastModified = Date.now();
  return result;
}
