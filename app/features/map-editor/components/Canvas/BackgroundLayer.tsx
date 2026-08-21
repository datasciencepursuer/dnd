import { memo } from "react";
import { Image } from "react-konva";
import type { Background, GridSettings } from "../../types";
import { useImage } from "../../hooks";

// Backgrounds are drawn into the finite grid rectangle, so there is no reason to
// keep a 32MB upload at full resolution in memory. The detail factor leaves
// headroom for zooming in past 1:1 before the downscale becomes visible, and the
// ceiling keeps the decoded bitmap bounded on very large grids.
const BACKGROUND_DETAIL_FACTOR = 2;
const BACKGROUND_MAX_DIMENSION = 4096;
// Quantize so small grid tweaks (cellSize nudges) don't invalidate the cached
// downscale on every change — `useImage` caches per `url#maxSize`.
const BACKGROUND_SIZE_BUCKET = 256;

function backgroundMaxSize(grid: GridSettings): number {
  const longestEdge = Math.max(grid.width * grid.cellSize, grid.height * grid.cellSize);
  const target = Math.max(1, longestEdge) * BACKGROUND_DETAIL_FACTOR;
  const bucketed = Math.ceil(target / BACKGROUND_SIZE_BUCKET) * BACKGROUND_SIZE_BUCKET;
  return Math.min(bucketed, BACKGROUND_MAX_DIMENSION);
}

interface BackgroundLayerProps {
  background: Background | null;
  grid: GridSettings;
}

export const BackgroundLayer = memo(function BackgroundLayer({ background, grid }: BackgroundLayerProps) {
  const image = useImage(background?.imageUrl ?? null, backgroundMaxSize(grid));

  if (!image || !background) return null;

  // Scale image to fit the grid
  const gridWidth = grid.width * grid.cellSize;
  const gridHeight = grid.height * grid.cellSize;

  return (
    <Image
      image={image}
      x={background.position.x}
      y={background.position.y}
      width={gridWidth}
      height={gridHeight}
      opacity={0.8}
      listening={false}
    />
  );
});
