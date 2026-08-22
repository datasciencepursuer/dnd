import type { InitiativeEntry, Token } from "../types";
import { computeDistanceMatrix } from "./distance-utils";

export interface MapDataRecord {
  [key: string]: unknown;
}

export function isMapDataRecord(value: unknown): value is MapDataRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function canonicalizeForComparison(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeForComparison);
  if (!isMapDataRecord(value)) return value;

  const canonical: MapDataRecord = {};
  for (const key of Object.keys(value).sort()) {
    canonical[key] = canonicalizeForComparison(value[key]);
  }
  return canonical;
}

function tokenRecordsById(data: unknown): Map<string, MapDataRecord> {
  const tokensById = new Map<string, MapDataRecord>();
  if (!isMapDataRecord(data)) return tokensById;

  const collectTokens = (value: unknown) => {
    if (!Array.isArray(value)) return;
    for (const token of value) {
      if (isMapDataRecord(token) && typeof token.id === "string") {
        tokensById.set(token.id, token);
      }
    }
  };

  collectTokens(data.tokens);
  if (Array.isArray(data.scenes)) {
    for (const scene of data.scenes) {
      if (isMapDataRecord(scene)) collectTokens(scene.tokens);
    }
  }

  return tokensById;
}

function hasDuplicateTokenIds(data: unknown): boolean {
  if (!isMapDataRecord(data)) return false;

  const seenIds = new Set<string>();
  let hasDuplicate = false;
  const collectTokens = (value: unknown) => {
    if (!Array.isArray(value)) return;
    for (const token of value) {
      if (!isMapDataRecord(token) || typeof token.id !== "string") continue;
      if (seenIds.has(token.id)) hasDuplicate = true;
      seenIds.add(token.id);
    }
  };

  collectTokens(data.tokens);
  if (Array.isArray(data.scenes)) {
    for (const scene of data.scenes) {
      if (isMapDataRecord(scene)) collectTokens(scene.tokens);
    }
  }

  return hasDuplicate;
}

export function validateTokenIdUniqueness(
  currentData: unknown,
  submittedData: unknown,
): { valid: true } | { valid: false; error: string } {
  if (hasDuplicateTokenIds(currentData) || hasDuplicateTokenIds(submittedData)) {
    return { valid: false, error: "Duplicate token IDs are not allowed" };
  }

  return { valid: true };
}

function tokensEqual(left: MapDataRecord, right: MapDataRecord): boolean {
  return JSON.stringify(canonicalizeForComparison(left)) === JSON.stringify(canonicalizeForComparison(right));
}

export function validatePlayerTokenChanges(
  currentData: unknown,
  submittedData: unknown,
  userId: string,
): { valid: true } | { valid: false; error: string } {
  const tokenIdValidation = validateTokenIdUniqueness(currentData, submittedData);
  if (!tokenIdValidation.valid) return tokenIdValidation;

  const currentTokens = tokenRecordsById(currentData);
  const submittedTokens = tokenRecordsById(submittedData);

  for (const [tokenId, currentToken] of currentTokens) {
    const submittedToken = submittedTokens.get(tokenId);
    if (!submittedToken) {
      if (currentToken.ownerId !== userId) {
        return { valid: false, error: "Cannot delete tokens you don't own" };
      }
      continue;
    }

    if (currentToken.ownerId !== submittedToken.ownerId) {
      return { valid: false, error: "Cannot change token ownership" };
    }

    if (currentToken.ownerId !== userId && !tokensEqual(currentToken, submittedToken)) {
      return { valid: false, error: "Cannot edit tokens you don't own" };
    }
  }

  for (const [tokenId, submittedToken] of submittedTokens) {
    if (!currentTokens.has(tokenId) && submittedToken.ownerId !== userId) {
      return { valid: false, error: "New tokens must be owned by the current player" };
    }
  }

  return { valid: true };
}

function deriveCombatDistances(combat: MapDataRecord, tokens: unknown): unknown[] | undefined {
  if (!Array.isArray(combat.initiativeOrder) || !Array.isArray(tokens)) return undefined;

  try {
    return computeDistanceMatrix(
      combat.initiativeOrder as InitiativeEntry[],
      tokens as Token[],
    );
  } catch {
    return undefined;
  }
}

/**
 * Non-DM full-map policy. The submitted root and existing-scene token arrays
 * are the only mutable map data. Server-owned structure is retained, viewport
 * and updatedAt remain client/server-derived state, and combat distances are
 * recomputed from the accepted root token positions.
 */
export function canonicalizePlayerMapData(
  currentData: unknown,
  submittedData: unknown,
): { valid: true; data: MapDataRecord } | { valid: false; error: string } {
  if (!isMapDataRecord(currentData) || !isMapDataRecord(submittedData)) {
    return { valid: false, error: "Invalid map data" };
  }

  const tokenIdValidation = validateTokenIdUniqueness(currentData, submittedData);
  if (!tokenIdValidation.valid) return tokenIdValidation;

  if (!Array.isArray(submittedData.tokens)) {
    return { valid: false, error: "Player map updates must include the root token collection" };
  }

  const currentScenes = Array.isArray(currentData.scenes) ? currentData.scenes : [];
  const submittedScenes = Array.isArray(submittedData.scenes) ? submittedData.scenes : [];
  if (currentScenes.length !== submittedScenes.length) {
    return { valid: false, error: "Players cannot add, remove, or reorder scenes" };
  }

  const nextScenes: unknown[] = [];
  for (let index = 0; index < currentScenes.length; index += 1) {
    const currentScene = currentScenes[index];
    const submittedScene = submittedScenes[index];
    if (!isMapDataRecord(currentScene) || !isMapDataRecord(submittedScene)) {
      return { valid: false, error: "Invalid scene data" };
    }
    if (currentScene.id !== submittedScene.id) {
      return { valid: false, error: "Players cannot add, remove, or reorder scenes" };
    }
    if (!Array.isArray(submittedScene.tokens)) {
      return { valid: false, error: "Player map updates must include scene token collections" };
    }

    // Keep every scene field from the server and apply only its token array.
    nextScenes.push({ ...currentScene, tokens: submittedScene.tokens });
  }

  const nextData: MapDataRecord = {
    ...currentData,
    tokens: submittedData.tokens,
  };
  if (currentScenes.length > 0 || Array.isArray(currentData.scenes)) {
    nextData.scenes = nextScenes;
  }

  // A player's viewport and client timestamp are never authoritative map edits.
  // They remain whatever the server already stores by starting from currentData.
  const currentCombat = currentData.combat;
  if (isMapDataRecord(currentCombat)) {
    const distances = deriveCombatDistances(currentCombat, submittedData.tokens);
    if (distances !== undefined) {
      nextData.combat = { ...currentCombat, distances };
    }
  }

  return { valid: true, data: nextData };
}
