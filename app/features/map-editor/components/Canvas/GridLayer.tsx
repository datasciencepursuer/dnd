import type { ReactNode } from "react";
import { Line } from "react-konva";
import type { GridSettings } from "../../types";

interface GridLayerProps {
  grid: GridSettings;
}

export function GridLayer({ grid }: GridLayerProps) {
  if (!grid.showGrid) return null;

  const { cellSize, width, height, gridColor, gridOpacity } = grid;
  const totalWidth = width * cellSize;
  const totalHeight = height * cellSize;

  const lines: ReactNode[] = [];

  // Vertical lines
  for (let i = 0; i <= width; i++) {
    const x = i * cellSize;
    lines.push(
      <Line
        key={`v-${i}`}
        points={[x, 0, x, totalHeight]}
        stroke={gridColor}
        strokeWidth={1}
        opacity={gridOpacity}
        listening={false}
      />
    );
  }

  // Horizontal lines
  for (let i = 0; i <= height; i++) {
    const y = i * cellSize;
    lines.push(
      <Line
        key={`h-${i}`}
        points={[0, y, totalWidth, y]}
        stroke={gridColor}
        strokeWidth={1}
        opacity={gridOpacity}
        listening={false}
      />
    );
  }

  return <>{lines}</>;
}
