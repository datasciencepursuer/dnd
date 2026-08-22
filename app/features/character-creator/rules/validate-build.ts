import { DND_2024_BASIC_CATALOG } from "../data/dnd-2024-basic/catalog";
import {
  getPointBuyCost,
  getPointBuyTotal,
  hasStandardArray,
  hasValidPointBuy,
  isValidRoll,
} from "./ability-scores";
import {
  ABILITY_NAMES,
  CHARACTER_CREATOR_BUILD_VERSION,
  CHARACTER_CREATOR_RULESET,
  type AbilityName,
  type AbilityScoreRoll,
  type AbilityScoreAdjustments,
  type AbilityScoreAssignments,
  type CatalogBackground,
  type CatalogChoice,
  type CatalogChoiceOption,
  type CatalogClass,
  type CatalogSpecies,
  type CharacterCreationBuild,
  type CharacterCreationChoices,
  type CharacterCreationValidation,
  type CharacterCreationValidationError,
  type CharacterCreatorCatalog,
  type RuleDefinitionMetadata,
} from "./types";
import {
  getArtisanToolOrMusicalInstrumentOptions,
  getEquipmentChoiceKey,
  getEquipmentChoiceOptions,
  getMusicalInstrumentOptions,
  getProficientWeaponOptions,
} from "./equipment-choices";

const ALL_SKILLS = [
  "athletics", "acrobatics", "sleight-of-hand", "stealth", "arcana", "history", "investigation", "nature", "religion",
  "animal-handling", "insight", "medicine", "perception", "survival", "deception", "intimidation", "performance", "persuasion",
] as const;

const LEVEL_ONE_INVOCATIONS = [
  "armor-of-shadows",
  "eldritch-mind",
  "pact-of-the-blade",
  "pact-of-the-chain",
  "pact-of-the-tome",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

function collectStringValues(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(collectStringValues);
  if (isRecord(value)) return Object.values(value).flatMap(collectStringValues);
  return [];
}

function collectSkillIds(value: unknown): string[] {
  return collectStringValues(value).filter((entry) => ALL_SKILLS.includes(entry as (typeof ALL_SKILLS)[number]));
}

function pushError(errors: CharacterCreationValidationError[], path: string, code: string, message: string): void {
  errors.push({ path, code, message });
}

function pushUnresolved(unresolved: string[], path: string, message: string): void {
  if (!unresolved.some((entry) => entry.startsWith(`${path}:`))) unresolved.push(`${path}: ${message}`);
}

function hasExactAbilityKeys(value: Record<string, unknown>): value is AbilityScoreAssignments {
  const keys = Object.keys(value).sort();
  return keys.length === ABILITY_NAMES.length && ABILITY_NAMES.every((name) => keys.includes(name));
}

function validateDefinition(
  errors: CharacterCreationValidationError[],
  unresolved: string[],
  catalog: CharacterCreatorCatalog,
  path: string,
  value: unknown,
  entries: readonly RuleDefinitionMetadata[],
  label: string,
): RuleDefinitionMetadata | undefined {
  if (typeof value !== "string" || !value) {
    pushUnresolved(unresolved, path, `Choose a ${label} from the enabled 2024 catalog.`);
    return undefined;
  }
  const entry = entries.find((candidate) => candidate.id === value);
  if (!entry) {
    pushError(errors, path, "unknown-definition", `The selected ${label} is not present in the ${catalog.sourceVersion} catalog.`);
    return undefined;
  }
  if (entry.ruleset !== catalog.id) {
    pushError(errors, path, "cross-ruleset-definition", "The selected option belongs to a different ruleset.");
    return undefined;
  }
  return entry;
}

function optionIds(choice: CatalogChoice, catalog: CharacterCreatorCatalog, classDefinition?: CatalogClass): string[] | null {
  if (Array.isArray(choice.options)) {
    return choice.options.map((option) => typeof option === "string" ? option : option.id ?? option.label);
  }
  switch (choice.options) {
    case "all-skills":
    case "selected-skills":
      return [...ALL_SKILLS];
    case "standard-languages":
    case "all-languages":
    case "standard-or-rare-languages":
      return catalog.languages.map((language) => language.id);
    case "musical-instruments":
      return getMusicalInstrumentOptions(catalog).map((entry) => entry.id);
    case "artisan-tools-or-musical-instruments":
      return getArtisanToolOrMusicalInstrumentOptions(catalog).map((entry) => entry.id);
    case "gaming-sets":
      return catalog.equipment.filter((entry) => (entry.kind === "tool" || entry.kind === "tool-choice") && /gaming set/i.test(entry.displayName)).map((entry) => entry.id);
    case "proficient-weapons":
      return getProficientWeaponOptions(classDefinition, catalog).map((entry) => entry.id);
    case "level-one-invocations":
      return LEVEL_ONE_INVOCATIONS.map((invocation) => `dnd-2024-basic:invocation:${invocation}`);
    case "origin-feats":
      return catalog.feats.filter((feat) => feat.category === "origin").map((feat) => feat.id);
    case "intelligence-wisdom-charisma":
      return ["intelligence", "wisdom", "charisma"];
    default:
      return classDefinition ? [] : null;
  }
}

function validateListChoice(
  errors: CharacterCreationValidationError[],
  unresolved: string[],
  path: string,
  value: unknown,
  choice: CatalogChoice,
  catalog: CharacterCreatorCatalog,
  classDefinition?: CatalogClass,
): string[] {
  if (value === undefined) {
    pushUnresolved(unresolved, path, choice.explanation);
    return [];
  }
  if (!Array.isArray(value)) {
    pushError(errors, path, "invalid-choice-shape", "Choose the requested options as a list.");
    return [];
  }
  const selected = value.filter((entry): entry is string => typeof entry === "string");
  if (selected.length !== value.length) {
    pushError(errors, path, "invalid-choice-value", "Each choice must be a catalog identifier.");
  }
  if (selected.length !== choice.count) {
    pushUnresolved(unresolved, path, `Choose exactly ${choice.count} option${choice.count === 1 ? "" : "s"}.`);
  }
  if (choice.unique && new Set(selected).size !== selected.length) {
    pushError(errors, path, "duplicate-choice", "Choose each option only once.");
  }
  const allowed = optionIds(choice, catalog, classDefinition);
  if (allowed && selected.some((entry) => !allowed.includes(entry))) {
    pushError(errors, path, "illegal-choice", "One or more selected options are not allowed by this rule.");
  }
  return selected;
}

function validateEquipmentPackageChoices(
  errors: CharacterCreationValidationError[],
  unresolved: string[],
  packageDefinition: CatalogClass["startingEquipment"]["packages"][number] | CatalogBackground["startingEquipment"]["packages"][number] | undefined,
  value: unknown,
  catalog: CharacterCreatorCatalog,
  pathPrefix: string,
  linkedToolChoices: readonly string[] = [],
): Record<string, string | string[]> {
  const choiceGrants = packageDefinition?.grants.filter((grant) => grant.type === "equipment-choice") ?? [];
  if (choiceGrants.length === 0) return {};
  if (value !== undefined && !isRecord(value)) {
    pushError(errors, "choices.equipmentChoices", "invalid-shape", "Equipment choices must be an object.");
  }
  const rawChoices = isRecord(value) ? value : {};
  const result: Record<string, string | string[]> = {};
  for (const grant of choiceGrants) {
    const key = getEquipmentChoiceKey(packageDefinition!.id, grant);
    const path = `${pathPrefix}.${key}`;
    const raw = rawChoices[key];
    if (typeof raw !== "string") {
      pushUnresolved(unresolved, path, `Choose the equipment for ${grant.displayName ?? "this package choice"}.`);
      continue;
    }
    const allowed = getEquipmentChoiceOptions(grant, catalog);
    if (!allowed.some((entry) => entry.id === raw)) {
      pushError(errors, path, "illegal-equipment-choice", "Choose equipment from the allowed SRD category.");
      continue;
    }
    const mustMatchLinkedChoice = grant.choiceKey?.includes("chosen-for-the-tool-proficiency") || grant.sourceText?.toLowerCase().includes("same as above");
    if (mustMatchLinkedChoice && linkedToolChoices.length > 0 && !linkedToolChoices.includes(raw)) {
      pushError(errors, path, "equipment-related-choice-mismatch", "Choose the same tool selected for the related proficiency choice.");
      continue;
    }
    result[key] = raw;
  }
  return result;
}

function validateAdjustments(
  errors: CharacterCreationValidationError[],
  unresolved: string[],
  value: unknown,
  allowedAbilities: readonly AbilityName[],
  assignments: AbilityScoreAssignments,
): AbilityScoreAdjustments {
  if (value === undefined) {
    pushUnresolved(unresolved, "choices.backgroundAbilityIncrease", "Choose +2/+1 or +1/+1/+1 from the background's three abilities.");
    return {};
  }
  if (!isRecord(value)) {
    pushError(errors, "choices.backgroundAbilityIncrease", "invalid-shape", "Background ability increases must be an object.");
    return {};
  }
  const result: AbilityScoreAdjustments = {};
  for (const [ability, increase] of Object.entries(value)) {
    if (!ABILITY_NAMES.includes(ability as AbilityName)) {
      pushError(errors, `choices.backgroundAbilityIncrease.${ability}`, "unknown-ability", "Unknown ability.");
    } else if (!allowedAbilities.includes(ability as AbilityName)) {
      pushError(errors, `choices.backgroundAbilityIncrease.${ability}`, "ineligible-ability", "That background cannot increase this ability.");
    } else if (!isInteger(increase) || ![0, 1, 2].includes(increase)) {
      pushError(errors, `choices.backgroundAbilityIncrease.${ability}`, "invalid-increase", "Each increase must be 0, 1, or 2.");
    } else if (increase > 0) {
      result[ability as AbilityName] = increase;
    }
  }
  if (allowedAbilities.length === 0) return result;
  const values = allowedAbilities.map((ability) => result[ability] ?? 0).filter((value) => value > 0);
  const total = values.reduce((sum, value) => sum + value, 0);
  const validPattern = (values.length === 2 && values.includes(2) && values.includes(1)) || (values.length === 3 && values.every((value) => value === 1));
  if (!validPattern || total !== 3) {
    pushError(errors, "choices.backgroundAbilityIncrease", "invalid-increase-pattern", "Use +2/+1 on different eligible abilities or +1 on all three.");
  }
  for (const ability of ABILITY_NAMES) {
    if ((assignments[ability] + (result[ability] ?? 0)) > 20) {
      pushError(errors, `choices.backgroundAbilityIncrease.${ability}`, "ability-cap", "Background increases cannot raise an ability above 20.");
    }
  }
  return result;
}

function validateAbilityScores(
  errors: CharacterCreationValidationError[],
  unresolved: string[],
  value: unknown,
): { method: "standard-array" | "point-buy" | "rolling"; assignments: AbilityScoreAssignments; rolls?: AbilityScoreRoll[] } | null {
  if (!isRecord(value)) {
    pushError(errors, "abilityScores", "required", "Choose a score-generation method and assign all six scores.");
    return null;
  }
  const method = value.method;
  if (method !== "standard-array" && method !== "point-buy" && method !== "rolling") {
    pushError(errors, "abilityScores.method", "unsupported-method", "Use standard array, point buy, or rolling.");
  }
  const assignmentsValue = value.assignments;
  if (!isRecord(assignmentsValue) || !hasExactAbilityKeys(assignmentsValue)) {
    pushError(errors, "abilityScores.assignments", "invalid-shape", "Assign exactly one integer score to each of the six abilities.");
    return null;
  }
  for (const ability of ABILITY_NAMES) {
    if (!isInteger(assignmentsValue[ability]) || assignmentsValue[ability] < 3 || assignmentsValue[ability] > 18) {
      pushError(errors, `abilityScores.assignments.${ability}`, "invalid-score", "Base scores must be whole numbers from 3 to 18.");
    }
  }
  if (method === "standard-array" && !hasStandardArray(assignmentsValue)) {
    pushError(errors, "abilityScores.assignments", "invalid-standard-array", "Standard array must use 15, 14, 13, 12, 10, and 8 exactly once.");
  }
  if (method === "point-buy") {
    const invalidScore = ABILITY_NAMES.find((ability) => getPointBuyCost(assignmentsValue[ability]) === null);
    if (invalidScore) {
      pushError(errors, `abilityScores.assignments.${invalidScore}`, "invalid-point-buy-score", "Point-buy scores must be between 8 and 15.");
    } else if (!hasValidPointBuy(assignmentsValue)) {
      pushError(errors, "abilityScores.assignments", "invalid-point-buy-total", `Point buy must spend exactly 27 points (currently ${getPointBuyTotal(assignmentsValue)}).`);
    }
  }
  let rolls: CharacterCreationBuild["abilityScores"]["rolls"];
  if (method === "rolling") {
    if (value.rolls === undefined) {
      pushUnresolved(unresolved, "abilityScores.rolls", "Roll four d6 and keep the highest three for each of six scores.");
    } else if (!Array.isArray(value.rolls) || value.rolls.length !== 6) {
      pushError(errors, "abilityScores.rolls", "invalid-roll-count", "Rolling requires exactly six four-d6 rolls.");
    } else {
      rolls = [];
      for (const [index, rawRoll] of value.rolls.entries()) {
        if (!isRecord(rawRoll) || !Array.isArray(rawRoll.dice) || rawRoll.dice.length !== 4 || !isInteger(rawRoll.total)) {
          pushError(errors, `abilityScores.rolls.${index}`, "invalid-roll", "Each roll must contain four dice and a kept-highest-three total.");
          continue;
        }
        const roll = { dice: rawRoll.dice, total: rawRoll.total } as AbilityScoreRoll;
        if (!isValidRoll(roll)) pushError(errors, `abilityScores.rolls.${index}`, "invalid-roll", "Each die must be 1–6 and the total must drop the lowest die.");
        rolls.push(roll);
      }
      if (rolls.length === 6) {
        const rolledTotals = rolls.map((roll) => roll.total).sort((a, b) => a - b);
        const assignedTotals = Object.values(assignmentsValue).sort((a, b) => a - b);
        if (rolledTotals.some((score, index) => score !== assignedTotals[index])) {
          pushError(errors, "abilityScores.assignments", "invalid-roll-assignment", "Assigned scores must use the six rolled totals exactly once.");
        }
      }
    }
  }
  return {
    method: method === "point-buy" || method === "rolling" ? method : "standard-array",
    assignments: assignmentsValue,
    ...(rolls ? { rolls } : {}),
  };
}

function validateSpeciesChoices(
  errors: CharacterCreationValidationError[],
  unresolved: string[],
  value: unknown,
  species: CatalogSpecies | undefined,
  catalog: CharacterCreatorCatalog,
): Record<string, string | string[]> {
  const choices = isRecord(value) ? value : {};
  if (value !== undefined && !isRecord(value)) pushError(errors, "choices.speciesChoices", "invalid-shape", "Species choices must be an object.");
  const result: Record<string, string | string[]> = {};
  for (const choice of species?.choices ?? []) {
    const selected = choices[choice.kind];
    if (selected === undefined) {
      pushUnresolved(unresolved, `choices.speciesChoices.${choice.kind}`, choice.explanation);
      continue;
    }
    if (choice.count === 1 && !Array.isArray(selected)) {
      const list = validateListChoice(errors, unresolved, `choices.speciesChoices.${choice.kind}`, [selected], choice, catalog);
      if (list[0]) result[choice.kind] = list[0];
    } else {
      result[choice.kind] = validateListChoice(errors, unresolved, `choices.speciesChoices.${choice.kind}`, selected, choice, catalog);
    }
  }
  return result;
}

function validateClassChoices(
  errors: CharacterCreationValidationError[],
  unresolved: string[],
  value: unknown,
  classDefinition: CatalogClass,
  catalog: CharacterCreatorCatalog,
  selectedSkills: string[],
): Record<string, string | string[]> {
  const choices = isRecord(value) ? value : {};
  if (value !== undefined && !isRecord(value)) pushError(errors, "choices.classChoices", "invalid-shape", "Class choices must be an object.");
  const result: Record<string, string | string[]> = {};
  for (const choice of classDefinition.choices ?? []) {
    if (["skills", "tools", "weapon-mastery"].includes(choice.kind)) continue;
    const selected = choices[choice.kind];
    if (choice.kind === "expertise") {
      const values = validateListChoice(errors, unresolved, `choices.classChoices.${choice.kind}`, selected, choice, catalog, classDefinition);
      if (values.some((skill) => !selectedSkills.includes(skill))) pushError(errors, `choices.classChoices.${choice.kind}`, "expertise-without-proficiency", "Expertise must be chosen from your class or background skill proficiencies.");
      if (values.length > 0) result[choice.kind] = values;
      continue;
    }
    if (choice.count === 1 && typeof selected === "string") {
      const values = validateListChoice(errors, unresolved, `choices.classChoices.${choice.kind}`, [selected], choice, catalog, classDefinition);
      if (values[0]) result[choice.kind] = values[0];
    } else {
      const values = validateListChoice(errors, unresolved, `choices.classChoices.${choice.kind}`, selected, choice, catalog, classDefinition);
      if (values.length > 0) result[choice.kind] = values;
    }
  }
  return result;
}

function validateSpells(
  errors: CharacterCreationValidationError[],
  unresolved: string[],
  value: unknown,
  classDefinition: CatalogClass,
  catalog: CharacterCreatorCatalog,
): { cantrips: string[]; prepared: string[]; spellbook?: string[] } | undefined {
  if (!classDefinition.spellcasting) return undefined;
  if (value === undefined) {
    pushUnresolved(unresolved, "choices.spells", `Choose ${classDefinition.spellcasting.cantrips} cantrips and ${classDefinition.spellcasting.preparedSpells} level-1 spells.`);
    return undefined;
  }
  if (!isRecord(value)) {
    pushError(errors, "choices.spells", "invalid-shape", "Spell choices must be an object.");
    return undefined;
  }
  const cantrips = Array.isArray(value.cantrips) ? value.cantrips.filter((entry): entry is string => typeof entry === "string") : [];
  const prepared = Array.isArray(value.prepared) ? value.prepared.filter((entry): entry is string => typeof entry === "string") : [];
  const spellbook = Array.isArray(value.spellbook) ? value.spellbook.filter((entry): entry is string => typeof entry === "string") : [];
  if (cantrips.length !== classDefinition.spellcasting.cantrips) pushUnresolved(unresolved, "choices.spells.cantrips", `Choose exactly ${classDefinition.spellcasting.cantrips} cantrips.`);
  if (prepared.length !== classDefinition.spellcasting.preparedSpells) pushUnresolved(unresolved, "choices.spells.prepared", `Choose exactly ${classDefinition.spellcasting.preparedSpells} level-1 spells.`);
  if (classDefinition.displayName === "Wizard") {
    if (spellbook.length !== 6) pushUnresolved(unresolved, "choices.spells.spellbook", "Choose six level-1 Wizard spells for your spellbook.");
    if (new Set(spellbook).size !== spellbook.length) pushError(errors, "choices.spells.spellbook", "duplicate-spell", "Choose each spellbook spell only once.");
    for (const spellId of spellbook) {
      const spell = catalog.spells.find((entry) => entry.id === spellId);
      if (!spell || spell.level !== 1 || !spell.classes.includes(classDefinition.id)) pushError(errors, "choices.spells.spellbook", "illegal-spell", "Choose level-1 spells from the Wizard spell list.");
    }
    for (const spellId of prepared) if (!spellbook.includes(spellId)) pushError(errors, "choices.spells.prepared", "spellbook-mismatch", "Prepared Wizard spells must be in your spellbook.");
  }
  if (new Set(cantrips).size !== cantrips.length || new Set(prepared).size !== prepared.length) pushError(errors, "choices.spells", "duplicate-spell", "Choose each spell only once.");
  const classId = classDefinition.id;
  for (const [path, selected, level] of [["choices.spells.cantrips", cantrips, 0], ["choices.spells.prepared", prepared, 1]] as const) {
    for (const spellId of selected) {
      const spell = catalog.spells.find((entry) => entry.id === spellId);
      if (!spell) pushError(errors, path, "unknown-spell", "Choose a spell from the checked-in catalog.");
      else if (spell.level !== level || !spell.classes.includes(classId)) pushError(errors, path, "illegal-spell", "That spell is not on this class's level-1 spell list.");
    }
  }
  return { cantrips, prepared, ...(classDefinition.displayName === "Wizard" ? { spellbook } : {}) };
}

function validateAdditionalClassCantrip(
  errors: CharacterCreationValidationError[],
  unresolved: string[],
  value: unknown,
  classDefinition: CatalogClass,
  catalog: CharacterCreatorCatalog,
  path: string,
): string | undefined {
  if (typeof value !== "string" || !value) {
    pushUnresolved(unresolved, path, "Choose one additional cantrip from the class spell list.");
    return undefined;
  }
  const spell = catalog.spells.find((entry) => entry.id === value);
  if (!spell || spell.level !== 0 || !spell.classes.includes(classDefinition.id)) {
    pushError(errors, path, "illegal-spell", "Choose an additional cantrip from this class's spell list.");
    return undefined;
  }
  return value;
}

function validateClassFeatureSkill(
  errors: CharacterCreationValidationError[],
  unresolved: string[],
  value: unknown,
  allowed: readonly string[],
  path: string,
): string | undefined {
  if (typeof value !== "string" || !value) {
    pushUnresolved(unresolved, path, `Choose one skill: ${allowed.join(" or ")}.`);
    return undefined;
  }
  if (!allowed.includes(value)) {
    pushError(errors, path, "illegal-skill", `Choose one of: ${allowed.join(", ")}.`);
    return undefined;
  }
  return value;
}

function validatePactTomeChoices(
  errors: CharacterCreationValidationError[],
  unresolved: string[],
  value: unknown,
  classDefinition: CatalogClass,
  catalog: CharacterCreatorCatalog,
  alreadyPrepared: readonly string[],
): Pick<CharacterCreationChoices, "pactTomeCantrips" | "pactTomeRituals"> | undefined {
  const raw = isRecord(value) ? value : {};
  const cantrips = Array.isArray(raw.pactTomeCantrips) ? raw.pactTomeCantrips.filter((entry): entry is string => typeof entry === "string") : [];
  const rituals = Array.isArray(raw.pactTomeRituals) ? raw.pactTomeRituals.filter((entry): entry is string => typeof entry === "string") : [];
  if (cantrips.length !== 3) pushUnresolved(unresolved, "choices.classChoices.pactTomeCantrips", "Choose three cantrips for the Book of Shadows.");
  if (rituals.length !== 2) pushUnresolved(unresolved, "choices.classChoices.pactTomeRituals", "Choose two level-1 Ritual spells for the Book of Shadows.");
  if (new Set(cantrips).size !== cantrips.length || new Set(rituals).size !== rituals.length) {
    pushError(errors, "choices.classChoices.pactTome", "duplicate-choice", "Choose each Book of Shadows spell only once.");
  }
  for (const spellId of cantrips) {
    const spell = catalog.spells.find((entry) => entry.id === spellId);
    if (!spell || spell.level !== 0) pushError(errors, "choices.classChoices.pactTomeCantrips", "illegal-spell", "Book of Shadows cantrips must come from the checked-in cantrip catalog.");
  }
  for (const spellId of rituals) {
    const spell = catalog.spells.find((entry) => entry.id === spellId);
    if (!spell || spell.level !== 1 || !spell.ritual) pushError(errors, "choices.classChoices.pactTomeRituals", "illegal-spell", "Book of Shadows spells must be level-1 Ritual spells.");
    if (alreadyPrepared.includes(spellId)) pushError(errors, "choices.classChoices.pactTomeRituals", "prepared-spell-duplicate", "Book of Shadows spells must not already be prepared.");
  }
  return { pactTomeCantrips: cantrips, pactTomeRituals: rituals };
}

function validateFeatChoices(
  errors: CharacterCreationValidationError[],
  unresolved: string[],
  value: unknown,
  featId: string | undefined,
  catalog: CharacterCreatorCatalog,
  backgroundName?: string,
  existingProficiencies: readonly string[] = [],
): CharacterCreationChoices["featChoices"] {
  const choices = isRecord(value) ? value : {};
  if (value !== undefined && !isRecord(value)) pushError(errors, "choices.featChoices", "invalid-shape", "Feat choices must be an object.");
  const feat = featId ? catalog.feats.find((entry) => entry.id === featId) : undefined;
  if (!feat) return undefined;
  if (feat.displayName === "Magic Initiate") {
    const raw = choices.magicInitiate;
    if (!isRecord(raw)) {
      pushUnresolved(unresolved, "choices.featChoices.magicInitiate", "Choose a spell list, spellcasting ability, two cantrips, and one level-1 spell.");
      return undefined;
    }
    const spellList = raw.spellList;
    const expectedList = backgroundName === "Acolyte" ? "cleric" : backgroundName === "Sage" ? "wizard" : undefined;
    if (spellList !== "cleric" && spellList !== "druid" && spellList !== "wizard") pushError(errors, "choices.featChoices.magicInitiate.spellList", "invalid-spell-list", "Choose Cleric, Druid, or Wizard.");
    if (expectedList && spellList !== expectedList) pushError(errors, "choices.featChoices.magicInitiate.spellList", "background-spell-list", `This background's Magic Initiate feat uses the ${expectedList} spell list.`);
    const ability = raw.spellcastingAbility;
    if (!ABILITY_NAMES.includes(ability as AbilityName) || !["intelligence", "wisdom", "charisma"].includes(ability as string)) pushError(errors, "choices.featChoices.magicInitiate.spellcastingAbility", "invalid-spellcasting-ability", "Choose Intelligence, Wisdom, or Charisma.");
    const cantrips = Array.isArray(raw.cantrips) ? raw.cantrips.filter((entry): entry is string => typeof entry === "string") : [];
    if (cantrips.length !== 2) pushUnresolved(unresolved, "choices.featChoices.magicInitiate.cantrips", "Choose two cantrips from the selected spell list.");
    if (new Set(cantrips).size !== cantrips.length) pushError(errors, "choices.featChoices.magicInitiate.cantrips", "duplicate-spell", "Choose each cantrip only once.");
    const classId = spellList ? `dnd-2024-basic:class:${spellList}` : "";
    for (const spellId of cantrips) {
      const spell = catalog.spells.find((entry) => entry.id === spellId);
      if (!spell || spell.level !== 0 || !spell.classes.includes(classId)) pushError(errors, "choices.featChoices.magicInitiate.cantrips", "illegal-spell", "Each cantrip must be on the selected feat spell list.");
    }
    const spell = catalog.spells.find((entry) => entry.id === raw.spell);
    if (!spell || spell.level !== 1 || !spell.classes.includes(classId)) pushError(errors, "choices.featChoices.magicInitiate.spell", "illegal-spell", "Choose one level-1 spell from the selected feat spell list.");
    return {
      magicInitiate: {
        spellList: spellList as "cleric" | "druid" | "wizard",
        spellcastingAbility: ability as AbilityName,
        cantrips,
        spell: typeof raw.spell === "string" ? raw.spell : "",
      },
    };
  }
  if (feat.displayName === "Skilled") {
    const raw = isRecord(choices.skilled) ? choices.skilled : undefined;
    const proficiencies = raw && Array.isArray(raw.proficiencies)
      ? raw.proficiencies.filter((entry): entry is string => typeof entry === "string")
      : [];
    if (proficiencies.length !== 3) pushUnresolved(unresolved, "choices.featChoices.skilled.proficiencies", "Choose three skill or tool proficiencies.");
    if (new Set(proficiencies).size !== proficiencies.length) pushError(errors, "choices.featChoices.skilled.proficiencies", "duplicate-choice", "Choose each proficiency only once.");
    for (const proficiency of proficiencies) {
      const isSkill = ALL_SKILLS.includes(proficiency as (typeof ALL_SKILLS)[number]);
      const isTool = catalog.equipment.some((entry) => entry.id === proficiency && (entry.kind === "tool" || entry.kind === "tool-choice"));
      if (!isSkill && !isTool) pushError(errors, "choices.featChoices.skilled.proficiencies", "unknown-proficiency", "Skilled choices must be skills or checked-in tool proficiencies.");
      if (existingProficiencies.includes(proficiency)) {
        pushError(errors, "choices.featChoices.skilled.proficiencies", "already-proficient", "Choose a skill or tool that is not already granted by the character.");
      }
    }
    if (proficiencies.length > 0) return { skilled: { proficiencies } };
  }
  return undefined;
}

export function validateCharacterBuild(
  value: unknown,
  catalog: CharacterCreatorCatalog = DND_2024_BASIC_CATALOG,
): CharacterCreationValidation {
  const errors: CharacterCreationValidationError[] = [];
  const unresolved: string[] = [];
  if (!isRecord(value)) {
    return { valid: false, rulesComplete: false, unresolvedChoices: [], errors: [{ path: "build", code: "invalid-shape", message: "Guided character build must be an object." }] };
  }
  if (value.version !== CHARACTER_CREATOR_BUILD_VERSION) pushError(errors, "version", "unsupported-version", "This guided creator only accepts build version 1.");
  if (value.mode !== "guided") pushError(errors, "mode", "unsupported-mode", "Only guided player-character builds can use this endpoint.");
  if (value.ruleset !== CHARACTER_CREATOR_RULESET || value.ruleset !== catalog.id) pushError(errors, "ruleset", "unsupported-ruleset", "Use the enabled D&D 2024 Basic/SRD ruleset.");
  if (value.level !== 1) pushError(errors, "level", "unsupported-level", "The first guided creator supports level 1 only.");
  if (Array.isArray(value.classIds) || Array.isArray(value.classes)) pushError(errors, "classId", "multiclass-not-supported", "Multiclassing is not supported in the first guided creator.");
  if (typeof value.name !== "string" || !value.name.trim()) pushUnresolved(unresolved, "name", "Enter a character name.");
  else if (value.name.trim().length > 100) pushError(errors, "name", "too-long", "Name must be 100 characters or fewer.");

  const classDefinition = validateDefinition(errors, unresolved, catalog, "classId", value.classId, catalog.classes, "class") as CatalogClass | undefined;
  const backgroundDefinition = validateDefinition(errors, unresolved, catalog, "backgroundId", value.backgroundId, catalog.backgrounds, "background") as CatalogBackground | undefined;
  const speciesDefinition = validateDefinition(errors, unresolved, catalog, "speciesId", value.speciesId, catalog.species, "species") as CatalogSpecies | undefined;
  if (value.subclassId !== undefined && value.subclassId !== null) pushError(errors, "subclassId", "unsupported-choice", "Subclass selection is deferred beyond level 1.");

  const scores = validateAbilityScores(errors, unresolved, value.abilityScores);
  if (!scores) return { valid: false, rulesComplete: false, unresolvedChoices: unresolved, errors };

  const rawChoices = value.choices;
  if (rawChoices !== undefined && !isRecord(rawChoices)) pushError(errors, "choices", "invalid-shape", "Creation choices must be an object.");
  const choicesValue = isRecord(rawChoices) ? rawChoices : {};
  const choices: CharacterCreationChoices = {};
  const adjustments = validateAdjustments(
    errors,
    unresolved,
    choicesValue.backgroundAbilityIncrease ?? (isRecord(value.abilityScores) ? value.abilityScores.backgroundAdjustments : undefined),
    backgroundDefinition && "abilityScores" in backgroundDefinition ? backgroundDefinition.abilityScores as readonly AbilityName[] : [],
    scores.assignments,
  );
  choices.backgroundAbilityIncrease = adjustments;
  scores.assignments = { ...scores.assignments };

  if (backgroundDefinition && "startingEquipment" in backgroundDefinition) {
    const packageId = choicesValue.backgroundEquipmentId;
    if (typeof packageId !== "string") pushUnresolved(unresolved, "choices.backgroundEquipmentId", "Choose a background equipment package.");
    else if (!backgroundDefinition.startingEquipment.packages.some((entry) => entry.id === packageId)) pushError(errors, "choices.backgroundEquipmentId", "illegal-equipment-package", "Choose a package from the selected background.");
    else choices.backgroundEquipmentId = packageId;
    const backgroundToolChoice = backgroundDefinition.choices?.find((choice) => choice.kind === "tools");
    if (backgroundToolChoice) {
      const values = validateListChoice(errors, unresolved, "choices.backgroundTools", choicesValue.backgroundTools, backgroundToolChoice, catalog);
      if (values.length > 0) choices.backgroundTools = values;
    }
  }
  const equipmentChoices: Record<string, string | string[]> = {};
  if (classDefinition) {
    const packageId = choicesValue.classEquipmentId;
    if (typeof packageId !== "string") pushUnresolved(unresolved, "choices.classEquipmentId", "Choose a class equipment package.");
    else if (!classDefinition.startingEquipment.packages.some((entry) => entry.id === packageId)) pushError(errors, "choices.classEquipmentId", "illegal-equipment-package", "Choose a package from the selected class.");
    else choices.classEquipmentId = packageId;
    const classSkillChoice = classDefinition.choices?.find((choice) => choice.kind === "skills");
    const classSkills = classSkillChoice
      ? validateListChoice(errors, unresolved, "choices.classSkills", choicesValue.classSkills, classSkillChoice, catalog, classDefinition)
      : [];
    if (classSkills.length > 0) choices.classSkills = classSkills;
    const classToolChoice = classDefinition.choices?.find((choice) => choice.kind === "tools");
    if (classToolChoice) {
      const values = validateListChoice(errors, unresolved, "choices.classTools", choicesValue.classTools, classToolChoice, catalog, classDefinition);
      if (values.length > 0) choices.classTools = values;
    }
    const masteryChoice = classDefinition.choices?.find((choice) => choice.kind === "weapon-mastery");
    if (masteryChoice) {
      const values = validateListChoice(errors, unresolved, "choices.weaponMastery", choicesValue.weaponMastery, masteryChoice, catalog, classDefinition);
      if (values.length > 0) choices.weaponMastery = values;
    }
    choices.classChoices = validateClassChoices(
      errors,
      unresolved,
      choicesValue.classChoices,
      classDefinition,
      catalog,
      [...new Set([
        ...(backgroundDefinition?.skillProficiencies ?? []),
        ...classSkills,
        ...collectSkillIds(choicesValue.speciesChoices),
        ...collectSkillIds(choicesValue.featChoices),
        ...collectSkillIds(choicesValue.originFeatChoices),
      ])],
    );
    const rawClassChoices = isRecord(choicesValue.classChoices) ? choicesValue.classChoices : {};
    const divineOrder = choices.classChoices.divineOrder;
    if (classDefinition.displayName === "Cleric" && divineOrder === "Thaumaturge") {
      const cantrip = validateAdditionalClassCantrip(
        errors,
        unresolved,
        rawClassChoices.divineOrderCantrip ?? choicesValue.divineOrderCantrip,
        classDefinition,
        catalog,
        "choices.classChoices.divineOrderCantrip",
      );
      if (cantrip) choices.divineOrderCantrip = cantrip;
      const skill = validateClassFeatureSkill(
        errors,
        unresolved,
        rawClassChoices.divineOrderSkill ?? choicesValue.divineOrderSkill,
        ["arcana", "religion"],
        "choices.divineOrderSkill",
      );
      if (skill) choices.divineOrderSkill = skill as "arcana" | "religion";
    }
    const primalOrder = choices.classChoices.primalOrder;
    if (classDefinition.displayName === "Druid" && primalOrder === "Magician") {
      const cantrip = validateAdditionalClassCantrip(
        errors,
        unresolved,
        rawClassChoices.primalOrderCantrip ?? choicesValue.primalOrderCantrip,
        classDefinition,
        catalog,
        "choices.classChoices.primalOrderCantrip",
      );
      if (cantrip) choices.primalOrderCantrip = cantrip;
      const skill = validateClassFeatureSkill(
        errors,
        unresolved,
        rawClassChoices.primalOrderSkill ?? choicesValue.primalOrderSkill,
        ["arcana", "nature"],
        "choices.primalOrderSkill",
      );
      if (skill) choices.primalOrderSkill = skill as "arcana" | "nature";
    }
    const invocation = choices.classChoices.eldritchInvocation;
    if (classDefinition.displayName === "Warlock" && typeof invocation === "string" && invocation.endsWith(":pact-of-the-tome")) {
      const rawPreparedSpells = isRecord(choicesValue.spells) && Array.isArray(choicesValue.spells.prepared)
        ? choicesValue.spells.prepared.filter((entry): entry is string => typeof entry === "string")
        : [];
      const pactTome = validatePactTomeChoices(
        errors,
        unresolved,
        { ...rawClassChoices, pactTomeCantrips: rawClassChoices.pactTomeCantrips ?? choicesValue.pactTomeCantrips, pactTomeRituals: rawClassChoices.pactTomeRituals ?? choicesValue.pactTomeRituals },
        classDefinition,
        catalog,
        rawPreparedSpells,
      );
      if (pactTome) {
        choices.pactTomeCantrips = pactTome.pactTomeCantrips;
        choices.pactTomeRituals = pactTome.pactTomeRituals;
      }
    }
    if (classDefinition.displayName === "Warlock" && invocation === "dnd-2024-basic:invocation:pact-of-the-blade") {
      const pactBladeWeaponId = typeof choicesValue.pactBladeWeaponId === "string"
        ? choicesValue.pactBladeWeaponId
        : typeof rawClassChoices.pactBladeWeaponId === "string"
          ? rawClassChoices.pactBladeWeaponId
          : undefined;
      if (!pactBladeWeaponId) {
        pushUnresolved(unresolved, "choices.pactBladeWeaponId", "Choose the Simple or Martial melee weapon you bond as your pact weapon.");
      } else {
        const pactWeapon = catalog.equipment.find((entry) => entry.id === pactBladeWeaponId);
        if (!pactWeapon || pactWeapon.kind !== "weapon" || !pactWeapon.weaponCategory?.includes("Melee")) {
          pushError(errors, "choices.pactBladeWeaponId", "illegal-pact-weapon", "Pact of the Blade requires a Simple or Martial melee weapon.");
        } else {
          choices.pactBladeWeaponId = pactBladeWeaponId;
        }
      }
    }
    const extraLanguage = choices.classChoices.language;
    const submittedBaseLanguages = Array.isArray(choicesValue.languages)
      ? choicesValue.languages.filter((entry): entry is string => typeof entry === "string")
      : [];
    if (typeof extraLanguage === "string" && submittedBaseLanguages.includes(extraLanguage)) {
      pushError(errors, "choices.classChoices.language", "duplicate-language", "The additional class language must be different from your base languages.");
    }
    const spells = validateSpells(errors, unresolved, choicesValue.spells, classDefinition, catalog);
    if (spells) choices.spells = spells;
    const selectedTools = choices.classTools ?? [];
    const classPackage = classDefinition.startingEquipment.packages.find((entry) => entry.id === choices.classEquipmentId);
    Object.assign(
      equipmentChoices,
      validateEquipmentPackageChoices(errors, unresolved, classPackage, choicesValue.equipmentChoices, catalog, "choices.equipmentChoices", selectedTools),
    );
  }

  const backgroundPackage = backgroundDefinition?.startingEquipment.packages.find((entry) => entry.id === choices.backgroundEquipmentId);
  Object.assign(
    equipmentChoices,
    validateEquipmentPackageChoices(errors, unresolved, backgroundPackage, choicesValue.equipmentChoices, catalog, "choices.equipmentChoices", choices.backgroundTools ?? []),
  );
  if (Object.keys(equipmentChoices).length > 0) choices.equipmentChoices = equipmentChoices;

  const languagesChoice = choicesValue.languages;
  if (!Array.isArray(languagesChoice)) {
    pushUnresolved(unresolved, "choices.languages", catalog.languagePolicy.explanation);
  } else {
    const languages = languagesChoice.filter((entry): entry is string => typeof entry === "string");
    const fixedLanguages = catalog.languagePolicy.fixed;
    const fixed = fixedLanguages[0];
    const standardChoices = catalog.languages
      .filter((language) => language.category === "standard" && !fixedLanguages.includes(language.id))
      .map((language) => language.id);
    if (
      languages.length !== fixedLanguages.length + catalog.languagePolicy.choose ||
      fixedLanguages.some((language) => !languages.includes(language))
    ) {
      pushUnresolved(unresolved, "choices.languages", catalog.languagePolicy.explanation);
    }
    if (new Set(languages).size !== languages.length) pushError(errors, "choices.languages", "duplicate-language", "Choose each language only once.");
    for (const languageId of languages) {
      if (!catalog.languages.some((entry) => entry.id === languageId)) {
        pushError(errors, "choices.languages", "unknown-language", "Choose languages from the checked-in language table.");
      } else if (languageId !== fixed && !standardChoices.includes(languageId)) {
        pushError(errors, "choices.languages", "illegal-language", "Base languages must come from the Standard Languages table.");
      }
    }
    choices.languages = languages;
  }

  const classSkills = choices.classSkills ?? [];
  const speciesChoices = validateSpeciesChoices(errors, unresolved, choicesValue.speciesChoices, speciesDefinition, catalog);
  if (Object.keys(speciesChoices).length > 0) choices.speciesChoices = speciesChoices;

  const featId = backgroundDefinition && "originFeatId" in backgroundDefinition ? backgroundDefinition.originFeatId : undefined;
  if (featId) choices.originFeatId = featId;
  const fixedClassToolIds = classDefinition?.toolProficiencies
    ? catalog.equipment
      .filter((entry) => (entry.kind === "tool" || entry.kind === "tool-choice") && classDefinition.toolProficiencies?.toLowerCase().includes(entry.displayName.toLowerCase()))
      .map((entry) => entry.id)
    : [];
  const existingProficiencies = [
    ...(backgroundDefinition?.skillProficiencies ?? []),
    ...classSkills,
    ...collectSkillIds(choicesValue.speciesChoices),
    ...collectSkillIds(choicesValue.classChoices),
    ...fixedClassToolIds,
    ...(backgroundDefinition?.toolProficiencies ?? []),
    ...(choices.backgroundTools ?? []),
    ...(choices.classTools ?? []),
  ];
  const featChoices = validateFeatChoices(
    errors,
    unresolved,
    choicesValue.featChoices,
    featId,
    catalog,
    backgroundDefinition?.displayName,
    existingProficiencies,
  );
  if (featChoices) choices.featChoices = featChoices;
  if (speciesDefinition?.displayName === "Human") {
    const humanOriginFeatId = typeof choicesValue.originFeatId === "string"
      ? choicesValue.originFeatId
      : typeof speciesChoices.originFeat === "string"
        ? speciesChoices.originFeat
        : undefined;
    if (!humanOriginFeatId) pushUnresolved(unresolved, "choices.originFeatId", "Choose the additional Human Origin feat.");
    else if (!catalog.feats.some((feat) => feat.id === humanOriginFeatId && feat.category === "origin")) pushError(errors, "choices.originFeatId", "illegal-feat", "Choose an Origin feat for Human versatility.");
    else {
      choices.originFeatId = humanOriginFeatId;
      const originFeatChoices = validateFeatChoices(
        errors,
        unresolved,
        choicesValue.originFeatChoices,
        humanOriginFeatId,
        catalog,
        undefined,
        [...existingProficiencies, ...(featChoices?.skilled?.proficiencies ?? [])],
      );
      if (originFeatChoices) choices.originFeatChoices = originFeatChoices;
    }
    if (choices.originFeatId === featId) {
      pushError(errors, "choices.originFeatId", "duplicate-feat", "Human's additional Origin feat must be different from the background feat.");
    }
    const firstMagicInitiate = choices.featChoices?.magicInitiate;
    const secondMagicInitiate = choices.originFeatChoices?.magicInitiate;
    if (firstMagicInitiate && secondMagicInitiate && firstMagicInitiate.spellList === secondMagicInitiate.spellList) {
      pushError(errors, "choices.originFeatChoices.magicInitiate.spellList", "duplicate-spell-list", "Each Magic Initiate feat must use a different spell list.");
    }
    if (!choices.speciesChoices?.skill) pushUnresolved(unresolved, "choices.speciesChoices.skill", "Choose the Human skill proficiency.");
  }
  if (backgroundDefinition?.originFeatId === "dnd-2024-basic:feat:magic-initiate" && !choices.featChoices?.magicInitiate) {
    pushUnresolved(unresolved, "choices.featChoices.magicInitiate", "Resolve Magic Initiate's spell list, ability, cantrips, and spell.");
  }
  if (backgroundDefinition?.originFeatId === "dnd-2024-basic:feat:skilled" && !choices.featChoices?.skilled) {
    pushUnresolved(unresolved, "choices.featChoices.skilled", "Resolve Skilled's three proficiency choices.");
  }

  const build: CharacterCreationBuild = {
    version: CHARACTER_CREATOR_BUILD_VERSION,
    mode: "guided",
    ruleset: CHARACTER_CREATOR_RULESET,
    level: 1,
    name: typeof value.name === "string" ? value.name.trim() : "",
    classId: typeof value.classId === "string" ? value.classId : "",
    backgroundId: typeof value.backgroundId === "string" ? value.backgroundId : "",
    speciesId: typeof value.speciesId === "string" ? value.speciesId : "",
    abilityScores: {
      method: scores.method,
      assignments: scores.assignments,
      ...(scores.rolls ? { rolls: scores.rolls } : {}),
      backgroundAdjustments: adjustments,
    },
    choices,
    ...(value.subclassId === null ? { subclassId: null } : {}),
  };
  if (errors.length > 0) return { valid: false, rulesComplete: false, unresolvedChoices: unresolved, errors };
  return { valid: true, rulesComplete: unresolved.length === 0, unresolvedChoices: unresolved, build, errors: [] };
}
