import type { CatalogClass, CatalogEquipment, CatalogEquipmentGrant, CharacterCreatorCatalog } from "./types";

const MUSICAL_INSTRUMENT_NAMES = new Set([
  "Musical Instrument",
  "Bagpipes",
  "Drum",
  "Dulcimer",
  "Flute",
  "Horn",
  "Lute",
  "Lyre",
  "Pan Flute",
  "Shawm",
  "Viol",
]);

const NON_ARTISAN_TOOL_NAMES = new Set(["Navigator's Tools", "Thieves' Tools"]);

function isTool(entry: CatalogEquipment): boolean {
  return entry.kind === "tool" || entry.kind === "tool-choice";
}

export function isMusicalInstrument(entry: CatalogEquipment): boolean {
  return isTool(entry) && MUSICAL_INSTRUMENT_NAMES.has(entry.displayName);
}

export function isArtisanTool(entry: CatalogEquipment): boolean {
  return isTool(entry) &&
    !NON_ARTISAN_TOOL_NAMES.has(entry.displayName) &&
    /(tools|supplies|utensils)$/i.test(entry.displayName);
}

export function getMusicalInstrumentOptions(catalog: CharacterCreatorCatalog): readonly CatalogEquipment[] {
  return catalog.equipment.filter(isMusicalInstrument);
}

export function getArtisanToolOrMusicalInstrumentOptions(catalog: CharacterCreatorCatalog): readonly CatalogEquipment[] {
  return catalog.equipment.filter((entry) => isArtisanTool(entry) || isMusicalInstrument(entry));
}

export function getProficientWeaponOptions(
  classDefinition: CatalogClass | undefined,
  catalog: CharacterCreatorCatalog,
): readonly CatalogEquipment[] {
  const weapons = catalog.equipment.filter((entry) => entry.kind === "weapon");
  const proficiency = classDefinition?.weaponProficiencies ?? "";
  if (/Simple and Martial weapons/i.test(proficiency)) return weapons;
  if (/Simple weapons and Martial weapons that have the Light property/i.test(proficiency)) {
    return weapons.filter((entry) => entry.weaponCategory?.startsWith("Simple") || entry.properties?.some((property) => property.startsWith("Light")));
  }
  if (/Simple weapons and Martial weapons that have the Finesse or Light property/i.test(proficiency)) {
    return weapons.filter((entry) => entry.weaponCategory?.startsWith("Simple") || entry.properties?.some((property) => property.startsWith("Finesse") || property.startsWith("Light")));
  }
  return weapons.filter((entry) => entry.weaponCategory?.startsWith("Simple"));
}

/**
 * Resolve the small set of equipment-choice phrases present in the pinned
 * level-one SRD packages into concrete catalog entries. The source text stays
 * on the grant for attribution, while this helper gives validation, preview,
 * and derivation one shared interpretation.
 */
export function getEquipmentChoiceOptions(
  grant: CatalogEquipmentGrant,
  catalog: CharacterCreatorCatalog,
): readonly CatalogEquipment[] {
  const choiceKey = grant.choiceKey ?? "";

  if (choiceKey === "musical-instrument") {
    return getMusicalInstrumentOptions(catalog);
  }
  if (choiceKey === "gaming-set") {
    return catalog.equipment.filter((entry) => isTool(entry) && /gaming set/i.test(entry.displayName));
  }
  if (choiceKey.includes("artisans-tools-or-musical-instrument")) {
    return getArtisanToolOrMusicalInstrumentOptions(catalog);
  }

  // Keep unknown future phrases visible and selectable rather than silently
  // dropping them from a saved build. The server still requires an actual
  // catalog ID, so this remains bounded by the checked-in artifact.
  return catalog.equipment.filter(isTool);
}

export function getEquipmentChoiceKey(packageId: string, grant: CatalogEquipmentGrant): string {
  return `${packageId}:${grant.choiceKey ?? grant.displayName ?? "choice"}`;
}
