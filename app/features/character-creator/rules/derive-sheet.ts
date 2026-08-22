import type {
  AbilityScore,
  CharacterSheet,
  CharacterSheetProvenance,
  ClassFeature,
  Equipment,
  SkillLevel,
  Spell,
  Weapon,
} from "~/features/map-editor/types";
import {
  calculateModifier,
  calculateProficiencyBonus,
  calculateSkillModifier,
  createDefaultCharacterSheet,
  createDefaultSkills,
  createDefaultSpeed,
  SKILL_ABILITIES,
} from "~/features/map-editor/utils/character-utils";
import { DND_2024_BASIC_CATALOG } from "../data/dnd-2024-basic/catalog";
import { applyAbilityScoreAdjustments } from "./ability-scores";
import { getEquipmentChoiceKey } from "./equipment-choices";
import type {
  AbilityName,
  CatalogClass,
  CatalogEquipment,
  CatalogEquipmentPackage,
  CatalogSpell,
  CatalogSpecies,
  CharacterCreationBuild,
  CharacterCreationChoices,
  CharacterCreatorCatalog,
} from "./types";

const RUNTIME_NOT_MODELED = [
  "higher-level progression and subclass gates",
  "manual overrides made after guided creation",
];

type SpellcastingAbility = NonNullable<CharacterSheet["spellcastingAbility"]>;

function toSpellcastingAbility(value: AbilityName | undefined): SpellcastingAbility | null {
  return value === "intelligence" || value === "wisdom" || value === "charisma" ? value : null;
}

function toAbilityScore(score: number, savingThrowProficient = false): AbilityScore {
  return { score, modifier: calculateModifier(score), savingThrowProficient };
}

function skillKey(value: string): keyof typeof SKILL_ABILITIES | null {
  const map: Record<string, keyof typeof SKILL_ABILITIES> = {
    athletics: "athletics",
    acrobatics: "acrobatics",
    "sleight-of-hand": "sleightOfHand",
    stealth: "stealth",
    arcana: "arcana",
    history: "history",
    investigation: "investigation",
    nature: "nature",
    religion: "religion",
    "animal-handling": "animalHandling",
    insight: "insight",
    medicine: "medicine",
    perception: "perception",
    survival: "survival",
    deception: "deception",
    intimidation: "intimidation",
    performance: "performance",
    persuasion: "persuasion",
  };
  return map[value] ?? null;
}

function markSkill(skills: CharacterSheet["skills"], value: string, level: SkillLevel = "proficient"): void {
  const key = skillKey(value);
  if (!key) return;
  if (skills[key] === "expertise" || (skills[key] === "proficient" && level === "proficient")) return;
  skills[key] = level;
}

function findEquipment(catalog: CharacterCreatorCatalog, equipmentId?: string, displayName?: string): CatalogEquipment | undefined {
  return catalog.equipment.find((entry) => equipmentId ? entry.id === equipmentId : entry.displayName === displayName);
}

function addPackage(
  packageDefinition: CatalogEquipmentPackage | undefined,
  catalog: CharacterCreatorCatalog,
  equipment: Equipment[],
  weapons: Weapon[],
  coins: CharacterSheet["coins"],
  equipmentChoices: CharacterCreationChoices["equipmentChoices"],
): void {
  if (!packageDefinition) return;
  for (const grant of packageDefinition.grants) {
    if (grant.type === "coins" && grant.currency && grant.amount) {
      const currency = grant.currency as keyof CharacterSheet["coins"];
      if (currency in coins) coins[currency] += grant.amount;
      continue;
    }
    const selectedEquipmentId = grant.type === "equipment-choice"
      ? equipmentChoices?.[getEquipmentChoiceKey(packageDefinition.id, grant)]
      : grant.equipmentId;
    if (typeof selectedEquipmentId !== "string") continue;
    const definition = findEquipment(catalog, selectedEquipmentId, grant.displayName);
    if (!definition) continue;
    const quantity = grant.quantity ?? 1;
    const item: Equipment = {
      id: definition.id,
      name: definition.displayName,
      quantity,
      equipped: definition.kind === "armor" || definition.kind === "weapon",
      charges: null,
      recharge: "none",
      notes: definition.kind === "weapon" ? `${definition.damage ?? ""} ${definition.mastery ?? ""}`.trim() : "",
    };
    equipment.push(item);
    if (definition.kind === "weapon") {
      const damage = definition.damage ?? "1d4 Bludgeoning";
      const [dice, ...damageParts] = damage.split(" ");
      weapons.push({
        id: definition.id,
        name: definition.displayName,
        bonus: 0,
        dice,
        damageType: damageParts.join(" ") || "Physical",
        notes: `${definition.properties?.join(", ") ?? ""}${definition.mastery ? ` · Mastery: ${definition.mastery}` : ""}`.trim(),
      });
    }
  }
}

function applyEquipmentDerivedValues(
  sheet: CharacterSheet,
  catalog: CharacterCreatorCatalog,
  classDefinition: CatalogClass | undefined,
): void {
  const armor = sheet.equipment
    .map((item) => findEquipment(catalog, item.id))
    .find((entry) => entry?.kind === "armor" && entry.armorCategory !== "Shield");
  const shield = sheet.equipment.some((item) => /shield/i.test(item.name));
  sheet.shield = shield;
  if (armor) {
    const base = Number(armor.armorClass?.match(/^\d+/)?.[0] ?? 10);
    const hasDex = /Dexterity modifier/i.test(armor.armorClass ?? "");
    const dexCap = Number(armor.armorClass?.match(/max (\d+)/i)?.[1] ?? 99);
    sheet.ac = base + (hasDex ? Math.min(sheet.abilities.dexterity.modifier, dexCap) : 0) + (shield ? 2 : 0);
    return;
  }
  const dex = sheet.abilities.dexterity.modifier;
  const constitution = sheet.abilities.constitution.modifier;
  const wisdom = sheet.abilities.wisdom.modifier;
  if (classDefinition?.displayName === "Barbarian") sheet.ac = 10 + dex + constitution + (shield ? 2 : 0);
  else if (classDefinition?.displayName === "Monk") sheet.ac = 10 + dex + wisdom;
  else sheet.ac = 10 + dex + (shield ? 2 : 0);
}

function spellFromCatalog(definition: CatalogSpell): Spell {
  return {
    id: definition.id,
    level: definition.level,
    name: definition.displayName,
    concentration: definition.concentration,
    range: definition.range ?? "Self",
    material: definition.components ?? "",
    notes: `${definition.school}${definition.ritual ? " · Ritual" : ""}`,
  };
}

function addSpellById(sheet: CharacterSheet, catalog: CharacterCreatorCatalog, spellId: string): void {
  const definition = catalog.spells.find((entry) => entry.id === spellId);
  if (!definition || sheet.spells.some((spell) => spell.id === spellId)) return;
  sheet.spells.push(spellFromCatalog(definition));
}

function selectedSpeciesEffects(
  species: CatalogSpecies | undefined,
  choices: CharacterCreationChoices,
): { traits: string[]; spellIds: string[]; damageResistances: string[]; abilities: Array<{ id: string; name: string; description: string }>; speed?: number; size?: "S" | "M" } {
  if (!species) return { traits: [], spellIds: [], damageResistances: [], abilities: [] };
  const traits = species.traits.map((trait) => trait.displayName);
  const spellIds: string[] = [];
  const damageResistances: string[] = [];
  const abilities: Array<{ id: string; name: string; description: string }> = [];
  let speed = species.speed.walk;
  let size = species.size[0];
  for (const choice of species.choices ?? []) {
    const selected = choices.speciesChoices?.[choice.kind];
    const selectedValues = Array.isArray(selected) ? selected : selected ? [selected] : [];
    if (choice.kind === "size" && selectedValues[0] === "small") size = "S";
    const options = Array.isArray(choice.options) ? choice.options : [];
    for (const option of options) {
      if (typeof option === "string" || !selectedValues.includes(option.id)) continue;
      traits.push(option.label);
      for (const grant of option.grants ?? []) spellIds.push(`dnd-2024-basic:spell:${grant}`);
      for (const effect of option.effects ?? []) {
        if (effect.type === "speed" && typeof effect.walk === "number") speed = effect.walk;
        if (effect.type === "damage-resistance" && typeof effect.damageType === "string") damageResistances.push(effect.damageType);
        if (effect.type === "species-ability" && typeof effect.description === "string") {
          abilities.push({
            id: `${species.id}:${choice.kind}:${option.id}`,
            name: option.label,
            description: effect.description,
          });
        }
      }
    }
  }
  return { traits, spellIds, damageResistances: [...new Set(damageResistances)], abilities, speed, size };
}

function selectedOriginFeats(
  build: CharacterCreationBuild,
  background: CharacterCreatorCatalog["backgrounds"][number] | undefined,
  species: CatalogSpecies | undefined,
  catalog: CharacterCreatorCatalog,
): string[] {
  const feats: string[] = [];
  if (background?.originFeatId) feats.push(background.originFeatId);
  if (species?.displayName === "Human" && build.choices?.originFeatId) feats.push(build.choices.originFeatId);
  if (build.choices?.classChoices?.fightingStyle) {
    const selected = build.choices.classChoices.fightingStyle;
    if (typeof selected === "string") feats.push(`dnd-2024-basic:feat:${selected.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`);
  }
  return feats.filter((featId, index) => feats.indexOf(featId) === index && catalog.feats.some((feat) => feat.id === featId));
}

export function deriveCharacterSheet(
  build: CharacterCreationBuild,
  options: { generatedAt: string; rulesComplete?: boolean; unresolvedChoices?: string[] },
  catalog: CharacterCreatorCatalog = DND_2024_BASIC_CATALOG,
): CharacterSheet {
  const classDefinition = catalog.classes.find((entry) => entry.id === build.classId);
  const backgroundDefinition = catalog.backgrounds.find((entry) => entry.id === build.backgroundId);
  const speciesDefinition = catalog.species.find((entry) => entry.id === build.speciesId);
  const generatedAtMs = Date.parse(options.generatedAt);
  const sheet = createDefaultCharacterSheet(Number.isNaN(generatedAtMs) ? 0 : generatedAtMs);
  const assignments = build.abilityScores.assignments;
  const finalAssignments = applyAbilityScoreAdjustments(assignments, build.abilityScores.backgroundAdjustments);
  const choices = build.choices ?? {};
  const speciesEffects = selectedSpeciesEffects(speciesDefinition, choices);

  const abilities: CharacterSheet["abilities"] = {
    strength: toAbilityScore(finalAssignments.strength, classDefinition?.savingThrowProficiencies.includes("strength")),
    dexterity: toAbilityScore(finalAssignments.dexterity, classDefinition?.savingThrowProficiencies.includes("dexterity")),
    constitution: toAbilityScore(finalAssignments.constitution, classDefinition?.savingThrowProficiencies.includes("constitution")),
    intelligence: toAbilityScore(finalAssignments.intelligence, classDefinition?.savingThrowProficiencies.includes("intelligence")),
    wisdom: toAbilityScore(finalAssignments.wisdom, classDefinition?.savingThrowProficiencies.includes("wisdom")),
    charisma: toAbilityScore(finalAssignments.charisma, classDefinition?.savingThrowProficiencies.includes("charisma")),
  };
  sheet.background = backgroundDefinition?.displayName ?? null;
  sheet.characterClass = classDefinition?.displayName ?? null;
  sheet.subclass = null;
  sheet.race = speciesDefinition?.displayName ?? null;
  sheet.level = 1;
  sheet.experience = 0;
  sheet.proficiencyBonus = calculateProficiencyBonus(sheet.level);
  sheet.abilities = abilities;
  sheet.speed = createDefaultSpeed(speciesEffects.speed ?? speciesDefinition?.speed.walk ?? 30);
  sheet.creatureSize = speciesEffects.size ?? speciesDefinition?.size[0] ?? "M";
  sheet.speciesTraits = speciesEffects.traits.join(", ");
  if (speciesEffects.damageResistances.length > 0) {
    sheet.damageResistances = speciesEffects.damageResistances;
    sheet.speciesTraits = [sheet.speciesTraits, `Damage Resistance: ${speciesEffects.damageResistances.join(", ")}`].filter(Boolean).join(", ");
  }
  if (speciesEffects.abilities.length > 0) {
    sheet.speciesAbilities = speciesEffects.abilities;
    sheet.speciesTraits = [sheet.speciesTraits, ...speciesEffects.abilities.map((ability) => `${ability.name}: ${ability.description}`)].filter(Boolean).join(", ");
  }
  sheet.skills = createDefaultSkills();
  for (const skill of backgroundDefinition?.skillProficiencies ?? []) markSkill(sheet.skills, skill);
  for (const skill of choices.classSkills ?? []) markSkill(sheet.skills, skill);
  for (const skill of choices.speciesChoices?.skill ? [choices.speciesChoices.skill] : []) markSkill(sheet.skills, skill as string);
  for (const skill of choices.speciesChoices?.keenSenses ? [choices.speciesChoices.keenSenses] : []) markSkill(sheet.skills, skill as string);
  for (const skill of choices.classChoices?.expertise && Array.isArray(choices.classChoices.expertise) ? choices.classChoices.expertise : []) markSkill(sheet.skills, skill, "expertise");
  const skilled = choices.featChoices?.skilled?.proficiencies ?? [];
  for (const proficiency of skilled) markSkill(sheet.skills, proficiency);
  const classFeatureBonus = Math.max(1, sheet.abilities.wisdom.modifier);
  const bonusSkill = classDefinition?.displayName === "Cleric"
    ? choices.divineOrderSkill
    : classDefinition?.displayName === "Druid"
      ? choices.primalOrderSkill
      : undefined;
  const bonusSkillKey = bonusSkill ? skillKey(bonusSkill) : null;
  if (bonusSkillKey) sheet.skillBonuses = { [bonusSkillKey]: classFeatureBonus };
  const languageNames = (choices.languages ?? []).map((languageId) => catalog.languages.find((language) => language.id === languageId)?.displayName ?? languageId);
  const additionalClassLanguage = typeof choices.classChoices?.language === "string"
    ? catalog.languages.find((language) => language.id === choices.classChoices?.language)?.displayName ?? choices.classChoices.language
    : undefined;
  if (additionalClassLanguage) languageNames.push(additionalClassLanguage);
  if (classDefinition?.displayName === "Rogue") languageNames.push("Thieves' Cant");
  sheet.languages = [...new Set(languageNames)].join(", ");
  sheet.armorProficiencies = {
    light: /Light/i.test(classDefinition?.armorTraining ?? ""),
    medium: /Medium/i.test(classDefinition?.armorTraining ?? ""),
    heavy: /Heavy/i.test(classDefinition?.armorTraining ?? ""),
    shields: /Shield/i.test(classDefinition?.armorTraining ?? ""),
  };
  sheet.weaponProficiencies = classDefinition?.weaponProficiencies ?? "";
  const classChoiceValues = choices.classChoices ?? {};
  if (classDefinition?.displayName === "Cleric" && classChoiceValues.divineOrder === "Protector") {
    sheet.armorProficiencies.heavy = true;
    sheet.weaponProficiencies = [sheet.weaponProficiencies, "Martial weapons (Divine Order: Protector)"].filter(Boolean).join(", ");
  }
  if (classDefinition?.displayName === "Druid" && classChoiceValues.primalOrder === "Warden") {
    sheet.armorProficiencies.medium = true;
    sheet.weaponProficiencies = [sheet.weaponProficiencies, "Martial weapons (Primal Order: Warden)"].filter(Boolean).join(", ");
  }
  if (classDefinition?.displayName === "Warlock" && classChoiceValues.eldritchInvocation === "dnd-2024-basic:invocation:pact-of-the-blade") {
    sheet.weaponProficiencies = [sheet.weaponProficiencies, "Pact weapon (Charisma attack and damage option)"].filter(Boolean).join(", ");
  }
  const chosenToolIds = [
    ...(choices.backgroundTools ?? []),
    ...(choices.classTools ?? []),
  ];
  const chosenToolNames = chosenToolIds.map((toolId) => findEquipment(catalog, toolId)?.displayName ?? toolId);
  const skilledToolNames = skilled
    .map((proficiency) => findEquipment(catalog, proficiency))
    .filter((entry): entry is CatalogEquipment => Boolean(entry && (entry.kind === "tool" || entry.kind === "tool-choice")))
    .map((entry) => entry.displayName);
  sheet.toolProficiencies = [backgroundDefinition?.toolProficiencies.join(", "), classDefinition?.toolProficiencies ?? "", ...chosenToolNames, ...skilledToolNames].filter(Boolean).join(", ");

  const coins = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
  const equipment: Equipment[] = [];
  const weapons: Weapon[] = [];
  const classPackage = classDefinition?.startingEquipment.packages.find((entry) => entry.id === choices.classEquipmentId);
  const backgroundPackage = backgroundDefinition?.startingEquipment.packages.find((entry) => entry.id === choices.backgroundEquipmentId);
  addPackage(classPackage, catalog, equipment, weapons, coins, choices.equipmentChoices);
  addPackage(backgroundPackage, catalog, equipment, weapons, coins, choices.equipmentChoices);
  if (classChoiceValues.eldritchInvocation === "dnd-2024-basic:invocation:pact-of-the-blade" && choices.pactBladeWeaponId && !weapons.some((weapon) => weapon.id === choices.pactBladeWeaponId)) {
    const pactWeapon = findEquipment(catalog, choices.pactBladeWeaponId);
    if (pactWeapon?.kind === "weapon") {
      const [dice, ...damageParts] = (pactWeapon.damage ?? "1d4 Bludgeoning").split(" ");
      weapons.push({
        id: pactWeapon.id,
        name: pactWeapon.displayName,
        bonus: 0,
        dice,
        damageType: damageParts.join(" ") || "Physical",
        notes: `Pact weapon${pactWeapon.properties?.length ? ` · ${pactWeapon.properties.join(", ")}` : ""}`,
      });
    }
  }
  sheet.equipment = equipment;
  sheet.weapons = weapons;
  sheet.coins = coins;
  applyEquipmentDerivedValues(sheet, catalog, classDefinition);
  const fightingStyle = classChoiceValues.fightingStyle;
  if (fightingStyle === "Defense" && sheet.equipment.some((item) => {
    const itemDefinition = findEquipment(catalog, item.id);
    return itemDefinition?.kind === "armor" && itemDefinition.armorCategory !== "Shield";
  })) {
    sheet.ac += 1;
  }
  if (typeof fightingStyle === "string" && fightingStyle !== "Defense") {
    const styleFeature = sheet.classFeatures.find((feature) => feature.id.endsWith(":fightingStyle"));
    if (styleFeature) styleFeature.name = `${styleFeature.name} · ${fightingStyle}`;
  }
  sheet.weaponMasteries = (choices.weaponMastery ?? [])
    .map((weaponId) => findEquipment(catalog, weaponId)?.displayName ?? weaponId);
  for (const weapon of sheet.weapons) {
    const definition = findEquipment(catalog, weapon.id);
    const finesse = definition?.properties?.some((property) => property.startsWith("Finesse"));
    const isPactBladeWeapon = classChoiceValues.eldritchInvocation === "dnd-2024-basic:invocation:pact-of-the-blade" && weapon.id === choices.pactBladeWeaponId;
    const ability = isPactBladeWeapon
      ? sheet.abilities.charisma.modifier
      : finesse
        ? Math.max(sheet.abilities.dexterity.modifier, sheet.abilities.strength.modifier)
        : /Ranged|Thrown/.test(definition?.properties?.join(" ") ?? "")
          ? sheet.abilities.dexterity.modifier
          : sheet.abilities.strength.modifier;
    weapon.bonus = ability + sheet.proficiencyBonus + (fightingStyle === "Archery" && definition?.weaponCategory?.includes("Ranged") ? 2 : 0);
    if (isPactBladeWeapon) weapon.notes = [weapon.notes, "Pact of the Blade: Charisma attack and damage"].filter(Boolean).join(" · ");
    if (fightingStyle === "Great Weapon Fighting") weapon.notes = [weapon.notes, "Great Weapon Fighting: reroll 1 or 2 on eligible damage dice"].filter(Boolean).join(" · ");
    if (fightingStyle === "Two-Weapon Fighting") weapon.notes = [weapon.notes, "Two-Weapon Fighting: add ability modifier to eligible Light extra attacks"].filter(Boolean).join(" · ");
  }
  const hitDie = classDefinition?.hitDie ?? 8;
  const toughness = speciesDefinition?.displayName === "Dwarf" ? 1 : 0;
  sheet.hitDice = `1d${hitDie}`;
  sheet.hpMax = Math.max(1, hitDie + sheet.abilities.constitution.modifier + toughness);
  sheet.hpCurrent = sheet.hpMax;
  sheet.initiative = sheet.abilities.dexterity.modifier;
  if (selectedOriginFeats(build, backgroundDefinition, speciesDefinition, catalog).includes("dnd-2024-basic:feat:alert")) sheet.initiative += sheet.proficiencyBonus;
  sheet.passivePerception = 10 + calculateSkillModifier(sheet, "perception");
  sheet.classFeatures = (classDefinition?.features ?? []).map((feature): ClassFeature => ({
    id: feature.id,
    name: feature.name,
    category: "limitedUse",
    charges: null,
    recharge: "none",
  }));
  for (const [key, value] of Object.entries(classChoiceValues)) {
    const values = Array.isArray(value) ? value.join(", ") : value;
    sheet.classFeatures.push({ id: `${classDefinition?.id ?? "class"}:${key}`, name: `${key}: ${values}`, category: "limitedUse", charges: null, recharge: "none" });
  }
  if (classDefinition?.displayName === "Cleric" && classChoiceValues.divineOrder === "Thaumaturge") {
    sheet.classFeatures.push({ id: `${classDefinition.id}:divine-order-thaumaturge`, name: "Thaumaturge: bonus to Arcana or Religion checks equal to Wisdom modifier (minimum +1)", category: "limitedUse", charges: null, recharge: "none" });
  }
  if (classDefinition?.displayName === "Druid" && classChoiceValues.primalOrder === "Magician") {
    sheet.classFeatures.push({ id: `${classDefinition.id}:primal-order-magician`, name: "Magician: bonus to Arcana or Nature checks equal to Wisdom modifier (minimum +1)", category: "limitedUse", charges: null, recharge: "none" });
  }
  if (classDefinition?.displayName === "Warlock" && typeof classChoiceValues.eldritchInvocation === "string") {
    const invocationLabels: Record<string, string> = {
      "dnd-2024-basic:invocation:armor-of-shadows": "Armor of Shadows: cast Mage Armor on yourself without a spell slot",
      "dnd-2024-basic:invocation:eldritch-mind": "Eldritch Mind: advantage on Constitution saves to maintain Concentration",
      "dnd-2024-basic:invocation:pact-of-the-blade": "Pact of the Blade: conjure or bond a pact weapon",
      "dnd-2024-basic:invocation:pact-of-the-chain": "Pact of the Chain: learn Find Familiar without a spell slot",
      "dnd-2024-basic:invocation:pact-of-the-tome": "Pact of the Tome: Book of Shadows with three cantrips and two level-1 Ritual spells",
    };
    const label = invocationLabels[classChoiceValues.eldritchInvocation];
    if (label) sheet.classFeatures.push({ id: `${classDefinition.id}:invocation-effect`, name: label, category: "limitedUse", charges: null, recharge: "none" });
  }
  sheet.feats = selectedOriginFeats(build, backgroundDefinition, speciesDefinition, catalog)
    .map((featId) => catalog.feats.find((feat) => feat.id === featId)?.displayName ?? featId)
    .join(", ");

  sheet.spellcastingAbility = toSpellcastingAbility(classDefinition?.spellcasting?.ability);
  for (const [kind, selected] of Object.entries(choices.speciesChoices ?? {})) {
    if (!kind.toLowerCase().includes("spellcastingability") || typeof selected !== "string") continue;
    const ability = toSpellcastingAbility(selected as AbilityName);
    if (ability && !sheet.spellcastingAbility) sheet.spellcastingAbility = ability;
  }
  if (classDefinition?.spellcasting) {
    sheet.spellSlots.level1.max = Number(classDefinition.spellcasting.spellSlots["1"] ?? 0);
    const chosen = choices.spells;
    for (const spellId of chosen?.spellbook ?? []) addSpellById(sheet, catalog, spellId);
    for (const spellId of chosen?.cantrips ?? []) addSpellById(sheet, catalog, spellId);
    for (const spellId of chosen?.prepared ?? []) addSpellById(sheet, catalog, spellId);
    if (choices.divineOrderCantrip) addSpellById(sheet, catalog, choices.divineOrderCantrip);
    if (choices.primalOrderCantrip) addSpellById(sheet, catalog, choices.primalOrderCantrip);
    for (const feature of classDefinition.features) {
      if (feature.name === "Favored Enemy") addSpellById(sheet, catalog, "dnd-2024-basic:spell:hunter-s-mark");
    }
  }
  if (classDefinition?.displayName === "Druid") addSpellById(sheet, catalog, "dnd-2024-basic:spell:speak-with-animals");
  if (classChoiceValues.eldritchInvocation === "dnd-2024-basic:invocation:armor-of-shadows") addSpellById(sheet, catalog, "dnd-2024-basic:spell:mage-armor");
  if (classChoiceValues.eldritchInvocation === "dnd-2024-basic:invocation:pact-of-the-chain") addSpellById(sheet, catalog, "dnd-2024-basic:spell:find-familiar");
  for (const spellId of choices.pactTomeCantrips ?? []) addSpellById(sheet, catalog, spellId);
  for (const spellId of choices.pactTomeRituals ?? []) addSpellById(sheet, catalog, spellId);
  for (const spellId of speciesEffects.spellIds) addSpellById(sheet, catalog, spellId);
  const magicInitiates = [choices.featChoices?.magicInitiate, choices.originFeatChoices?.magicInitiate];
  for (const magicInitiate of magicInitiates) {
    if (!magicInitiate) continue;
    if (!sheet.spellcastingAbility) sheet.spellcastingAbility = toSpellcastingAbility(magicInitiate.spellcastingAbility);
    for (const spellId of magicInitiate.cantrips) addSpellById(sheet, catalog, spellId);
    addSpellById(sheet, catalog, magicInitiate.spell);
  }
  sheet.creationBuild = build;
  sheet.creationProvenance = createProvenance(build, options.generatedAt, catalog, {
    rulesComplete: options.rulesComplete ?? false,
    unresolvedChoices: options.unresolvedChoices ?? [],
  });
  return sheet;
}

export function createProvenance(
  build: CharacterCreationBuild,
  generatedAt: string,
  catalog: CharacterCreatorCatalog = DND_2024_BASIC_CATALOG,
  completion: { rulesComplete: boolean; unresolvedChoices: string[] } = { rulesComplete: false, unresolvedChoices: [] },
): CharacterSheetProvenance {
  const field = (source: "catalog" | "score-generation" | "runtime-calculation", definitionId?: string, note?: string) => ({
    source,
    ...(definitionId ? { definitionId } : {}),
    ...(note ? { note } : {}),
  });
  const definitionIds = [build.classId, build.backgroundId, build.speciesId].filter(Boolean);
  for (const spellId of build.choices?.spells?.cantrips ?? []) definitionIds.push(spellId);
  for (const spellId of build.choices?.spells?.prepared ?? []) definitionIds.push(spellId);
  for (const spellId of build.choices?.spells?.spellbook ?? []) definitionIds.push(spellId);
  for (const spellId of build.choices?.pactTomeCantrips ?? []) definitionIds.push(spellId);
  for (const spellId of build.choices?.pactTomeRituals ?? []) definitionIds.push(spellId);
  for (const languageId of build.choices?.languages ?? []) definitionIds.push(languageId);
  for (const toolId of [...(build.choices?.backgroundTools ?? []), ...(build.choices?.classTools ?? []), ...(build.choices?.weaponMastery ?? [])]) definitionIds.push(toolId);
  for (const equipmentId of Object.values(build.choices?.equipmentChoices ?? {})) {
    for (const idValue of Array.isArray(equipmentId) ? equipmentId : [equipmentId]) definitionIds.push(idValue);
  }
  if (build.choices?.originFeatId) definitionIds.push(build.choices.originFeatId);
  if (build.choices?.originFeatChoices?.magicInitiate?.spell) definitionIds.push(build.choices.originFeatChoices.magicInitiate.spell);
  if (build.choices?.featChoices?.magicInitiate?.spell) definitionIds.push(build.choices.featChoices.magicInitiate.spell);
  return {
    mode: "guided",
    ruleset: catalog.id,
    sourceBook: catalog.sourceBook,
    sourceVersion: catalog.sourceVersion,
    sourceManifest: catalog.sourceManifest,
    catalogVersion: catalog.version,
    generatedAt,
    definitionIds: [...new Set(definitionIds)],
    choices: (build.choices ?? {}) as Record<string, unknown>,
    fields: {
      characterClass: field("catalog", build.classId || undefined),
      background: field("catalog", build.backgroundId || undefined),
      race: field("catalog", build.speciesId || undefined),
      abilities: field("score-generation", undefined, "Scores, modifiers, and background increases are derived from the submitted build."),
      proficiencyBonus: field("runtime-calculation", undefined, "Derived from total level."),
      initiative: field("runtime-calculation", undefined, "Derived from Dexterity and the Alert feat when selected."),
      hitPoints: field("runtime-calculation", undefined, "Derived from class hit die, Constitution, and source-defined species effects."),
      equipment: field("catalog", undefined, "Derived from the selected class and background packages."),
      spells: field("catalog", undefined, "Derived from class and feat spell choices."),
    },
    modeled: ["class", "background", "species", "languages", "ability scores", "saving throws", "skills", "hit points", "initiative", "armor class", "equipment", "spells", "level-1 features"],
    notModeled: [...RUNTIME_NOT_MODELED],
    rulesComplete: completion.rulesComplete,
    unresolvedChoices: [...completion.unresolvedChoices],
  };
}
