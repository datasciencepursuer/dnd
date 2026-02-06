import type { FogCell, Token } from "../types";

/** Build an O(1) lookup set from painted fog cells */
export function buildFogSet(paintedCells: FogCell[]): Set<string> {
  const set = new Set<string>();
  for (const cell of paintedCells) {
    set.add(cell.key);
  }
  return set;
}

/** Check if any cell a token occupies is under fog */
export function isTokenUnderFog(token: Token, fogSet: Set<string>): boolean {
  for (let dx = 0; dx < token.size; dx++) {
    for (let dy = 0; dy < token.size; dy++) {
      if (fogSet.has(`${token.position.col + dx},${token.position.row + dy}`)) {
        return true;
      }
    }
  }
  return false;
}
