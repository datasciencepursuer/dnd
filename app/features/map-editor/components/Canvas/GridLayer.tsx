import { memo } from "react";
import { Shape } from "react-konva";
import type { GridSettings } from "../../types";

interface GridLayerProps {
  grid: GridSettings;
}

export const GridLayer = memo(function GridLayer({ grid }: GridLayerProps) {
  if (!grid.showGrid) return null;

  const { cellSize, width, height, gridColor, gridOpacity } = grid;
  const totalWidth = width * cellSize;
  const totalHeight = height * cellSize;

  return (
    <Shape
      sceneFunc={(ctx, shape) => {
        ctx.beginPath();

        // Vertical lines
        for (let i = 0; i <= width; i++) {
          const x = i * cellSize;
          ctx.moveTo(x, 0);
          ctx.lineTo(x, totalHeight);
        }

        // Horizontal lines
        for (let i = 0; i <= height; i++) {
          const y = i * cellSize;
          ctx.moveTo(0, y);
          ctx.lineTo(totalWidth, y);
        }

        ctx.strokeShape(shape);
      }}
      stroke={gridColor}
      strokeWidth={1}
      opacity={gridOpacity}
      listening={false}
    />
  );
});
