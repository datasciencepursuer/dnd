import { Circle, Group, Text, Image, Rect, Line } from "react-konva";
import { useState, useEffect, useRef } from "react";
import type { Token } from "../../types";
import { useMapStore, useEditorStore } from "../../store";

interface DragState {
  tokenId: string;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

// Global cache for loaded images
const imageCache = new Map<string, HTMLImageElement>();

// Hook to load an image with caching
function useImage(url: string | null): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(() => {
    // Check cache on initial render
    if (url && imageCache.has(url)) {
      return imageCache.get(url) || null;
    }
    return null;
  });

  useEffect(() => {
    if (!url) {
      setImage(null);
      return;
    }

    // Check cache first
    if (imageCache.has(url)) {
      setImage(imageCache.get(url) || null);
      return;
    }

    const img = new window.Image();
    img.src = url;

    // Check if already loaded (from browser cache)
    if (img.complete && img.naturalWidth > 0) {
      imageCache.set(url, img);
      setImage(img);
      return;
    }

    img.onload = () => {
      imageCache.set(url, img);
      setImage(img);
    };

    return () => {
      img.onload = null;
    };
  }, [url]);

  return image;
}

interface TokenItemProps {
  token: Token;
  cellSize: number;
  isSelected: boolean;
  selectedTool: string;
  isDragging: boolean;
  onClick: (token: Token, e: any) => void;
  onFlip: (token: Token) => void;
  onMouseDown: (token: Token, e: any) => void;
}

function TokenItem({
  token,
  cellSize,
  isSelected,
  selectedTool,
  isDragging,
  onClick,
  onFlip,
  onMouseDown,
}: TokenItemProps) {
  const image = useImage(token.imageUrl);

  const offset = (token.size * cellSize) / 2;
  const x = token.position.col * cellSize + offset;
  const y = token.position.row * cellSize + offset;
  const radius = offset - 4;
  const maxSize = token.size * cellSize - 2; // Fill most of the cell

  // Calculate dimensions preserving aspect ratio
  let imgWidth = maxSize;
  let imgHeight = maxSize;
  if (image) {
    const aspectRatio = image.naturalWidth / image.naturalHeight;
    if (aspectRatio > 1) {
      // Wider than tall
      imgHeight = maxSize / aspectRatio;
    } else {
      // Taller than wide
      imgWidth = maxSize * aspectRatio;
    }
  }

  const handleFlipClick = (e: any) => {
    e.cancelBubble = true;
    onFlip(token);
  };

  const handleFlipMouseDown = (e: any) => {
    // Prevent drag from starting when clicking flip button
    e.cancelBubble = true;
  };

  // Flip button size and position
  const flipBtnSize = Math.min(20, maxSize / 3);
  const flipBtnX = imgWidth / 2 + 4;
  const flipBtnY = -imgHeight / 2 - 4;

  // Check if this is an image token (even if image hasn't loaded yet)
  const hasImageUrl = !!token.imageUrl;

  return (
    <Group
      x={x}
      y={y}
      opacity={isDragging ? 0.5 : 1}
      onMouseDown={(e) => onMouseDown(token, e)}
      onTouchStart={(e) => onMouseDown(token, e)}
      onClick={(e) => onClick(token, e)}
      onTap={(e) => onClick(token, e)}
    >
      {hasImageUrl ? (
        <>
          {isSelected && !isDragging && (
            <Rect
              width={imgWidth + 8}
              height={imgHeight + 8}
              offsetX={imgWidth / 2 + 4}
              offsetY={imgHeight / 2 + 4}
              stroke="#3b82f6"
              strokeWidth={3}
              dash={[5, 5]}
            />
          )}
          {image && (
            <Image
              image={image}
              width={imgWidth}
              height={imgHeight}
              offsetX={imgWidth / 2}
              offsetY={imgHeight / 2}
              scaleX={token.flipped ? -1 : 1}
            />
          )}
          {isSelected && !isDragging && (
            <Group
              x={flipBtnX}
              y={flipBtnY}
              onMouseDown={handleFlipMouseDown}
              onTouchStart={handleFlipMouseDown}
              onClick={handleFlipClick}
              onTap={handleFlipClick}
            >
              <Circle
                radius={flipBtnSize / 2}
                fill="#3b82f6"
                stroke="#ffffff"
                strokeWidth={2}
              />
              <Text
                text="⇄"
                fontSize={flipBtnSize * 0.7}
                fill="#ffffff"
                offsetX={flipBtnSize * 0.25}
                offsetY={flipBtnSize * 0.35}
              />
            </Group>
          )}
        </>
      ) : (
        <>
          {isSelected && !isDragging && (
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
        </>
      )}
    </Group>
  );
}

// Ghost preview of token at drag destination
function TokenGhost({
  token,
  cellSize,
  x,
  y,
}: {
  token: Token;
  cellSize: number;
  x: number;
  y: number;
}) {
  const image = useImage(token.imageUrl);
  const offset = (token.size * cellSize) / 2;
  const radius = offset - 4;
  const maxSize = token.size * cellSize - 2;
  const hasImageUrl = !!token.imageUrl;

  let imgWidth = maxSize;
  let imgHeight = maxSize;
  if (image) {
    const aspectRatio = image.naturalWidth / image.naturalHeight;
    if (aspectRatio > 1) {
      imgHeight = maxSize / aspectRatio;
    } else {
      imgWidth = maxSize * aspectRatio;
    }
  }

  return (
    <Group x={x} y={y} opacity={0.7}>
      {hasImageUrl ? (
        image && (
          <Image
            image={image}
            width={imgWidth}
            height={imgHeight}
            offsetX={imgWidth / 2}
            offsetY={imgHeight / 2}
            scaleX={token.flipped ? -1 : 1}
          />
        )
      ) : (
        <>
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
        </>
      )}
    </Group>
  );
}

interface TokenLayerProps {
  tokens: Token[];
  cellSize: number;
  stageRef: React.RefObject<any>;
}

export function TokenLayer({ tokens, cellSize, stageRef }: TokenLayerProps) {
  const moveToken = useMapStore((s) => s.moveToken);
  const flipToken = useMapStore((s) => s.flipToken);
  const selectedTool = useEditorStore((s) => s.selectedTool);
  const selectedIds = useEditorStore((s) => s.selectedElementIds);
  const setSelectedElements = useEditorStore((s) => s.setSelectedElements);

  const [dragState, setDragState] = useState<DragState | null>(null);
  const draggingTokenRef = useRef<Token | null>(null);

  // Handle mouse move during drag
  useEffect(() => {
    if (!dragState || !stageRef.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      const stage = stageRef.current;
      if (!stage) return;

      const container = stage.container();
      const rect = container.getBoundingClientRect();

      const scale = stage.scaleX();
      const stageX = stage.x();
      const stageY = stage.y();

      // Convert mouse position to stage coordinates
      const mouseX = (e.clientX - rect.left - stageX) / scale;
      const mouseY = (e.clientY - rect.top - stageY) / scale;

      setDragState((prev) =>
        prev ? { ...prev, currentX: mouseX, currentY: mouseY } : null
      );
    };

    const handleMouseUp = () => {
      if (dragState && draggingTokenRef.current) {
        const token = draggingTokenRef.current;
        const offset = (token.size * cellSize) / 2;

        // Snap to grid
        const col = Math.round((dragState.currentX - offset) / cellSize);
        const row = Math.round((dragState.currentY - offset) / cellSize);

        moveToken(token.id, { col, row });
      }
      setDragState(null);
      draggingTokenRef.current = null;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchmove", handleMouseMove as any);
    window.addEventListener("touchend", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleMouseMove as any);
      window.removeEventListener("touchend", handleMouseUp);
    };
  }, [dragState, cellSize, moveToken, stageRef]);

  const handleMouseDown = (token: Token, e: any) => {
    if (selectedTool !== "select") return;
    e.cancelBubble = true;

    // Prevent default drag behavior
    if (e.evt) {
      e.evt.preventDefault();
    }

    const offset = (token.size * cellSize) / 2;
    const x = token.position.col * cellSize + offset;
    const y = token.position.row * cellSize + offset;

    draggingTokenRef.current = token;
    setDragState({
      tokenId: token.id,
      startX: x,
      startY: y,
      currentX: x,
      currentY: y,
    });

    setSelectedElements([token.id]);
  };

  const handleClick = (token: Token, e: any) => {
    if (selectedTool !== "select") return;
    if (dragState) return; // Don't handle click if we were dragging
    e.cancelBubble = true;
    setSelectedElements([token.id]);
  };

  const handleFlip = (token: Token) => {
    flipToken(token.id);
  };

  // Calculate L-shaped path points (move X first, then Y)
  const getPathPoints = (
    startX: number,
    startY: number,
    endX: number,
    endY: number
  ): number[] => {
    // L-shape: start -> corner (endX, startY) -> end
    return [startX, startY, endX, startY, endX, endY];
  };

  // Get snapped destination for ghost
  const getSnappedPosition = (token: Token, x: number, y: number) => {
    const offset = (token.size * cellSize) / 2;
    const col = Math.round((x - offset) / cellSize);
    const row = Math.round((y - offset) / cellSize);
    return {
      x: col * cellSize + offset,
      y: row * cellSize + offset,
    };
  };

  return (
    <>
      {/* Draw path line when dragging */}
      {dragState && draggingTokenRef.current && (
        <>
          {(() => {
            const snapped = getSnappedPosition(
              draggingTokenRef.current,
              dragState.currentX,
              dragState.currentY
            );
            return (
              <>
                <Line
                  points={getPathPoints(
                    dragState.startX,
                    dragState.startY,
                    snapped.x,
                    snapped.y
                  )}
                  stroke="#3b82f6"
                  strokeWidth={3}
                  dash={[10, 5]}
                  lineCap="round"
                  lineJoin="round"
                />
                {/* Ghost at destination */}
                <TokenGhost
                  token={draggingTokenRef.current}
                  cellSize={cellSize}
                  x={snapped.x}
                  y={snapped.y}
                />
              </>
            );
          })()}
        </>
      )}

      {tokens.map((token) => {
        if (!token.visible) return null;

        return (
          <TokenItem
            key={token.id}
            token={token}
            cellSize={cellSize}
            isSelected={selectedIds.includes(token.id)}
            selectedTool={selectedTool}
            isDragging={dragState?.tokenId === token.id}
            onClick={handleClick}
            onFlip={handleFlip}
            onMouseDown={handleMouseDown}
          />
        );
      })}
    </>
  );
}
