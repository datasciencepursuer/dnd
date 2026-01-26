import type { Position, GridPosition } from "../types";

export function pixelToGrid(
  x: number,
  y: number,
  cellSize: number
): GridPosition {
  return {
    col: Math.floor(x / cellSize),
    row: Math.floor(y / cellSize),
  };
}

export function gridToPixel(
  col: number,
  row: number,
  cellSize: number
): Position {
  return {
    x: col * cellSize,
    y: row * cellSize,
  };
}

export function snapToGrid(
  x: number,
  y: number,
  cellSize: number
): Position {
  const grid = pixelToGrid(x, y, cellSize);
  return gridToPixel(grid.col, grid.row, cellSize);
}

export function gridToPixelCenter(
  col: number,
  row: number,
  cellSize: number
): Position {
  return {
    x: col * cellSize + cellSize / 2,
    y: row * cellSize + cellSize / 2,
  };
}

export function clampToGrid(
  col: number,
  row: number,
  width: number,
  height: number
): GridPosition {
  return {
    col: Math.max(0, Math.min(col, width - 1)),
    row: Math.max(0, Math.min(row, height - 1)),
  };
}
