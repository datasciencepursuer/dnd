import { memo } from "react";
import { Group, Circle } from "react-konva";
import type { Token } from "../../types";

interface AuraLayerProps {
  tokens: Token[] | undefined;
  cellSize: number;
}

export const AuraLayer = memo(function AuraLayer({ tokens, cellSize }: AuraLayerProps) {
  if (!tokens) return null;

  const auraTokens = tokens.filter(
    (t) =>
      t.visible &&
      t.characterSheet?.auraEnabled === true &&
      (t.characterSheet.auraRange ?? 0) > 0
  );

  if (auraTokens.length === 0) return null;

  return (
    <>
      {auraTokens.map((token) => {
        const range = token.characterSheet!.auraRange;
        const radius = (range / 5) * cellSize;
        const tokenOffset = (token.size * cellSize) / 2;
        const cx = token.position.col * cellSize + tokenOffset;
        const cy = token.position.row * cellSize + tokenOffset;
        const color = token.color;

        return (
          <Group key={`aura-${token.id}`} x={cx} y={cy}>
            <Circle
              radius={radius}
              fill={color}
              opacity={0.15}
            />
            <Circle
              radius={radius}
              stroke={color}
              strokeWidth={2}
              opacity={0.5}
              dash={[8, 4]}
            />
          </Group>
        );
      })}
    </>
  );
});
