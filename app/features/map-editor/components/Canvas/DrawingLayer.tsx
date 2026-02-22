import { Line } from "react-konva";
import { memo, useState } from "react";
import type { FreehandPath } from "../../types";

interface DrawingLayerProps {
  paths: FreehandPath[];
  currentPath: number[] | null;
  currentColor: string;
  currentWidth: number;
  isEraseMode?: boolean;
  isDragging?: boolean;
  onErasePath?: (id: string) => void;
  canErasePath?: (path: FreehandPath) => boolean;
}

export const DrawingLayer = memo(function DrawingLayer({
  paths,
  currentPath,
  currentColor,
  currentWidth,
  isEraseMode = false,
  isDragging = false,
  onErasePath,
  canErasePath,
}: DrawingLayerProps) {
  const [hoveredPathId, setHoveredPathId] = useState<string | null>(null);

  return (
    <>
      {/* Existing paths */}
      {paths.map((path) => {
        const eraseable = isEraseMode && !isDragging && (!canErasePath || canErasePath(path));
        return (
          <Line
            key={path.id}
            points={path.points}
            stroke={hoveredPathId === path.id && eraseable ? "#ef4444" : path.color}
            strokeWidth={hoveredPathId === path.id && eraseable ? path.width + 2 : path.width}
            tension={0.5}
            lineCap="round"
            lineJoin="round"
            globalCompositeOperation="source-over"
            listening={eraseable}
            hitStrokeWidth={eraseable ? 20 : 0}
            onMouseEnter={eraseable ? () => setHoveredPathId(path.id) : undefined}
            onMouseLeave={eraseable ? () => setHoveredPathId(null) : undefined}
            onClick={eraseable ? () => onErasePath?.(path.id) : undefined}
            onTap={eraseable ? () => onErasePath?.(path.id) : undefined}
          />
        );
      })}

      {/* Current drawing path */}
      {currentPath && currentPath.length >= 2 && (
        <Line
          points={currentPath}
          stroke={currentColor}
          strokeWidth={currentWidth}
          tension={0.5}
          lineCap="round"
          lineJoin="round"
          globalCompositeOperation="source-over"
          listening={false}
        />
      )}
    </>
  );
});
