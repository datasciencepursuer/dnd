import { memo } from "react";
import { Group, Circle, Rect } from "react-konva";
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
      t.characterSheet &&
      (
        (t.characterSheet.auraCircleEnabled === true && (t.characterSheet.auraCircleRange ?? 0) > 0) ||
        (t.characterSheet.auraSquareEnabled === true && (t.characterSheet.auraSquareRange ?? 0) > 0)
      )
  );

  if (auraTokens.length === 0) return null;

  return (
    <>
      {auraTokens.map((token) => {
        const sheet = token.characterSheet!;
        const tokenOffset = (token.size * cellSize) / 2;
        const cx = token.position.col * cellSize + tokenOffset;
        const cy = token.position.row * cellSize + tokenOffset;
        const color = token.color;

        const circleOn = sheet.auraCircleEnabled === true && (sheet.auraCircleRange ?? 0) > 0;
        const squareOn = sheet.auraSquareEnabled === true && (sheet.auraSquareRange ?? 0) > 0;

        return (
          <Group key={`aura-${token.id}`} x={cx} y={cy}>
            {circleOn && (() => {
              const radius = tokenOffset + (sheet.auraCircleRange / 5) * cellSize;
              return (
                <>
                  <Circle radius={radius} fill={color} opacity={0.15} />
                  <Circle radius={radius} stroke={color} strokeWidth={2} opacity={0.5} dash={[8, 4]} />
                </>
              );
            })()}
            {squareOn && (() => {
              const halfSide = tokenOffset + (sheet.auraSquareRange / 5) * cellSize;
              const side = halfSide * 2;
              return (
                <>
                  <Rect x={-halfSide} y={-halfSide} width={side} height={side} fill={color} opacity={0.15} />
                  <Rect x={-halfSide} y={-halfSide} width={side} height={side} stroke={color} strokeWidth={2} opacity={0.5} dash={[8, 4]} />
                </>
              );
            })()}
          </Group>
        );
      })}
    </>
  );
});
