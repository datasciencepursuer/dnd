import { Circle, Group, Text, Image, Rect, Line } from "react-konva";
import { useState, useRef, useCallback, useEffect } from "react";
import type { Token, GridPosition } from "../../types";
import { useMapStore, useEditorStore } from "../../store";
import { useImage } from "../../hooks";

interface DragState {
  tokenId: string;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

/**
 * Token-specific actions interface.
 * Each token gets its own set of bound actions that can be extended.
 */
export interface TokenItemActions {
  // Core actions
  move: (position: GridPosition) => void;
  flip: () => void;
  select: () => void;
  setName: (name: string) => void;

  // Extensible action hooks (can be customized per token)
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDoubleClick?: () => void;
  onRightClick?: () => void;

  // Custom actions (can be added for specific token types)
  custom?: Record<string, () => void>;
}

interface TokenItemProps {
  token: Token;
  cellSize: number;
  isSelected: boolean;
  isHovered: boolean;
  isEditable: boolean;
  isMovable: boolean;
  selectedTool: string;
  isDragging: boolean;
  actions: TokenItemActions;
  onMouseDown: (e: any) => void;
  onHoverStart: () => void;
  onHoverEnd: () => void;
}

function TokenItem({
  token,
  cellSize,
  isSelected,
  isHovered,
  isEditable,
  isMovable,
  selectedTool,
  isDragging,
  actions,
  onMouseDown,
  onHoverStart,
  onHoverEnd,
}: TokenItemProps) {
  const image = useImage(token.imageUrl);

  const offset = (token.size * cellSize) / 2;
  const x = token.position.col * cellSize + offset;
  const y = token.position.row * cellSize + offset;
  const radius = offset - 4;
  const maxSize = token.size * cellSize - 2; // Fill most of the cell

  // Hover highlight color - use token color for movable, gray for locked
  const hoverStroke = isMovable ? token.color : "#9ca3af";
  const hoverStrokeWidth = 2;

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
    if (!isEditable) return;
    e.cancelBubble = true;
    actions.flip();
  };

  const handleFlipMouseDown = (e: any) => {
    // Prevent drag from starting when clicking flip button
    e.cancelBubble = true;
  };

  const handleClick = (e: any) => {
    // Allow selection in select mode and draw mode (for color picking)
    if (selectedTool !== "select" && selectedTool !== "draw") return;
    e.cancelBubble = true;
    actions.select();
  };

  const handleRightClick = (e: any) => {
    e.cancelBubble = true;
    e.evt?.preventDefault();
    actions.onRightClick?.();
  };

  // Flip button size and position
  const flipBtnSize = Math.min(20, maxSize / 3);
  const flipBtnX = imgWidth / 2 + 4;
  const flipBtnY = -imgHeight / 2 - 4;

  // Check if this is an image token (even if image hasn't loaded yet)
  const hasImageUrl = !!token.imageUrl;

  // Calculate tooltip position
  const tooltipY = hasImageUrl ? -imgHeight / 2 - 24 : -radius - 24;

  // Lock icon position
  const lockY = hasImageUrl ? imgHeight / 2 + 8 : radius + 8;

  return (
    <Group
      x={x}
      y={y}
      rotation={token.rotation}
      opacity={isDragging ? 0.5 : 1}
      onMouseDown={isMovable ? onMouseDown : undefined}
      onTouchStart={isMovable ? onMouseDown : undefined}
      onClick={handleClick}
      onTap={handleClick}
      onContextMenu={handleRightClick}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
    >
      {hasImageUrl ? (
        <>
          {/* Hover highlight */}
          {isHovered && !isSelected && !isDragging && (
            <Rect
              width={imgWidth + 6}
              height={imgHeight + 6}
              offsetX={imgWidth / 2 + 3}
              offsetY={imgHeight / 2 + 3}
              stroke={hoverStroke}
              strokeWidth={hoverStrokeWidth}
              cornerRadius={4}
            />
          )}
          {isSelected && !isDragging && (
            <Rect
              width={imgWidth + 8}
              height={imgHeight + 8}
              offsetX={imgWidth / 2 + 4}
              offsetY={imgHeight / 2 + 4}
              stroke={isMovable ? token.color : "#9ca3af"}
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
          {isSelected && !isDragging && isEditable && (
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
                fill={token.color}
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
          {/* Hover highlight for circle tokens */}
          {isHovered && !isSelected && !isDragging && (
            <Circle
              radius={radius + 3}
              stroke={hoverStroke}
              strokeWidth={hoverStrokeWidth}
            />
          )}
          {isSelected && !isDragging && (
            <Circle
              radius={radius + 4}
              stroke={isMovable ? token.color : "#9ca3af"}
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

      {/* Lock indicator for non-movable tokens only */}
      {!isMovable && isHovered && (
        <Group y={lockY}>
          <Rect
            width={50}
            height={18}
            offsetX={25}
            offsetY={9}
            fill="rgba(0, 0, 0, 0.7)"
            cornerRadius={3}
          />
          <Text
            text="Locked"
            fontSize={10}
            fill="#f87171"
            align="center"
            width={50}
            offsetX={25}
            offsetY={5}
          />
        </Group>
      )}

      {/* Tooltip on hover */}
      {isHovered && !isDragging && (
        <Group y={tooltipY}>
          <Rect
            width={token.name.length * 8 + 16}
            height={22}
            offsetX={(token.name.length * 8 + 16) / 2}
            offsetY={11}
            fill="rgba(0, 0, 0, 0.8)"
            cornerRadius={4}
          />
          <Text
            text={token.name}
            fontSize={12}
            fill="#ffffff"
            align="center"
            width={token.name.length * 8 + 16}
            offsetX={(token.name.length * 8 + 16) / 2}
            offsetY={6}
          />
        </Group>
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
  onTokenMoved?: (tokenId: string, position: GridPosition) => void;
  onTokenFlip?: (tokenId: string) => void;
}

export function TokenLayer({ tokens, cellSize, stageRef, onTokenMoved, onTokenFlip }: TokenLayerProps) {
  const moveToken = useMapStore((s) => s.moveToken);
  const flipToken = useMapStore((s) => s.flipToken);
  const updateToken = useMapStore((s) => s.updateToken);
  const selectedTool = useEditorStore((s) => s.selectedTool);
  const selectedIds = useEditorStore((s) => s.selectedElementIds);
  const setSelectedElements = useEditorStore((s) => s.setSelectedElements);
  const canEditToken = useEditorStore((s) => s.canEditToken);
  const canMoveToken = useEditorStore((s) => s.canMoveToken);

  const [dragState, setDragState] = useState<DragState | null>(null);
  const [hoveredTokenId, setHoveredTokenId] = useState<string | null>(null);
  const draggingTokenRef = useRef<Token | null>(null);
  const isDraggingRef = useRef(false);
  const dragPositionRef = useRef<{ x: number; y: number } | null>(null);

  // Create token-specific actions factory
  const createTokenActions = useCallback(
    (token: Token, isEditable: boolean): TokenItemActions => ({
      move: (position: GridPosition) => {
        if (isEditable) moveToken(token.id, position);
      },
      flip: () => {
        if (isEditable) {
          flipToken(token.id);
          onTokenFlip?.(token.id);
        }
      },
      select: () => setSelectedElements([token.id]),
      setName: (name: string) => {
        if (isEditable) updateToken(token.id, { name });
      },

      // Extensible hooks - can be customized based on token type/layer
      onDragStart: () => {
        // Can add token-specific drag start behavior
      },
      onDragEnd: () => {
        // Can add token-specific drag end behavior
      },
      onRightClick: () => {
        // Can open context menu
        console.log(`Right-clicked token: ${token.name}`);
      },

      // Custom actions based on token layer type
      custom: token.layer === "character"
        ? {
            openCharacterSheet: () => console.log("Open character sheet"),
          }
        : token.layer === "monster"
        ? {
            rollInitiative: () => console.log("Roll initiative"),
          }
        : {
            toggleInteractable: () => console.log("Toggle interactable"),
          },
    }),
    [moveToken, flipToken, updateToken, setSelectedElements, onTokenFlip]
  );

  // Handle mouse move during drag - use refs to avoid effect re-running on every mouse move
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !stageRef.current) return;

      const stage = stageRef.current;
      const container = stage.container();
      const rect = container.getBoundingClientRect();

      const scale = stage.scaleX();
      const stageX = stage.x();
      const stageY = stage.y();

      // Convert mouse position to stage coordinates
      const mouseX = (e.clientX - rect.left - stageX) / scale;
      const mouseY = (e.clientY - rect.top - stageY) / scale;

      // Store in ref for the mouseUp handler
      dragPositionRef.current = { x: mouseX, y: mouseY };

      // Update state for rendering (throttled by React's batching)
      setDragState((prev) =>
        prev ? { ...prev, currentX: mouseX, currentY: mouseY } : null
      );
    };

    const handleMouseUp = () => {
      if (!isDraggingRef.current) return;

      const token = draggingTokenRef.current;
      const position = dragPositionRef.current;

      if (token && position) {
        const offset = (token.size * cellSize) / 2;

        // Snap to grid
        const col = Math.round((position.x - offset) / cellSize);
        const row = Math.round((position.y - offset) / cellSize);

        // Only move if user can move this token
        if (canMoveToken(token.ownerId)) {
          moveToken(token.id, { col, row });
          // Trigger immediate sync for real-time updates
          onTokenMoved?.(token.id, { col, row });
        }
      }

      // Clean up
      isDraggingRef.current = false;
      dragPositionRef.current = null;
      draggingTokenRef.current = null;
      setDragState(null);
    };

    // Set up listeners once on mount
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
  }, [cellSize, moveToken, stageRef, canMoveToken, onTokenMoved]); // Removed dragState from deps

  const handleMouseDown = useCallback(
    (token: Token, e: any) => {
      if (selectedTool !== "select") return;
      // Check if user can move this token
      if (!canMoveToken(token.ownerId)) return;

      e.cancelBubble = true;

      // Prevent default drag behavior
      if (e.evt) {
        e.evt.preventDefault();
      }

      const offset = (token.size * cellSize) / 2;
      const x = token.position.col * cellSize + offset;
      const y = token.position.row * cellSize + offset;

      // Set refs for the drag handlers
      isDraggingRef.current = true;
      dragPositionRef.current = { x, y };
      draggingTokenRef.current = token;

      setDragState({
        tokenId: token.id,
        startX: x,
        startY: y,
        currentX: x,
        currentY: y,
      });

      setSelectedElements([token.id]);
    },
    [selectedTool, cellSize, setSelectedElements, canMoveToken]
  );

  const isPanning = useEditorStore((s) => s.isPanning);

  const handleHoverStart = useCallback(
    (tokenId: string) => {
      setHoveredTokenId(tokenId);
      // Change cursor to pointer (only if not panning)
      if (stageRef.current && !isPanning) {
        stageRef.current.container().style.cursor = "pointer";
      }
    },
    [stageRef, isPanning]
  );

  const handleHoverEnd = useCallback(() => {
    setHoveredTokenId(null);
    // Reset cursor (only if not panning)
    if (stageRef.current && !isPanning) {
      stageRef.current.container().style.cursor = "default";
    }
  }, [stageRef, isPanning]);

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
            const token = draggingTokenRef.current;
            const snapped = getSnappedPosition(
              token,
              dragState.currentX,
              dragState.currentY
            );

            // Calculate distance in cells (using center-to-center)
            const startCol = Math.round((dragState.startX - (token.size * cellSize) / 2) / cellSize);
            const startRow = Math.round((dragState.startY - (token.size * cellSize) / 2) / cellSize);
            const endCol = Math.round((snapped.x - (token.size * cellSize) / 2) / cellSize);
            const endRow = Math.round((snapped.y - (token.size * cellSize) / 2) / cellSize);

            // Calculate distance using D&D diagonal movement (each diagonal = 1 cell for simplicity)
            // Or use Euclidean distance rounded to nearest cell
            const deltaCol = Math.abs(endCol - startCol);
            const deltaRow = Math.abs(endRow - startRow);
            // D&D 5e uses "5-10-5" diagonal rule, but for simplicity we use max of deltas
            const distanceInCells = Math.max(deltaCol, deltaRow);
            const distanceInFeet = distanceInCells * 5;

            // Position the label at the midpoint of the line
            const midX = (dragState.startX + snapped.x) / 2;
            const midY = (dragState.startY + snapped.y) / 2;

            return (
              <>
                <Line
                  points={getPathPoints(
                    dragState.startX,
                    dragState.startY,
                    snapped.x,
                    snapped.y
                  )}
                  stroke={token.color}
                  strokeWidth={3}
                  dash={[10, 5]}
                  lineCap="round"
                  lineJoin="round"
                />
                {/* Distance label */}
                {distanceInCells > 0 && (
                  <Group x={midX} y={midY}>
                    <Rect
                      offsetX={20}
                      offsetY={12}
                      width={40}
                      height={24}
                      fill="rgba(0, 0, 0, 0.8)"
                      cornerRadius={4}
                    />
                    <Text
                      text={`${distanceInFeet}ft`}
                      fontSize={14}
                      fontStyle="bold"
                      fill="white"
                      align="center"
                      width={40}
                      offsetX={20}
                      offsetY={7}
                    />
                  </Group>
                )}
                {/* Ghost at destination */}
                <TokenGhost
                  token={token}
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

        const isEditable = canEditToken(token.ownerId);
        const isMovable = canMoveToken(token.ownerId);
        const actions = createTokenActions(token, isEditable);

        return (
          <TokenItem
            key={token.id}
            token={token}
            cellSize={cellSize}
            isSelected={selectedIds.includes(token.id)}
            isHovered={hoveredTokenId === token.id}
            isEditable={isEditable}
            isMovable={isMovable}
            selectedTool={selectedTool}
            isDragging={dragState?.tokenId === token.id}
            actions={actions}
            onMouseDown={(e) => handleMouseDown(token, e)}
            onHoverStart={() => handleHoverStart(token.id)}
            onHoverEnd={handleHoverEnd}
          />
        );
      })}
    </>
  );
}
