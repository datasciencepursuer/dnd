import type { Token, InitiativeEntry, DistanceEntry, WallSegment, AreaShape } from "../types";
import { FEET_PER_CELL } from "../constants";
import {
  wallToSegments,
  segmentsIntersect,
  isWallPassable,
  getTerrainAtPosition,
  isDifficultTerrain,
  isPassableTerrain,
} from "./terrain-utils";

export { FEET_PER_CELL };

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

/** Result of terrain-aware drag analysis. */
export interface DragMovementInfo {
  totalFeet: number;
  crossedWallIds: string[];
  hasDifficultTerrain: boolean;
  hasImpassable: boolean;
}

/**
 * Compute terrain-aware movement info for a token drag.
 * Checks wall crossings along the drag line and terrain at the endpoint.
 * Runs every drag frame (~60fps) — kept lightweight (O(W+A)).
 */
export function computeDragMovementInfo(
  startCol: number,
  startRow: number,
  endCol: number,
  endRow: number,
  tokenSize: number,
  walls: WallSegment[],
  areas: AreaShape[],
): DragMovementInfo {
  const totalFeet = gridMovementDistance(startCol, startRow, endCol, endRow);

  // Build center-to-center line segment in grid coordinates
  const halfSize = tokenSize / 2;
  const p1 = { x: startCol + halfSize, y: startRow + halfSize };
  const p2 = { x: endCol + halfSize, y: endRow + halfSize };

  // Test wall crossings — only impassable walls
  const crossedWallIds: string[] = [];
  for (const wall of walls) {
    if (isWallPassable(wall)) continue;
    const segs = wallToSegments(wall);
    for (const [s1, s2] of segs) {
      if (segmentsIntersect(p1, p2, s1, s2)) {
        crossedWallIds.push(wall.id);
        break; // One crossing per wall is enough
      }
    }
  }

  // Check terrain at endpoint
  const endAreas = getTerrainAtPosition({ col: endCol, row: endRow }, areas);
  const hasDifficultTerrain = endAreas.some((a) => isDifficultTerrain(a));
  const hasImpassable = endAreas.some((a) => !isPassableTerrain(a));

  return { totalFeet, crossedWallIds, hasDifficultTerrain, hasImpassable };
}
