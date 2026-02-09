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
}

export const DrawingLayer = memo(function DrawingLayer({
  paths,
  currentPath,
  currentColor,
  currentWidth,
  isEraseMode = false,
  isDragging = false,
  onErasePath,
}: DrawingLayerProps) {
  const [hoveredPathId, setHoveredPathId] = useState<string | null>(null);

  return (
    <>
      {/* Existing paths */}
      {paths.map((path) => (
        <Line
          key={path.id}
          points={path.points}
          stroke={hoveredPathId === path.id && isEraseMode ? "#ef4444" : path.color}
          strokeWidth={hoveredPathId === path.id && isEraseMode ? path.width + 2 : path.width}
          tension={0.5}
          lineCap="round"
          lineJoin="round"
          globalCompositeOperation="source-over"
          listening={isEraseMode && !isDragging}
          hitStrokeWidth={isEraseMode && !isDragging ? 20 : 0}
          onMouseEnter={isEraseMode ? () => setHoveredPathId(path.id) : undefined}
          onMouseLeave={isEraseMode ? () => setHoveredPathId(null) : undefined}
          onClick={isEraseMode ? () => onErasePath?.(path.id) : undefined}
          onTap={isEraseMode ? () => onErasePath?.(path.id) : undefined}
        />
      ))}

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
