import { Shape, Group } from "react-konva";
import { useEffect, useState, useMemo } from "react";
import type { FogCell, GridSettings } from "../../types";
import type { Context } from "konva/lib/Context";

interface FogLayerProps {
  paintedCells: FogCell[];
  grid: GridSettings;
  currentUserId: string | null;
}

interface FogRegion {
  cells: Set<string>;
  creatorId: string;
  minCol: number;
  maxCol: number;
  minRow: number;
  maxRow: number;
}

// Find connected regions of fog cells using flood fill
function findConnectedRegions(cells: FogCell[]): FogRegion[] {
  if (cells.length === 0) return [];

  const cellMap = new Map<string, FogCell>();
  cells.forEach(c => cellMap.set(c.key, c));

  const visited = new Set<string>();
  const regions: FogRegion[] = [];

  const getNeighbors = (key: string): string[] => {
    const [col, row] = key.split(",").map(Number);
    return [
      `${col - 1},${row}`,
      `${col + 1},${row}`,
      `${col},${row - 1}`,
      `${col},${row + 1}`,
    ].filter(k => cellMap.has(k));
  };

  for (const cell of cells) {
    if (visited.has(cell.key)) continue;

    // BFS to find all connected cells
    const region: FogRegion = {
      cells: new Set(),
      creatorId: cell.creatorId,
      minCol: Infinity,
      maxCol: -Infinity,
      minRow: Infinity,
      maxRow: -Infinity,
    };

    const queue = [cell.key];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;

      visited.add(current);
      region.cells.add(current);

      const [col, row] = current.split(",").map(Number);
      region.minCol = Math.min(region.minCol, col);
      region.maxCol = Math.max(region.maxCol, col);
      region.minRow = Math.min(region.minRow, row);
      region.maxRow = Math.max(region.maxRow, row);

      for (const neighbor of getNeighbors(current)) {
        if (!visited.has(neighbor)) {
          queue.push(neighbor);
        }
      }
    }

    regions.push(region);
  }

  return regions;
}

// Generate cloud edge points with organic bumps
function generateCloudPath(
  region: FogRegion,
  cellSize: number,
  padding: number = 8
): { x: number; y: number }[] {
  const { minCol, maxCol, minRow, maxRow, cells } = region;

  // Create a grid to track which cells are filled
  const width = maxCol - minCol + 1;
  const height = maxRow - minRow + 1;
  const grid: boolean[][] = Array(height).fill(null).map(() => Array(width).fill(false));

  for (const key of cells) {
    const [col, row] = key.split(",").map(Number);
    grid[row - minRow][col - minCol] = true;
  }

  // Find the outline points using marching squares-like approach
  const points: { x: number; y: number }[] = [];

  // Helper to check if a cell is filled
  const isFilled = (c: number, r: number) => {
    if (c < 0 || c >= width || r < 0 || r >= height) return false;
    return grid[r][c];
  };

  // Trace the outline clockwise
  // Start from top-left corner of the bounding box
  const baseX = minCol * cellSize;
  const baseY = minRow * cellSize;

  // For each edge segment, add points with cloud-like bumps
  const addCloudEdge = (
    x1: number, y1: number,
    x2: number, y2: number,
    isHorizontal: boolean,
    outwardDir: number // 1 or -1 for bump direction
  ) => {
    const segments = Math.max(1, Math.floor(Math.sqrt((x2-x1)**2 + (y2-y1)**2) / (cellSize * 0.5)));

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const basePointX = x1 + (x2 - x1) * t;
      const basePointY = y1 + (y2 - y1) * t;

      // Add cloud bump using sine wave with some randomness
      const bumpPhase = t * Math.PI * 2 + (x1 + y1) * 0.1;
      const bumpAmount = Math.sin(bumpPhase) * padding * 0.6 +
                         Math.sin(bumpPhase * 2.3) * padding * 0.3;

      if (isHorizontal) {
        points.push({
          x: basePointX,
          y: basePointY + bumpAmount * outwardDir
        });
      } else {
        points.push({
          x: basePointX + bumpAmount * outwardDir,
          y: basePointY
        });
      }
    }
  };

  // Trace outline by checking each cell edge
  // Go through each row and find horizontal edges
  for (let r = 0; r <= height; r++) {
    for (let c = 0; c < width; c++) {
      const above = r > 0 && grid[r - 1][c];
      const below = r < height && grid[r][c];

      if (above !== below) {
        const y = baseY + r * cellSize;
        const x1 = baseX + c * cellSize - padding;
        const x2 = baseX + (c + 1) * cellSize + padding;
        const outward = below ? -1 : 1; // bump outward from filled area

        addCloudEdge(x1, y, x2, y, true, outward);
      }
    }
  }

  // Go through each column and find vertical edges
  for (let c = 0; c <= width; c++) {
    for (let r = 0; r < height; r++) {
      const left = c > 0 && grid[r][c - 1];
      const right = c < width && grid[r][c];

      if (left !== right) {
        const x = baseX + c * cellSize;
        const y1 = baseY + r * cellSize - padding;
        const y2 = baseY + (r + 1) * cellSize + padding;
        const outward = right ? -1 : 1;

        addCloudEdge(x, y1, x, y2, false, outward);
      }
    }
  }

  return points;
}

// Draw a fluffy cloud shape for a region
function drawCloudRegion(
  ctx: Context,
  region: FogRegion,
  cellSize: number
) {
  const { minCol, maxCol, minRow, maxRow, cells } = region;
  const padding = cellSize * 0.15; // Small bleed over edges

  // Create a grid to track which cells are filled
  const width = maxCol - minCol + 1;
  const height = maxRow - minRow + 1;
  const grid: boolean[][] = Array(height).fill(null).map(() => Array(width).fill(false));

  for (const key of cells) {
    const [col, row] = key.split(",").map(Number);
    grid[row - minRow][col - minCol] = true;
  }

  const baseX = minCol * cellSize;
  const baseY = minRow * cellSize;

  // Draw the base shape by iterating through cells and drawing rounded rects
  ctx.beginPath();

  // For each cell, draw a rounded shape that slightly overlaps neighbors
  for (const key of cells) {
    const [col, row] = key.split(",").map(Number);
    const x = (col - minCol) * cellSize + baseX - padding;
    const y = (row - minRow) * cellSize + baseY - padding;
    const size = cellSize + padding * 2;
    const radius = cellSize * 0.3;

    // Check neighbors for rounded corners
    const hasTop = cells.has(`${col},${row - 1}`);
    const hasBottom = cells.has(`${col},${row + 1}`);
    const hasLeft = cells.has(`${col - 1},${row}`);
    const hasRight = cells.has(`${col + 1},${row}`);

    // Draw rounded rectangle with conditional corners
    ctx.moveTo(x + (hasLeft && hasTop ? 0 : radius), y);

    // Top edge
    ctx.lineTo(x + size - (hasRight && hasTop ? 0 : radius), y);
    if (!hasRight || !hasTop) {
      ctx.quadraticCurveTo(x + size, y, x + size, y + radius);
    }

    // Right edge
    ctx.lineTo(x + size, y + size - (hasRight && hasBottom ? 0 : radius));
    if (!hasRight || !hasBottom) {
      ctx.quadraticCurveTo(x + size, y + size, x + size - radius, y + size);
    }

    // Bottom edge
    ctx.lineTo(x + (hasLeft && hasBottom ? 0 : radius), y + size);
    if (!hasLeft || !hasBottom) {
      ctx.quadraticCurveTo(x, y + size, x, y + size - radius);
    }

    // Left edge
    ctx.lineTo(x, y + (hasLeft && hasTop ? 0 : radius));
    if (!hasLeft || !hasTop) {
      ctx.quadraticCurveTo(x, y, x + radius, y);
    }

    ctx.closePath();
  }

  ctx.fillStrokeShape(ctx as any);
}

// Simpler approach: draw each cell with cloud puffs on exposed edges
function drawCellWithPuffs(
  ctx: Context,
  col: number,
  row: number,
  cellSize: number,
  cells: Set<string>,
  seed: number
) {
  const x = col * cellSize;
  const y = row * cellSize;
  const puffRadius = cellSize * 0.12;
  const padding = cellSize * 0.03;

  // Check neighbors
  const hasTop = cells.has(`${col},${row - 1}`);
  const hasBottom = cells.has(`${col},${row + 1}`);
  const hasLeft = cells.has(`${col - 1},${row}`);
  const hasRight = cells.has(`${col + 1},${row}`);

  // Draw main cell rectangle
  ctx.rect(x - padding, y - padding, cellSize + padding * 2, cellSize + padding * 2);

  // Add cloud puffs on exposed edges
  const puffCount = 3;

  // Seeded random for consistent puffs
  const seededRandom = (s: number) => {
    const x = Math.sin(s * 9999) * 10000;
    return x - Math.floor(x);
  };

  if (!hasTop) {
    for (let i = 0; i < puffCount; i++) {
      const px = x + (i + 0.5) * (cellSize / puffCount);
      const py = y - padding;
      const r = puffRadius * (0.6 + seededRandom(seed + i + col * 100) * 0.4);
      ctx.moveTo(px + r, py);
      ctx.arc(px, py, r, 0, Math.PI * 2);
    }
  }

  if (!hasBottom) {
    for (let i = 0; i < puffCount; i++) {
      const px = x + (i + 0.5) * (cellSize / puffCount);
      const py = y + cellSize + padding;
      const r = puffRadius * (0.6 + seededRandom(seed + i + 50 + col * 100) * 0.4);
      ctx.moveTo(px + r, py);
      ctx.arc(px, py, r, 0, Math.PI * 2);
    }
  }

  if (!hasLeft) {
    for (let i = 0; i < puffCount; i++) {
      const px = x - padding;
      const py = y + (i + 0.5) * (cellSize / puffCount);
      const r = puffRadius * (0.6 + seededRandom(seed + i + 100 + row * 100) * 0.4);
      ctx.moveTo(px + r, py);
      ctx.arc(px, py, r, 0, Math.PI * 2);
    }
  }

  if (!hasRight) {
    for (let i = 0; i < puffCount; i++) {
      const px = x + cellSize + padding;
      const py = y + (i + 0.5) * (cellSize / puffCount);
      const r = puffRadius * (0.6 + seededRandom(seed + i + 150 + row * 100) * 0.4);
      ctx.moveTo(px + r, py);
      ctx.arc(px, py, r, 0, Math.PI * 2);
    }
  }

  // Add corner puffs for outer corners
  if (!hasTop && !hasLeft) {
    const r = puffRadius * (0.5 + seededRandom(seed + 200) * 0.3);
    ctx.moveTo(x - padding + r, y - padding);
    ctx.arc(x - padding, y - padding, r, 0, Math.PI * 2);
  }
  if (!hasTop && !hasRight) {
    const r = puffRadius * (0.5 + seededRandom(seed + 201) * 0.3);
    ctx.moveTo(x + cellSize + padding + r, y - padding);
    ctx.arc(x + cellSize + padding, y - padding, r, 0, Math.PI * 2);
  }
  if (!hasBottom && !hasLeft) {
    const r = puffRadius * (0.5 + seededRandom(seed + 202) * 0.3);
    ctx.moveTo(x - padding + r, y + cellSize + padding);
    ctx.arc(x - padding, y + cellSize + padding, r, 0, Math.PI * 2);
  }
  if (!hasBottom && !hasRight) {
    const r = puffRadius * (0.5 + seededRandom(seed + 203) * 0.3);
    ctx.moveTo(x + cellSize + padding + r, y + cellSize + padding);
    ctx.arc(x + cellSize + padding, y + cellSize + padding, r, 0, Math.PI * 2);
  }
}

export function FogLayer({ paintedCells, grid, currentUserId }: FogLayerProps) {
  const { cellSize, width, height } = grid;

  // Group cells by creator and find connected regions
  const regions = useMemo(() => {
    return findConnectedRegions(paintedCells);
  }, [paintedCells]);

  return (
    <Group>
      {regions.map((region, idx) => {
        // Creator sees fog at lower opacity
        const isCreator = currentUserId && region.creatorId === currentUserId;
        const baseOpacity = isCreator ? 0.65 : 1;

        // Create a set for quick neighbor lookup
        const cellSet = region.cells;

        return (
          <Shape
            key={`region-${idx}-${region.minCol}-${region.minRow}`}
            sceneFunc={(ctx, shape) => {
              ctx.beginPath();

              // Draw each cell with cloud puffs
              for (const key of region.cells) {
                const [col, row] = key.split(",").map(Number);
                if (col < 0 || col >= width || row < 0 || row >= height) continue;
                drawCellWithPuffs(ctx, col, row, cellSize, cellSet, col * 1000 + row);
              }

              ctx.fillStrokeShape(shape);
            }}
            fill="#f0f0f0"
            opacity={baseOpacity}
            shadowColor="#999"
            shadowBlur={8}
            shadowOpacity={0.2}
            listening={false}
          />
        );
      })}
    </Group>
  );
}
