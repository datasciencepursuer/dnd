import { Rect, Text } from "react-konva";
import { memo, useState } from "react";
import type { AreaShape } from "../../types";

interface AreaLayerProps {
  areas: AreaShape[];
  cellSize: number;
  selectedAreaId: string | null;
  isSelectMode: boolean;
  isEraseMode: boolean;
  isDragging: boolean;
  onSelectArea?: (areaId: string) => void;
  onEraseArea?: (areaId: string) => void;
}

export const AreaLayer = memo(function AreaLayer({
  areas,
  cellSize,
  selectedAreaId,
  isSelectMode,
  isEraseMode,
  isDragging,
  onSelectArea,
  onEraseArea,
}: AreaLayerProps) {
  const [hoveredAreaId, setHoveredAreaId] = useState<string | null>(null);
  const isInteractive = (isSelectMode || isEraseMode) && !isDragging;

  return (
    <>
      {areas.map((area) => {
        if (area.type !== "rectangle" || area.points.length < 2) return null;

        const isSelected = area.id === selectedAreaId;
        const isHovered = area.id === hoveredAreaId;

        const minX = Math.min(area.points[0].x, area.points[1].x);
        const minY = Math.min(area.points[0].y, area.points[1].y);
        const w = Math.abs(area.points[1].x - area.points[0].x);
        const h = Math.abs(area.points[1].y - area.points[0].y);

        const pixelX = minX * cellSize;
        const pixelY = minY * cellSize;
        const pixelW = w * cellSize;
        const pixelH = h * cellSize;

        return (
          <Rect
            key={area.id}
            x={pixelX}
            y={pixelY}
            width={pixelW}
            height={pixelH}
            fill={isHovered && isEraseMode ? "#ef4444" : area.fillColor}
            opacity={isHovered && isEraseMode ? 0.5 : area.fillOpacity}
            stroke={
              isSelected
                ? "#3b82f6"
                : isHovered && isSelectMode
                  ? "#60a5fa"
                  : area.strokeColor
            }
            strokeWidth={isSelected ? 2 : area.strokeWidth}
            dash={isSelected ? [6, 4] : undefined}
            listening={isInteractive}
            onMouseEnter={
              isInteractive
                ? () => setHoveredAreaId(area.id)
                : undefined
            }
            onMouseLeave={
              isInteractive
                ? () => setHoveredAreaId(null)
                : undefined
            }
            onClick={
              isInteractive
                ? () => {
                    if (isEraseMode) onEraseArea?.(area.id);
                    else if (isSelectMode) onSelectArea?.(area.id);
                  }
                : undefined
            }
            onTap={
              isInteractive
                ? () => {
                    if (isEraseMode) onEraseArea?.(area.id);
                    else if (isSelectMode) onSelectArea?.(area.id);
                  }
                : undefined
            }
          />
        );
      })}

      {/* Labels */}
      {areas.map((area) => {
        if (area.type !== "rectangle" || area.points.length < 2 || !area.label) return null;

        const minX = Math.min(area.points[0].x, area.points[1].x);
        const minY = Math.min(area.points[0].y, area.points[1].y);
        const w = Math.abs(area.points[1].x - area.points[0].x);

        return (
          <Text
            key={`${area.id}-label`}
            x={minX * cellSize + 4}
            y={minY * cellSize + 2}
            text={area.label}
            fontSize={11}
            fill="#fff"
            width={w * cellSize - 8}
            listening={false}
          />
        );
      })}
    </>
  );
});
