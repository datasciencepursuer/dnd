import type { AbilityScore, AbilityScores, CharacterSheet, SkillProficiencies, ArmorProficiencies } from "../types";

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
    athletics: false,
    // Dexterity
    acrobatics: false,
    sleightOfHand: false,
    stealth: false,
    // Intelligence
    arcana: false,
    history: false,
    investigation: false,
    nature: false,
    religion: false,
    // Wisdom
    animalHandling: false,
    insight: false,
    medicine: false,
    perception: false,
    survival: false,
    // Charisma
    deception: false,
    intimidation: false,
    performance: false,
    persuasion: false,
  };
}

export function createDefaultArmorProficiencies(): ArmorProficiencies {
  return {
    light: false,
    medium: false,
    heavy: false,
    shields: false,
  };
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
    speed: 30,
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

    // Additional Info
    languages: "",
    equipment: [],
    magicItemAttunements: ["", "", ""],
    appearance: "",
  };
}

// Calculate skill modifier: ability modifier + proficiency bonus (if proficient)
export function calculateSkillModifier(
  sheet: CharacterSheet,
  skill: keyof SkillProficiencies
): number {
  const ability = SKILL_ABILITIES[skill];
  const abilityMod = sheet.abilities[ability].modifier;
  const profBonus = sheet.skills?.[skill] ? calculateProficiencyBonus(sheet.level) : 0;
  return abilityMod + profBonus;
}

// Calculate Passive Perception: 10 + Wisdom modifier + proficiency bonus (if proficient)
export function calculatePassivePerception(sheet: CharacterSheet): number {
  return 10 + calculateSkillModifier(sheet, "perception");
}

// Ensure skills object exists with defaults for legacy data
export function ensureSkills(skills: SkillProficiencies | undefined): SkillProficiencies {
  return skills ?? createDefaultSkills();
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
