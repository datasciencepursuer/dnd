import { compileCharacterBuild } from "./compile-build";
import type { CharacterSheet } from "~/features/map-editor/types";
import { invalidateGuidedSheet } from "./provenance";
import type {
  CharacterCreationValidationError,
  CharacterCreationBuild,
} from "./types";

export interface GuidedTokenRecord {
  [key: string]: unknown;
  characterCreationBuild?: unknown;
  characterSheet?: unknown;
  layer?: unknown;
}

export interface GuidedTokenCompilation {
  valid: true;
  token: GuidedTokenRecord;
  build?: CharacterCreationBuild;
}

export interface GuidedTokenCompilationFailure {
  valid: false;
  errors: CharacterCreationValidationError[];
}

export type GuidedTokenCompilationResult =
  | GuidedTokenCompilation
  | GuidedTokenCompilationFailure;

const RUNTIME_SHEET_FIELDS = [
  "hpCurrent",
  "condition",
  "deathSaves",
  "shield",
  "heroicInspiration",
  "auraCircleEnabled",
  "auraCircleRange",
  "auraSquareEnabled",
  "auraSquareRange",
] as const satisfies readonly (keyof CharacterSheet)[];

const SPELL_SLOT_LEVELS = ["level1", "level2", "level3", "level4", "level5", "level6", "level7", "level8", "level9"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function preserveRuntimeSheetState(
  compiledSheet: CharacterSheet,
  existingSheet: unknown,
): CharacterSheet {
  if (!isRecord(existingSheet)) return compiledSheet;

  const runtimeOverrides: Partial<CharacterSheet> = {};
  for (const field of RUNTIME_SHEET_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(existingSheet, field)) {
      (runtimeOverrides as Record<string, unknown>)[field] = existingSheet[field];
    }
  }
  if (isRecord(existingSheet.spellSlots) && isRecord(compiledSheet.spellSlots)) {
    const spellSlots = { ...compiledSheet.spellSlots };
    for (const level of SPELL_SLOT_LEVELS) {
      const existingSlot = existingSheet.spellSlots[level];
      const compiledSlot = compiledSheet.spellSlots[level];
      if (isRecord(existingSlot) && compiledSlot) {
        spellSlots[level] = {
          ...compiledSlot,
          used: typeof existingSlot.used === "number" ? Math.min(Math.max(0, existingSlot.used), compiledSlot.max) : compiledSlot.used,
        };
      }
    }
    runtimeOverrides.spellSlots = spellSlots;
  }

  return { ...compiledSheet, ...runtimeOverrides };
}

/**
 * Recompile a token only when it carries a guided source build. Manual,
 * imported, monster, and explicitly-cleared tokens are returned unchanged.
 */
export function recompileGuidedToken(
  token: GuidedTokenRecord,
  generatedAt: string,
): GuidedTokenCompilationResult {
  const sourceBuild = token.characterCreationBuild;
  if (sourceBuild === undefined || sourceBuild === null) {
    if (sourceBuild === null && (token.characterId === undefined || token.characterId === null) && isRecord(token.characterSheet) && token.characterSheet.creationBuild) {
      return {
        valid: true,
        token: {
          ...token,
          characterSheet: invalidateGuidedSheet(token.characterSheet as unknown as CharacterSheet),
        },
      };
    }
    return { valid: true, token };
  }

  if (token.layer !== "character") {
    return {
      valid: false,
      errors: [{
        path: "layer",
        code: "guided-token-layer",
        message: "Guided character tokens must use the character layer.",
      }],
    };
  }

  if (token.characterId !== undefined && token.characterId !== null) {
    return {
      valid: false,
      errors: [{
        path: "characterId",
        code: "guided-token-library-link",
        message: "Guided character drafts cannot be linked to a library character.",
      }],
    };
  }

  if (
    isRecord(token.characterSheet) &&
    token.characterSheet.srdMonsterIndex !== undefined &&
    token.characterSheet.srdMonsterIndex !== null
  ) {
    return {
      valid: false,
      errors: [{
        path: "characterSheet.srdMonsterIndex",
        code: "guided-token-monster-link",
        message: "Guided character drafts cannot be linked to an SRD monster sheet.",
      }],
    };
  }

  const compiled = compileCharacterBuild(sourceBuild, generatedAt);
  if (!compiled.valid) return compiled;

  return {
    valid: true,
    build: compiled.build,
    token: {
      ...token,
      name: compiled.build.name,
      characterCreationBuild: compiled.build,
      characterSheet: preserveRuntimeSheetState(compiled.sheet, token.characterSheet),
    },
  };
}
