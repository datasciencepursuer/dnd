import { Line, Circle, Rect, Text, Group } from "react-konva";
import { memo, useState } from "react";
import type { WallSegment, WallType } from "../../types";
import { WALL_STYLES } from "../../utils/terrain-utils";

const WALL_LABELS: Record<WallType, string> = {
  wall: "Wall",
  "half-wall": "Half Wall",
  window: "Window",
  "arrow-slit": "Arrow Slit",
  "door-closed": "Door (Closed)",
  "door-open": "Door (Open)",
  "door-locked": "Door (Locked)",
  pillar: "Pillar",
  fence: "Fence",
};

interface WallLayerProps {
  walls: WallSegment[];
  cellSize: number;
  selectedWallId: string | null;
  isSelectMode: boolean;
  isEraseMode: boolean;
  isDragging: boolean;
  isDmView?: boolean;
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
  isDmView,
  onSelectWall,
  onEraseWall,
}: WallLayerProps) {
  const [hoveredWallId, setHoveredWallId] = useState<string | null>(null);
  const isInteractive = (isSelectMode || isEraseMode) && !isDragging;
  const canHover = isInteractive || (isDmView && !isDragging);

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
            listening={canHover}
            hitStrokeWidth={canHover ? 20 : 0}
            onMouseEnter={
              canHover
                ? () => setHoveredWallId(wall.id)
                : undefined
            }
            onMouseLeave={
              canHover
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

      {/* DM hover tooltip */}
      {isDmView && hoveredWallId && walls.map((wall) => {
        if (wall.id !== hoveredWallId || wall.points.length < 2) return null;

        // Position tooltip at midpoint of the wall
        const midIdx = Math.floor(wall.points.length / 2);
        const p0 = wall.points[midIdx - 1] || wall.points[0];
        const p1 = wall.points[midIdx];
        const midX = ((p0.x + p1.x) / 2) * cellSize;
        const midY = ((p0.y + p1.y) / 2) * cellSize;
        const label = WALL_LABELS[wall.wallType] || wall.wallType;
        const tooltipWidth = label.length * 7 + 12;

        return (
          <Group key={`${wall.id}-tooltip`} listening={false}>
            <Rect
              x={midX - tooltipWidth / 2}
              y={midY - 24}
              width={tooltipWidth}
              height={18}
              fill="rgba(0,0,0,0.8)"
              cornerRadius={4}
            />
            <Text
              x={midX - tooltipWidth / 2 + 6}
              y={midY - 21}
              text={label}
              fontSize={11}
              fill="#fff"
              listening={false}
            />
          </Group>
        );
      })}
    </>
  );
});
