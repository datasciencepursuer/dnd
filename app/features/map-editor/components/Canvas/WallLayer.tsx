import { Line, Circle } from "react-konva";
import { memo, useState } from "react";
import type { WallSegment } from "../../types";
import { WALL_STYLES } from "../../utils/terrain-utils";

interface WallLayerProps {
  walls: WallSegment[];
  cellSize: number;
  selectedWallId: string | null;
  isSelectMode: boolean;
  isEraseMode: boolean;
  isDragging: boolean;
  onSelectWall?: (wallId: string) => void;
  onEraseWall?: (wallId: string) => void;
}

export const WallLayer = memo(function WallLayer({
  walls,
  cellSize,
  selectedWallId,
  isSelectMode,
  isEraseMode,
  isDragging,
  onSelectWall,
  onEraseWall,
}: WallLayerProps) {
  const [hoveredWallId, setHoveredWallId] = useState<string | null>(null);
  const isInteractive = (isSelectMode || isEraseMode) && !isDragging;

  return (
    <>
      {walls.map((wall) => {
        const style = WALL_STYLES[wall.wallType];
        const isSelected = wall.id === selectedWallId;
        const isHovered = wall.id === hoveredWallId;

        // Convert grid-unit points to pixel coordinates
        const pixelPoints = wall.points.flatMap((p) => [
          p.x * cellSize,
          p.y * cellSize,
        ]);

        return (
          <Line
            key={wall.id}
            points={pixelPoints}
            stroke={
              isHovered && isEraseMode
                ? "#ef4444"
                : isSelected
                  ? "#3b82f6"
                  : style.color
            }
            strokeWidth={
              isHovered && isEraseMode
                ? style.width + 2
                : isSelected
                  ? style.width + 2
                  : style.width
            }
            dash={style.dash.length > 0 ? style.dash : undefined}
            lineCap="round"
            lineJoin="round"
            listening={isInteractive}
            hitStrokeWidth={isInteractive ? 20 : 0}
            onMouseEnter={
              isInteractive
                ? () => setHoveredWallId(wall.id)
                : undefined
            }
            onMouseLeave={
              isInteractive
                ? () => setHoveredWallId(null)
                : undefined
            }
            onClick={
              isInteractive
                ? () => {
                    if (isEraseMode) onEraseWall?.(wall.id);
                    else if (isSelectMode) onSelectWall?.(wall.id);
                  }
                : undefined
            }
            onTap={
              isInteractive
                ? () => {
                    if (isEraseMode) onEraseWall?.(wall.id);
                    else if (isSelectMode) onSelectWall?.(wall.id);
                  }
                : undefined
            }
          />
        );
      })}

      {/* Draw vertex dots for selected wall */}
      {selectedWallId &&
        walls
          .filter((w) => w.id === selectedWallId)
          .map((wall) =>
            wall.points.map((p, i) => (
              <Circle
                key={`${wall.id}-pt-${i}`}
                x={p.x * cellSize}
                y={p.y * cellSize}
                radius={4}
                fill="#3b82f6"
                stroke="#fff"
                strokeWidth={1}
                listening={false}
              />
            ))
          )}
    </>
  );
});
