import { DND_2024_BASIC_CATALOG } from "../data/dnd-2024-basic/catalog";
import { deriveCharacterSheet } from "./derive-sheet";
import { validateCharacterBuild } from "./validate-build";
import type {
  CharacterCreationCompilationResult,
  CharacterCreatorCatalog,
} from "./types";

export function compileCharacterBuild(
  value: unknown,
  generatedAt: string,
  catalog: CharacterCreatorCatalog = DND_2024_BASIC_CATALOG,
): CharacterCreationCompilationResult {
  const validation = validateCharacterBuild(value, catalog);
  if (!validation.valid) return validation;

  const sheet = deriveCharacterSheet(validation.build, {
    generatedAt,
    rulesComplete: validation.rulesComplete,
    unresolvedChoices: validation.unresolvedChoices,
  }, catalog);
  return {
    valid: true,
    rulesComplete: validation.rulesComplete,
    unresolvedChoices: validation.unresolvedChoices,
    build: validation.build,
    sheet,
    provenance: sheet.creationProvenance!,
  };
}
