import type { Token, InitiativeEntry, DistanceEntry } from "../types";

/** Standard D&D 5e: each grid cell = 5 feet */
export const FEET_PER_CELL = 5;

/** Axis-aligned rectangle footprint of a token on the grid */
export interface TokenFootprint {
  col: number;
  row: number;
  size: number; // cells wide/tall (1 = Medium, 2 = Large, 3 = Huge, 4 = Gargantuan)
}

/**
 * D&D 5e distance between two token footprints.
 * Uses PHB grid counting: start from a square adjacent to one creature,
 * count squares to the other creature's space. Pythagorean for diagonals.
 * Overlapping tokens = 0ft, adjacent (touching edges) = 5ft.
 */
export function cellGapDistance(
  a: TokenFootprint,
  b: TokenFootprint,
  feetPerCell: number = FEET_PER_CELL
): number {
  // Raw gap: negative = overlap, 0 = edges touching, positive = empty cells between
  const rawGapCol = Math.max(a.col, b.col) - Math.min(a.col + a.size, b.col + b.size);
  const rawGapRow = Math.max(a.row, b.row) - Math.min(a.row + a.size, b.row + b.size);

  // Tokens truly overlap (share cells) — distance is 0
  if (rawGapCol < 0 && rawGapRow < 0) return 0;

  // D&D grid counting: distance in squares = gap + 1 per non-overlapping axis
  // An overlapping axis contributes 0 squares (they share that dimension)
  const squaresCol = rawGapCol >= 0 ? rawGapCol + 1 : 0;
  const squaresRow = rawGapRow >= 0 ? rawGapRow + 1 : 0;

  return Math.sqrt(squaresCol * squaresCol + squaresRow * squaresRow) * feetPerCell;
}

/**
 * Build pairwise distance matrix for all combatants in initiative order.
 * Expands monster groups so every individual token gets distances.
 */
export function computeDistanceMatrix(
  initiativeOrder: InitiativeEntry[],
  tokens: Token[],
  feetPerCell: number = FEET_PER_CELL
): DistanceEntry[] {
  // Collect all individual combatant token IDs (expanding groups)
  const combatantIds: string[] = [];
  for (const entry of initiativeOrder) {
    if (entry.groupTokenIds && entry.groupTokenIds.length > 0) {
      combatantIds.push(...entry.groupTokenIds);
    } else {
      combatantIds.push(entry.tokenId);
    }
  }

  // Deduplicate
  const uniqueIds = [...new Set(combatantIds)];

  // Build footprint map
  const footprints = new Map<string, TokenFootprint>();
  for (const id of uniqueIds) {
    const token = tokens.find((t) => t.id === id);
    if (token) {
      footprints.set(id, {
        col: token.position.col,
        row: token.position.row,
        size: token.size,
      });
    }
  }

  // Compute pairwise distances
  const entries: DistanceEntry[] = [];
  const ids = [...footprints.keys()];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = footprints.get(ids[i])!;
      const b = footprints.get(ids[j])!;
      const feet = Math.round(cellGapDistance(a, b, feetPerCell) * 10) / 10;
      entries.push({ tokenIdA: ids[i], tokenIdB: ids[j], feet });
    }
  }

  return entries;
}

/** Look up the distance between two specific tokens from a precomputed matrix. */
export function lookupDistance(
  matrix: DistanceEntry[],
  idA: string,
  idB: string
): number | null {
  const entry = matrix.find(
    (e) =>
      (e.tokenIdA === idA && e.tokenIdB === idB) ||
      (e.tokenIdA === idB && e.tokenIdB === idA)
  );
  return entry ? entry.feet : null;
}

/**
 * Pythagorean center-to-center displacement distance for a single token's drag.
 * Used by DragOverlay to show movement distance.
 */
export function gridMovementDistance(
  startCol: number,
  startRow: number,
  endCol: number,
  endRow: number,
  feetPerCell: number = FEET_PER_CELL
): number {
  const dc = Math.abs(endCol - startCol);
  const dr = Math.abs(endRow - startRow);
  return Math.sqrt(dc * dc + dr * dr) * feetPerCell;
}
