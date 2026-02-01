import { Image } from "react-konva";
import type { Background, GridSettings } from "../../types";
import { useImage } from "../../hooks";

interface BackgroundLayerProps {
  background: Background | null;
  grid: GridSettings;
}

export function BackgroundLayer({ background, grid }: BackgroundLayerProps) {
  const image = useImage(background?.imageUrl ?? null);

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
}
