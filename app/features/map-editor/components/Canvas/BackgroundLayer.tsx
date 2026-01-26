import { Image } from "react-konva";
import { useState, useEffect } from "react";
import type { Background, GridSettings } from "../../types";

interface BackgroundLayerProps {
  background: Background | null;
  grid: GridSettings;
}

export function BackgroundLayer({ background, grid }: BackgroundLayerProps) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!background?.imageUrl) {
      setImage(null);
      return;
    }

    const img = new window.Image();
    img.src = background.imageUrl;
    img.onload = () => setImage(img);

    return () => {
      img.onload = null;
    };
  }, [background?.imageUrl]);

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
    />
  );
}
