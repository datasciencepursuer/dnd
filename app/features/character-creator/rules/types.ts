import type { AbilityScores, CharacterSheet, CharacterSheetProvenance } from "~/features/map-editor/types";

/** The build version is intentionally stable so the metadata-only slice remains readable. */
export const CHARACTER_CREATOR_BUILD_VERSION = 1 as const;
export const CHARACTER_CREATOR_RULESET = "dnd-2024-basic" as const;

export type RulesetId = typeof CHARACTER_CREATOR_RULESET;
export type CharacterCreationMode = "guided";
export type AbilityScoreMethod = "standard-array" | "point-buy" | "rolling";
export type AbilityName = keyof AbilityScores;

export const ABILITY_NAMES = [
  "strength",
  "dexterity",
  "constitution",
  "intelligence",
  "wisdom",
  "charisma",
] as const satisfies readonly AbilityName[];

export interface RuleDefinitionMetadata {
  id: string;
  ruleset: RulesetId;
  sourceBook: string;
  sourceVersion: string;
  sourceManifest: string;
  sourceUrl?: string;
  attribution?: string;
  license?: string;
  displayName: string;
}

export interface CatalogChoiceOption {
  id: string;
  label: string;
  effects?: readonly CatalogEffect[];
  grants?: readonly string[];
}

export type CatalogChoiceOptions =
  | readonly string[]
  | readonly CatalogChoiceOption[]
  | "all-skills"
  | "all-languages"
  | "standard-or-rare-languages"
  | "standard-languages"
  | "musical-instruments"
  | "artisan-tools-or-musical-instruments"
  | "gaming-sets"
  | "proficient-weapons"
  | "selected-skills"
  | "level-one-invocations"
  | "origin-feats"
  | "intelligence-wisdom-charisma";

export interface CatalogChoice {
  id: string;
  kind: string;
  label: string;
  count: number;
  options: CatalogChoiceOptions;
  unique: boolean;
  required: boolean;
  explanation: string;
}

export interface CatalogEffect {
  type: string;
  [key: string]: unknown;
}

export interface CatalogGrant {
  type: string;
  [key: string]: unknown;
}

export interface CatalogEquipmentGrant {
  type: "equipment" | "equipment-choice" | "coins";
  equipmentId?: string;
  displayName?: string;
  quantity?: number;
  currency?: string;
  amount?: number;
  choiceKey?: string;
  sourceText?: string;
}

export interface CatalogEquipmentPackage {
  id: string;
  label: string;
  sourceText: string;
  grants: readonly CatalogEquipmentGrant[];
}

export interface CatalogOption extends RuleDefinitionMetadata {
  category?: string;
  description?: string;
  choices?: readonly CatalogChoice[];
  grants?: readonly CatalogGrant[];
  effects?: readonly CatalogEffect[];
}

export interface CatalogClass extends CatalogOption {
  primaryAbilities: readonly AbilityName[];
  hitDie: number;
  savingThrowProficiencies: readonly AbilityName[];
  skillProficiencies: {
    fixed: readonly string[];
    options: readonly string[] | "all-skills";
    count: number;
  };
  weaponProficiencies: string;
  armorTraining: string;
  toolProficiencies: string | null;
  startingEquipment: {
    sourceText: string;
    packages: readonly CatalogEquipmentPackage[];
  };
  progression: readonly Record<string, unknown>[];
  features: readonly {
    id: string;
    name: string;
    level: number;
    category: string;
  }[];
  spellcasting: {
    ability: AbilityName;
    cantrips: number;
    preparedSpells: number;
    spellSlots: Readonly<Record<string, string>>;
    spellIds: readonly string[];
  } | null;
}

export interface CatalogBackground extends CatalogOption {
  abilityScores: readonly AbilityName[];
  abilityScoreIncrease: {
    cap: number;
    patterns: readonly string[];
  };
  originFeatId: string;
  skillProficiencies: readonly string[];
  toolProficiencies: readonly string[];
  choices?: readonly CatalogChoice[];
  startingEquipment: {
    sourceText: string;
    packages: readonly CatalogEquipmentPackage[];
  };
}

export interface CatalogSpecies extends CatalogOption {
  creatureType: string;
  size: readonly ("S" | "M")[];
  speed: { walk: number };
  traits: readonly CatalogOption[];
}

export interface CatalogFeat extends CatalogOption {
  category: string;
  prerequisite: string | null;
}

export interface CatalogSpell extends CatalogOption {
  level: number;
  school: string;
  classes: readonly string[];
  concentration: boolean;
  ritual: boolean;
  castingTime: string | null;
  range: string | null;
  components: string | null;
}

export interface CatalogEquipment extends CatalogOption {
  kind: string;
  category: string;
  weaponCategory?: string;
  damage?: string;
  properties?: readonly string[];
  mastery?: string;
  armorCategory?: string;
  armorClass?: string;
  strength?: string;
  stealth?: string;
  weight?: string;
  cost?: string;
}

export interface CatalogLanguage extends CatalogOption {
  category: "standard" | "rare";
  origin: string;
}

export interface CharacterCreatorCatalog {
  id: RulesetId;
  version: string;
  ruleset: string;
  sourceBook: string;
  sourceVersion: string;
  sourceManifest: string;
  sourceUrl: string;
  attribution: string;
  license: string;
  coverage: string;
  files: Record<string, string>;
  languagePolicy: {
    fixed: readonly string[];
    choose: number;
    options: readonly string[];
    explanation: string;
  };
  scoreMethods: readonly AbilityScoreMethod[];
  level: 1;
  multiclassing: false;
  counts: Record<string, number>;
  classes: readonly CatalogClass[];
  backgrounds: readonly CatalogBackground[];
  species: readonly CatalogSpecies[];
  feats: readonly CatalogFeat[];
  spells: readonly CatalogSpell[];
  equipment: readonly CatalogEquipment[];
  languages: readonly CatalogLanguage[];
}

export type AbilityScoreAssignments = Record<AbilityName, number>;
export type AbilityScoreAdjustments = Partial<Record<AbilityName, number>>;

export interface AbilityScoreRoll {
  dice: [number, number, number, number];
  total: number;
}

export interface AbilityScoreBuild {
  method: AbilityScoreMethod;
  assignments: AbilityScoreAssignments;
  rolls?: AbilityScoreRoll[];
  backgroundAdjustments?: AbilityScoreAdjustments;
}

export interface CharacterCreationChoices {
  languages?: string[];
  backgroundAbilityIncrease?: AbilityScoreAdjustments;
  backgroundTools?: string[];
  classEquipmentId?: string;
  backgroundEquipmentId?: string;
  equipmentChoices?: Record<string, string | string[]>;
  classSkills?: string[];
  classTools?: string[];
  weaponMastery?: string[];
  classChoices?: Record<string, string | string[]>;
  speciesChoices?: Record<string, string | string[]>;
  originFeatId?: string;
  featChoices?: {
    magicInitiate?: {
      spellList: "cleric" | "druid" | "wizard";
      spellcastingAbility: AbilityName;
      cantrips: string[];
      spell: string;
    };
    skilled?: { proficiencies: string[] };
  };
  /** Choices for a second Origin feat, such as Human's additional feat. */
  originFeatChoices?: {
    magicInitiate?: {
      spellList: "cleric" | "druid" | "wizard";
      spellcastingAbility: AbilityName;
      cantrips: string[];
      spell: string;
    };
    skilled?: { proficiencies: string[] };
  };
  spells?: {
    cantrips: string[];
    prepared: string[];
    spellbook?: string[];
  };
  /** Additional level-one choices attached to a class feature. */
  divineOrderCantrip?: string;
  divineOrderSkill?: "arcana" | "religion";
  primalOrderCantrip?: string;
  primalOrderSkill?: "arcana" | "nature";
  pactTomeCantrips?: string[];
  pactTomeRituals?: string[];
  pactBladeWeaponId?: string;
}

export interface CharacterCreationBuild {
  version: typeof CHARACTER_CREATOR_BUILD_VERSION;
  mode: CharacterCreationMode;
  ruleset: RulesetId;
  level: 1;
  name: string;
  classId: string;
  backgroundId: string;
  speciesId: string;
  abilityScores: AbilityScoreBuild;
  choices?: CharacterCreationChoices;
  /** Kept for compatibility with the metadata-only creator slice. */
  subclassId?: null;
}

export interface CharacterCreationValidationError {
  path: string;
  code: string;
  message: string;
}

export interface ValidatedCharacterCreation {
  valid: true;
  rulesComplete: boolean;
  unresolvedChoices: string[];
  build: CharacterCreationBuild;
  errors: [];
}

export interface InvalidCharacterCreation {
  valid: false;
  rulesComplete: false;
  unresolvedChoices: string[];
  errors: CharacterCreationValidationError[];
}

export type CharacterCreationValidation = ValidatedCharacterCreation | InvalidCharacterCreation;

export interface CharacterSheetDerivationOptions {
  generatedAt: string;
}

export interface CharacterCreationCompilation {
  valid: true;
  rulesComplete: boolean;
  unresolvedChoices: string[];
  build: CharacterCreationBuild;
  sheet: CharacterSheet;
  provenance: CharacterSheetProvenance;
}

export interface CharacterCreationCompilationFailure {
  valid: false;
  rulesComplete: false;
  unresolvedChoices: string[];
  errors: CharacterCreationValidationError[];
}

export type CharacterCreationCompilationResult =
  | CharacterCreationCompilation
  | CharacterCreationCompilationFailure;
