import { Circle, Group, Text } from "react-konva";
import type { Token } from "../../types";
import { useMapStore, useEditorStore } from "../../store";

interface TokenLayerProps {
  tokens: Token[];
  cellSize: number;
}

export function TokenLayer({ tokens, cellSize }: TokenLayerProps) {
  const moveToken = useMapStore((s) => s.moveToken);
  const selectedTool = useEditorStore((s) => s.selectedTool);
  const selectedIds = useEditorStore((s) => s.selectedElementIds);
  const setSelectedElements = useEditorStore((s) => s.setSelectedElements);

  const handleDragEnd = (token: Token, e: any) => {
    const node = e.target;
    const x = node.x();
    const y = node.y();

    // Calculate the center offset for multi-cell tokens
    const offset = (token.size * cellSize) / 2;

    // Snap to grid - find the top-left cell position
    const col = Math.round((x - offset) / cellSize);
    const row = Math.round((y - offset) / cellSize);

    // Position at center of the token's area
    const newX = col * cellSize + offset;
    const newY = row * cellSize + offset;
    node.position({ x: newX, y: newY });

    moveToken(token.id, { col, row });
  };

  const handleClick = (token: Token, e: any) => {
    if (selectedTool !== "select") return;
    e.cancelBubble = true;
    setSelectedElements([token.id]);
  };

  return (
    <>
      {tokens.map((token) => {
        if (!token.visible) return null;

        // Calculate center position for multi-cell tokens
        const offset = (token.size * cellSize) / 2;
        const x = token.position.col * cellSize + offset;
        const y = token.position.row * cellSize + offset;
        const radius = offset - 4;
        const isSelected = selectedIds.includes(token.id);

        return (
          <Group
            key={token.id}
            x={x}
            y={y}
            draggable={selectedTool === "select"}
            onDragEnd={(e) => handleDragEnd(token, e)}
            onClick={(e) => handleClick(token, e)}
            onTap={(e) => handleClick(token, e)}
          >
            {isSelected && (
              <Circle
                radius={radius + 4}
                stroke="#3b82f6"
                strokeWidth={3}
                dash={[5, 5]}
              />
            )}
            <Circle radius={radius} fill={token.color} />
            <Text
              text={token.name.charAt(0).toUpperCase()}
              fontSize={radius}
              fill="#ffffff"
              align="center"
              verticalAlign="middle"
              offsetX={radius / 3}
              offsetY={radius / 2.5}
            />
          </Group>
        );
      })}
    </>
  );
}
