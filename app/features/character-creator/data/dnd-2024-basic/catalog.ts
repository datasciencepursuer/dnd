import catalogMetadata from "./catalog.json";
import backgroundData from "./backgrounds.json";
import classData from "./classes.json";
import equipmentData from "./equipment.json";
import featData from "./feats.json";
import languageData from "./languages.json";
import speciesData from "./species.json";
import spellData from "./spells.json";
import type {
  CatalogBackground,
  CatalogClass,
  CatalogEquipment,
  CatalogFeat,
  CatalogLanguage,
  CatalogOption,
  CatalogSpecies,
  CatalogSpell,
  CharacterCreatorCatalog,
} from "../../rules/types";

/**
 * One JSON artifact is used by both route/server code and the browser bundle.
 * Vite can split these imports with the creator route; no runtime catalog fetch exists.
 */
export const DND_2024_BASIC_CATALOG: CharacterCreatorCatalog = {
  ...catalogMetadata,
  classes: classData as CatalogClass[],
  backgrounds: backgroundData as CatalogBackground[],
  species: speciesData as CatalogSpecies[],
  feats: featData as CatalogFeat[],
  spells: spellData as CatalogSpell[],
  equipment: equipmentData as CatalogEquipment[],
  languages: languageData as CatalogLanguage[],
} as unknown as CharacterCreatorCatalog;

export function findCatalogOption(
  catalog: CharacterCreatorCatalog,
  kind: "class" | "background" | "species" | "feat" | "spell" | "equipment" | "language",
  optionId: string,
): CatalogOption | undefined {
  const entries = {
    class: catalog.classes,
    background: catalog.backgrounds,
    species: catalog.species,
    feat: catalog.feats,
    spell: catalog.spells,
    equipment: catalog.equipment,
    language: catalog.languages,
  }[kind];
  return entries.find((entry) => entry.id === optionId);
}

export function getCatalogClass(catalog: CharacterCreatorCatalog, optionId: string) {
  return catalog.classes.find((entry) => entry.id === optionId);
}

export function getCatalogBackground(catalog: CharacterCreatorCatalog, optionId: string) {
  return catalog.backgrounds.find((entry) => entry.id === optionId);
}

export function getCatalogSpecies(catalog: CharacterCreatorCatalog, optionId: string) {
  return catalog.species.find((entry) => entry.id === optionId);
}

export function getCatalogSpell(catalog: CharacterCreatorCatalog, optionId: string) {
  return catalog.spells.find((entry) => entry.id === optionId);
}
