import { Shape, Group } from "react-konva";
import { useMemo } from "react";
import type { FogCell, GridSettings } from "../../types";

interface FogLayerProps {
  paintedCells: FogCell[];
  grid: GridSettings;
  currentUserId: string | null;
  showFluffyClouds?: boolean;
  isPlayingLocally?: boolean;
}

interface FogRegion {
  cells: Set<string>;
  creatorId: string;
  minCol: number;
  maxCol: number;
  minRow: number;
  maxRow: number;
}

interface FluffInfo {
  x: number;
  y: number;
  r: number;
}

// Seeded random for consistent patterns
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function seededRandomRange(seed: number, min: number, max: number): number {
  return seededRandom(seed) * (max - min) + min;
}

function seededRandomInt(seed: number, max: number): number {
  return Math.floor(seededRandom(seed) * max);
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

// Calculate position for a new fluff to the left of previous (from the cloud algorithm)
function calcPositionLeft(prev: FluffInfo, r: number, seed: number): FluffInfo {
  const r1 = prev.r;
  const r2 = r;
  const hLine = seededRandomInt(seed, Math.floor(prev.r / 1.5));

  const a = r1 - r2 - hLine;
  const h = r1 + r2;
  const bSquared = h * h - a * a;
  const b = bSquared > 0 ? Math.sqrt(bSquared) : 0;

  return { x: prev.x - b, y: prev.y + a, r: r2 };
}

// Calculate position for a new fluff to the right of previous
function calcPositionRight(prev: FluffInfo, r: number, seed: number): FluffInfo {
  const r1 = prev.r;
  const r2 = r;
  const hLine = seededRandomInt(seed, Math.floor(prev.r / 1.5));

  const a = r1 - r2 - hLine;
  const h = r1 + r2;
  const bSquared = h * h - a * a;
  const b = bSquared > 0 ? Math.sqrt(bSquared) : 0;

  return { x: prev.x + b, y: prev.y + a, r: r2 };
}

// Generate a fluffy cloud along an edge segment
function generateEdgeCloud(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  cellSize: number,
  seed: number,
  direction: 'top' | 'bottom' | 'left' | 'right'
): FluffInfo[] {
  const fluffs: FluffInfo[] = [];
  const length = Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2);

  const minSize = cellSize * 0.08;
  const maxSize = cellSize * 0.2;

  // Create the big central fluff
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;

  // Offset based on direction
  let offsetX = 0, offsetY = 0;
  switch (direction) {
    case 'top': offsetY = -cellSize * 0.05; break;
    case 'bottom': offsetY = cellSize * 0.05; break;
    case 'left': offsetX = -cellSize * 0.05; break;
    case 'right': offsetX = cellSize * 0.05; break;
  }

  const bigFluff: FluffInfo = {
    x: midX + offsetX,
    y: midY + offsetY,
    r: seededRandomRange(seed, minSize * 1.5, maxSize * 1.5),
  };

  fluffs.push(bigFluff);

  // Add fluffs to the left and right of the big fluff
  const amountOfFluff = 2 + seededRandomInt(seed + 1, 2);

  let prevFluffLeft = bigFluff;
  let prevFluffRight = bigFluff;

  for (let i = 0; i < amountOfFluff; i++) {
    const fluffSizeLeft = seededRandomRange(seed + i * 10, minSize, maxSize);
    const fluffSizeRight = seededRandomRange(seed + i * 10 + 5, minSize, maxSize);

    // For horizontal edges, expand left/right; for vertical, expand up/down
    if (direction === 'top' || direction === 'bottom') {
      const newFluffLeft = calcPositionLeft(prevFluffLeft, fluffSizeLeft, seed + i * 20);
      const newFluffRight = calcPositionRight(prevFluffRight, fluffSizeRight, seed + i * 20 + 10);

      // Adjust Y position to stay on edge
      newFluffLeft.y = bigFluff.y + (seededRandom(seed + i * 30) - 0.5) * cellSize * 0.1;
      newFluffRight.y = bigFluff.y + (seededRandom(seed + i * 30 + 1) - 0.5) * cellSize * 0.1;

      fluffs.push(newFluffLeft);
      fluffs.push(newFluffRight);

      prevFluffLeft = newFluffLeft;
      prevFluffRight = newFluffRight;
    } else {
      // Vertical edges - rotate the logic
      const newFluffUp: FluffInfo = {
        x: bigFluff.x + (seededRandom(seed + i * 30) - 0.5) * cellSize * 0.1,
        y: prevFluffLeft.y - fluffSizeLeft * 1.5,
        r: fluffSizeLeft,
      };
      const newFluffDown: FluffInfo = {
        x: bigFluff.x + (seededRandom(seed + i * 30 + 1) - 0.5) * cellSize * 0.1,
        y: prevFluffRight.y + fluffSizeRight * 1.5,
        r: fluffSizeRight,
      };

      fluffs.push(newFluffUp);
      fluffs.push(newFluffDown);

      prevFluffLeft = newFluffUp;
      prevFluffRight = newFluffDown;
    }
  }

  return fluffs;
}

// Generate all fluffy clouds for a region's edges
function generateRegionClouds(
  region: FogRegion,
  cellSize: number
): FluffInfo[] {
  const allFluffs: FluffInfo[] = [];
  const cells = region.cells;

  for (const key of cells) {
    const [col, row] = key.split(",").map(Number);
    const x = col * cellSize;
    const y = row * cellSize;
    const seed = col * 1000 + row;

    const hasTop = cells.has(`${col},${row - 1}`);
    const hasBottom = cells.has(`${col},${row + 1}`);
    const hasLeft = cells.has(`${col - 1},${row}`);
    const hasRight = cells.has(`${col + 1},${row}`);

    // Generate cloud puffs for exposed edges
    if (!hasTop) {
      const cloudFluffs = generateEdgeCloud(x, y, x + cellSize, y, cellSize, seed, 'top');
      allFluffs.push(...cloudFluffs);
    }
    if (!hasBottom) {
      const cloudFluffs = generateEdgeCloud(x, y + cellSize, x + cellSize, y + cellSize, cellSize, seed + 100, 'bottom');
      allFluffs.push(...cloudFluffs);
    }
    if (!hasLeft) {
      const cloudFluffs = generateEdgeCloud(x, y, x, y + cellSize, cellSize, seed + 200, 'left');
      allFluffs.push(...cloudFluffs);
    }
    if (!hasRight) {
      const cloudFluffs = generateEdgeCloud(x + cellSize, y, x + cellSize, y + cellSize, cellSize, seed + 300, 'right');
      allFluffs.push(...cloudFluffs);
    }

    // Extra corner puffs
    if (!hasTop && !hasLeft) {
      const r = seededRandomRange(seed + 400, cellSize * 0.1, cellSize * 0.18);
      allFluffs.push({ x: x, y: y, r });
    }
    if (!hasTop && !hasRight) {
      const r = seededRandomRange(seed + 401, cellSize * 0.1, cellSize * 0.18);
      allFluffs.push({ x: x + cellSize, y: y, r });
    }
    if (!hasBottom && !hasLeft) {
      const r = seededRandomRange(seed + 402, cellSize * 0.1, cellSize * 0.18);
      allFluffs.push({ x: x, y: y + cellSize, r });
    }
    if (!hasBottom && !hasRight) {
      const r = seededRandomRange(seed + 403, cellSize * 0.1, cellSize * 0.18);
      allFluffs.push({ x: x + cellSize, y: y + cellSize, r });
    }
  }

  return allFluffs;
}

// Draw fluff circle
function drawFluff(ctx: CanvasRenderingContext2D, fluff: FluffInfo) {
  ctx.moveTo(fluff.x + fluff.r, fluff.y);
  ctx.arc(fluff.x, fluff.y, fluff.r, 0, Math.PI * 2);
}

export function FogLayer({ paintedCells, grid, currentUserId, showFluffyClouds = true, isPlayingLocally = false }: FogLayerProps) {
  const { cellSize, width, height } = grid;

  const regions = useMemo(() => {
    return findConnectedRegions(paintedCells);
  }, [paintedCells]);

  // Pre-calculate cloud fluffs
  const regionClouds = useMemo(() => {
    if (!showFluffyClouds) return [];
    return regions.map(region => generateRegionClouds(region, cellSize));
  }, [regions, cellSize, showFluffyClouds]);

  const padding = cellSize * 0.08;
  const cornerRadius = cellSize * 0.2;

  return (
    <Group>
      {/* Base fog layer */}
      {regions.map((region, idx) => {
        const isCreator = currentUserId && region.creatorId === currentUserId && !isPlayingLocally;
        // Creator sees semi-transparent fog, others see fully opaque
        const baseOpacity = isCreator ? 0.35 : 1;
        const fillColor = isCreator ? "#e8e8e8" : "#c8c8c8";

        return (
          <Shape
            key={`region-${idx}-${region.minCol}-${region.minRow}`}
            sceneFunc={(konvaCtx, shape) => {
              const ctx = konvaCtx._context as CanvasRenderingContext2D;
              const cells = region.cells;

              // Draw each cell with rounded corners on exposed edges
              for (const key of cells) {
                const [col, row] = key.split(",").map(Number);
                if (col < 0 || col >= width || row < 0 || row >= height) continue;

                const x = col * cellSize - padding;
                const y = row * cellSize - padding;
                const size = cellSize + padding * 2;

                const hasTop = cells.has(`${col},${row - 1}`);
                const hasBottom = cells.has(`${col},${row + 1}`);
                const hasLeft = cells.has(`${col - 1},${row}`);
                const hasRight = cells.has(`${col + 1},${row}`);
                const hasTopLeft = cells.has(`${col - 1},${row - 1}`);
                const hasTopRight = cells.has(`${col + 1},${row - 1}`);
                const hasBottomLeft = cells.has(`${col - 1},${row + 1}`);
                const hasBottomRight = cells.has(`${col + 1},${row + 1}`);

                const tlRadius = (!hasTop && !hasLeft) ? cornerRadius :
                                 (hasTop && hasLeft && !hasTopLeft) ? cornerRadius * 0.5 : 0;
                const trRadius = (!hasTop && !hasRight) ? cornerRadius :
                                 (hasTop && hasRight && !hasTopRight) ? cornerRadius * 0.5 : 0;
                const blRadius = (!hasBottom && !hasLeft) ? cornerRadius :
                                 (hasBottom && hasLeft && !hasBottomLeft) ? cornerRadius * 0.5 : 0;
                const brRadius = (!hasBottom && !hasRight) ? cornerRadius :
                                 (hasBottom && hasRight && !hasBottomRight) ? cornerRadius * 0.5 : 0;

                ctx.beginPath();
                ctx.moveTo(x + tlRadius, y);
                ctx.lineTo(x + size - trRadius, y);
                if (trRadius > 0) ctx.quadraticCurveTo(x + size, y, x + size, y + trRadius);
                ctx.lineTo(x + size, y + size - brRadius);
                if (brRadius > 0) ctx.quadraticCurveTo(x + size, y + size, x + size - brRadius, y + size);
                ctx.lineTo(x + blRadius, y + size);
                if (blRadius > 0) ctx.quadraticCurveTo(x, y + size, x, y + size - blRadius);
                ctx.lineTo(x, y + tlRadius);
                if (tlRadius > 0) ctx.quadraticCurveTo(x, y, x + tlRadius, y);
                ctx.closePath();
                ctx.fill();
              }
            }}
            fill={fillColor}
            opacity={baseOpacity}
            shadowColor="rgba(40, 40, 40, 0.5)"
            shadowBlur={cellSize * 0.25}
            shadowOffset={{ x: cellSize * 0.03, y: cellSize * 0.05 }}
            listening={false}
          />
        );
      })}

      {/* Fluffy cloud puffs layer */}
      {showFluffyClouds && regions.map((region, idx) => {
        const isCreator = currentUserId && region.creatorId === currentUserId && !isPlayingLocally;
        const cloudOpacity = isCreator ? 0.3 : 1;
        const fluffs = regionClouds[idx] || [];

        if (fluffs.length === 0) return null;

        // Calculate bounds for gradient
        const minY = region.minRow * cellSize;
        const maxY = (region.maxRow + 1) * cellSize;

        // Use darker colors for non-creators to ensure opacity
        const gradientTop = isCreator ? "#ffffff" : "#e0e0e0";
        const gradientBottom = isCreator ? "#f8f8f8" : "#d0d0d0";

        return (
          <Shape
            key={`clouds-${idx}-${region.minCol}-${region.minRow}`}
            sceneFunc={(konvaCtx, shape) => {
              const ctx = konvaCtx._context as CanvasRenderingContext2D;

              ctx.beginPath();

              // Draw all fluffs
              fluffs.forEach(fluff => {
                drawFluff(ctx, fluff);
              });

              // Create gradient fill like the cloud example
              const gradient = ctx.createLinearGradient(0, minY, 0, maxY);
              gradient.addColorStop(0, gradientTop);
              gradient.addColorStop(0.5, gradientTop);
              gradient.addColorStop(1, gradientBottom);

              ctx.fillStyle = gradient;

              // Add shadow
              ctx.shadowColor = "rgba(80, 80, 80, 0.15)";
              ctx.shadowBlur = cellSize * 0.1;
              ctx.shadowOffsetX = cellSize * 0.02;
              ctx.shadowOffsetY = cellSize * 0.03;

              ctx.fill();
            }}
            opacity={cloudOpacity}
            listening={false}
          />
        );
      })}

      {/* Soft outer glow layer */}
      {regions.map((region, idx) => {
        const isCreator = currentUserId && region.creatorId === currentUserId && !isPlayingLocally;
        const glowOpacity = isCreator ? 0.1 : 0.35;

        return (
          <Shape
            key={`glow-${idx}-${region.minCol}-${region.minRow}`}
            sceneFunc={(konvaCtx, shape) => {
              const ctx = konvaCtx._context as CanvasRenderingContext2D;
              const cells = region.cells;
              const glowSize = cellSize * 0.25;

              for (const key of cells) {
                const [col, row] = key.split(",").map(Number);
                if (col < 0 || col >= width || row < 0 || row >= height) continue;

                const x = col * cellSize;
                const y = row * cellSize;

                const hasTop = cells.has(`${col},${row - 1}`);
                const hasBottom = cells.has(`${col},${row + 1}`);
                const hasLeft = cells.has(`${col - 1},${row}`);
                const hasRight = cells.has(`${col + 1},${row}`);

                if (!hasTop) {
                  const gradient = ctx.createLinearGradient(x, y - glowSize, x, y);
                  gradient.addColorStop(0, "rgba(240, 240, 240, 0)");
                  gradient.addColorStop(1, "rgba(240, 240, 240, 1)");
                  ctx.fillStyle = gradient;
                  ctx.fillRect(x, y - glowSize, cellSize, glowSize);
                }
                if (!hasBottom) {
                  const gradient = ctx.createLinearGradient(x, y + cellSize, x, y + cellSize + glowSize);
                  gradient.addColorStop(0, "rgba(240, 240, 240, 1)");
                  gradient.addColorStop(1, "rgba(240, 240, 240, 0)");
                  ctx.fillStyle = gradient;
                  ctx.fillRect(x, y + cellSize, cellSize, glowSize);
                }
                if (!hasLeft) {
                  const gradient = ctx.createLinearGradient(x - glowSize, y, x, y);
                  gradient.addColorStop(0, "rgba(240, 240, 240, 0)");
                  gradient.addColorStop(1, "rgba(240, 240, 240, 1)");
                  ctx.fillStyle = gradient;
                  ctx.fillRect(x - glowSize, y, glowSize, cellSize);
                }
                if (!hasRight) {
                  const gradient = ctx.createLinearGradient(x + cellSize, y, x + cellSize + glowSize, y);
                  gradient.addColorStop(0, "rgba(240, 240, 240, 1)");
                  gradient.addColorStop(1, "rgba(240, 240, 240, 0)");
                  ctx.fillStyle = gradient;
                  ctx.fillRect(x + cellSize, y, glowSize, cellSize);
                }

                // Corner gradients
                if (!hasTop && !hasLeft) {
                  const gradient = ctx.createRadialGradient(x, y, 0, x, y, glowSize);
                  gradient.addColorStop(0, "rgba(240, 240, 240, 1)");
                  gradient.addColorStop(1, "rgba(240, 240, 240, 0)");
                  ctx.fillStyle = gradient;
                  ctx.fillRect(x - glowSize, y - glowSize, glowSize, glowSize);
                }
                if (!hasTop && !hasRight) {
                  const gradient = ctx.createRadialGradient(x + cellSize, y, 0, x + cellSize, y, glowSize);
                  gradient.addColorStop(0, "rgba(240, 240, 240, 1)");
                  gradient.addColorStop(1, "rgba(240, 240, 240, 0)");
                  ctx.fillStyle = gradient;
                  ctx.fillRect(x + cellSize, y - glowSize, glowSize, glowSize);
                }
                if (!hasBottom && !hasLeft) {
                  const gradient = ctx.createRadialGradient(x, y + cellSize, 0, x, y + cellSize, glowSize);
                  gradient.addColorStop(0, "rgba(240, 240, 240, 1)");
                  gradient.addColorStop(1, "rgba(240, 240, 240, 0)");
                  ctx.fillStyle = gradient;
                  ctx.fillRect(x - glowSize, y + cellSize, glowSize, glowSize);
                }
                if (!hasBottom && !hasRight) {
                  const gradient = ctx.createRadialGradient(x + cellSize, y + cellSize, 0, x + cellSize, y + cellSize, glowSize);
                  gradient.addColorStop(0, "rgba(240, 240, 240, 1)");
                  gradient.addColorStop(1, "rgba(240, 240, 240, 0)");
                  ctx.fillStyle = gradient;
                  ctx.fillRect(x + cellSize, y + cellSize, glowSize, glowSize);
                }
              }
            }}
            opacity={glowOpacity}
            listening={false}
          />
        );
      })}
    </Group>
  );
}
