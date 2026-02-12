import type { AbilityScore, AbilityScores, CharacterSheet, SpeedInfo, SkillProficiencies, SkillLevel, ArmorProficiencies } from "../types";

export function calculateModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

// Calculate proficiency bonus based on character level (D&D 5e rules)
export function calculateProficiencyBonus(level: number): number {
  if (level <= 4) return 2;
  if (level <= 8) return 3;
  if (level <= 12) return 4;
  if (level <= 16) return 5;
  return 6; // Level 17-20
}

export function createDefaultAbilityScore(score: number = 10): AbilityScore {
  return {
    score,
    modifier: calculateModifier(score),
    savingThrowProficient: false,
  };
}

export function createDefaultAbilityScores(): AbilityScores {
  return {
    strength: createDefaultAbilityScore(),
    dexterity: createDefaultAbilityScore(),
    constitution: createDefaultAbilityScore(),
    intelligence: createDefaultAbilityScore(),
    wisdom: createDefaultAbilityScore(),
    charisma: createDefaultAbilityScore(),
  };
}

export function createDefaultSkills(): SkillProficiencies {
  return {
    // Strength
    athletics: "none",
    // Dexterity
    acrobatics: "none",
    sleightOfHand: "none",
    stealth: "none",
    // Intelligence
    arcana: "none",
    history: "none",
    investigation: "none",
    nature: "none",
    religion: "none",
    // Wisdom
    animalHandling: "none",
    insight: "none",
    medicine: "none",
    perception: "none",
    survival: "none",
    // Charisma
    deception: "none",
    intimidation: "none",
    performance: "none",
    persuasion: "none",
  };
}

// Cycle skill level: none → proficient → expertise → none
export function cycleSkillLevel(current: SkillLevel): SkillLevel {
  if (current === "none") return "proficient";
  if (current === "proficient") return "expertise";
  return "none";
}

export function createDefaultArmorProficiencies(): ArmorProficiencies {
  return {
    light: false,
    medium: false,
    heavy: false,
    shields: false,
  };
}

export function createDefaultSpeed(walk: number = 30): SpeedInfo {
  return { walk, fly: 0, swim: 0, burrow: 0, climb: 0, hover: false };
}

/** Migrate legacy `speed: number` to SpeedInfo object */
export function ensureSpeed(speed: SpeedInfo | number | undefined): SpeedInfo {
  if (!speed) return createDefaultSpeed();
  if (typeof speed === "number") return createDefaultSpeed(speed);
  return { ...createDefaultSpeed(), ...speed };
}

// Skill to ability mapping
export const SKILL_ABILITIES: Record<keyof SkillProficiencies, keyof AbilityScores> = {
  athletics: "strength",
  acrobatics: "dexterity",
  sleightOfHand: "dexterity",
  stealth: "dexterity",
  arcana: "intelligence",
  history: "intelligence",
  investigation: "intelligence",
  nature: "intelligence",
  religion: "intelligence",
  animalHandling: "wisdom",
  insight: "wisdom",
  medicine: "wisdom",
  perception: "wisdom",
  survival: "wisdom",
  deception: "charisma",
  intimidation: "charisma",
  performance: "charisma",
  persuasion: "charisma",
};

// Get skills for a specific ability
export function getSkillsForAbility(ability: keyof AbilityScores): (keyof SkillProficiencies)[] {
  return (Object.entries(SKILL_ABILITIES) as [keyof SkillProficiencies, keyof AbilityScores][])
    .filter(([, abilityName]) => abilityName === ability)
    .map(([skillName]) => skillName);
}

// Format skill name for display
export function formatSkillName(skill: keyof SkillProficiencies): string {
  const names: Record<keyof SkillProficiencies, string> = {
    athletics: "Athletics",
    acrobatics: "Acrobatics",
    sleightOfHand: "Sleight of Hand",
    stealth: "Stealth",
    arcana: "Arcana",
    history: "History",
    investigation: "Investigation",
    nature: "Nature",
    religion: "Religion",
    animalHandling: "Animal Handling",
    insight: "Insight",
    medicine: "Medicine",
    perception: "Perception",
    survival: "Survival",
    deception: "Deception",
    intimidation: "Intimidation",
    performance: "Performance",
    persuasion: "Persuasion",
  };
  return names[skill];
}

export function createDefaultCharacterSheet(): CharacterSheet {
  return {
    // Version tracking
    lastModified: Date.now(),

    // Basic info
    background: null,
    characterClass: null,
    subclass: null,
    race: null,
    level: 1,
    experience: 0,

    // Combat stats
    ac: 10,
    hpMax: 10,
    hpCurrent: 10,
    hitDice: "1d8",
    proficiencyBonus: 2,
    initiative: 0,
    speed: createDefaultSpeed(),
    creatureSize: "M",

    // Abilities
    abilities: createDefaultAbilityScores(),

    // Skills
    skills: createDefaultSkills(),

    // Equipment & Training Proficiencies
    armorProficiencies: createDefaultArmorProficiencies(),
    weaponProficiencies: "",
    toolProficiencies: "",

    // Class Features, Species Traits, Feats
    classFeatures: [],
    speciesTraits: "",
    feats: "",

    // Weapons & Equipment
    weapons: [],
    coins: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },

    // Status
    shield: false,
    heroicInspiration: false,
    condition: "Healthy",
    auraCircleEnabled: false,
    auraCircleRange: 0,
    auraSquareEnabled: false,
    auraSquareRange: 0,

    // Death Saves
    deathSaves: {
      successes: [false, false, false],
      failures: [false, false, false],
    },

    // Spellcasting
    spellcastingAbility: null,
    spellSlots: {
      level1: { max: 0, used: 0 },
      level2: { max: 0, used: 0 },
      level3: { max: 0, used: 0 },
      level4: { max: 0, used: 0 },
      level5: { max: 0, used: 0 },
      level6: { max: 0, used: 0 },
      level7: { max: 0, used: 0 },
      level8: { max: 0, used: 0 },
      level9: { max: 0, used: 0 },
    },
    spells: [],

    // Backstory & Personality
    alignment: null,
    personalityTraits: "",
    ideals: "",
    bonds: "",
    flaws: "",
    backstory: "",

    // Overridable calculated fields
    passivePerception: null,

    // Additional Info
    languages: "",
    equipment: [],
    magicItemAttunements: ["", "", ""],
    appearance: "",
  };
}

// Calculate skill modifier: ability modifier + proficiency bonus (if proficient) or double (if expertise)
export function calculateSkillModifier(
  sheet: CharacterSheet,
  skill: keyof SkillProficiencies
): number {
  const ability = SKILL_ABILITIES[skill];
  const abilityMod = sheet.abilities[ability].modifier;
  const skillLevel = sheet.skills?.[skill];
  const profBonus = sheet.proficiencyBonus;
  if (skillLevel === "expertise") return abilityMod + profBonus * 2;
  if (skillLevel === "proficient") return abilityMod + profBonus;
  return abilityMod;
}

// Calculate Passive Perception: 10 + Wisdom modifier + proficiency bonus (if proficient)
export function calculatePassivePerception(sheet: CharacterSheet): number {
  return 10 + calculateSkillModifier(sheet, "perception");
}

// Get effective passive perception: uses override if set, otherwise calculates
export function getEffectivePassivePerception(sheet: CharacterSheet): number {
  return sheet.passivePerception ?? calculatePassivePerception(sheet);
}

// Coerce a single skill value from legacy boolean or unknown to SkillLevel
function coerceSkillLevel(value: unknown): SkillLevel {
  if (value === "proficient" || value === "expertise" || value === "none") return value;
  if (value === true) return "proficient";
  return "none";
}

// Ensure skills object exists with defaults for legacy data
// Also migrates legacy boolean values (true → "proficient", false → "none")
export function ensureSkills(skills: SkillProficiencies | undefined): SkillProficiencies {
  if (!skills) return createDefaultSkills();
  const defaults = createDefaultSkills();
  const result = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof SkillProficiencies)[]) {
    result[key] = coerceSkillLevel((skills as unknown as Record<string, unknown>)[key]);
  }
  return result;
}

export function getHpPercentage(current: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(100, (current / max) * 100));
}

export function getHpBarColor(percentage: number): string {
  if (percentage > 50) return "#22c55e"; // green-500
  if (percentage > 25) return "#eab308"; // yellow-500
  return "#ef4444"; // red-500
}

export function updateAbilityScore(
  ability: AbilityScore,
  newScore: number
): AbilityScore {
  return {
    ...ability,
    score: newScore,
    modifier: calculateModifier(newScore),
  };
}
