import { Circle, Group, Text, Image, Rect, Line } from "react-konva";
import { useState, useRef, useCallback, useEffect, memo } from "react";
import type { Token, GridPosition } from "../../types";
import { useMapStore, useEditorStore } from "../../store";
import { useImage } from "../../hooks";
import { getHpPercentage, getHpBarColor } from "../../utils/character-utils";

// Helper to determine if a color is light (needs dark text/stroke for contrast)
function isLightColor(color: string): boolean {
  // Handle hex colors
  let hex = color.replace("#", "");
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.7;
}

interface DragState {
  tokenId: string;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

interface TokenItemProps {
  token: Token;
  cellSize: number;
  isSelected: boolean;
  isHovered: boolean;
  isEditable: boolean;
  isMovable: boolean;
  isDM: boolean;
  selectedTool: string;
  isDragging: boolean;
  isLockedMouseDown: boolean;
  forceHidden: boolean;
  onMouseDown: (tokenId: string, e: any) => void;
  onFlip: (tokenId: string) => void;
  onSelect: (tokenId: string) => void;
  onHoverStart: (tokenId: string) => void;
  onHoverEnd: () => void;
  onDoubleClick: (tokenId: string) => void;
}

const TokenItem = memo(function TokenItem({
  token,
  cellSize,
  isSelected,
  isHovered,
  isEditable,
  isMovable,
  isDM,
  selectedTool,
  isDragging,
  isLockedMouseDown,
  forceHidden,
  onMouseDown,
  onFlip,
  onSelect,
  onHoverStart,
  onHoverEnd,
  onDoubleClick,
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
    onFlip(token.id);
  };

  const handleFlipMouseDown = (e: any) => {
    // Prevent drag from starting when clicking flip button
    e.cancelBubble = true;
  };

  const handleClick = (e: any) => {
    // Allow selection in select mode and draw mode (for color picking)
    if (selectedTool !== "select" && selectedTool !== "draw") return;
    // Only allow selection if user can move this token (has access)
    if (!isMovable) return;
    e.cancelBubble = true;
    onSelect(token.id);
  };

  const handleRightClick = (e: any) => {
    e.cancelBubble = true;
    e.evt?.preventDefault();
  };

  const handleMouseDown = (e: any) => {
    onMouseDown(token.id, e);
  };

  const handleHoverStart = () => {
    onHoverStart(token.id);
  };

  const handleDoubleClick = (e: any) => {
    e.cancelBubble = true;
    onDoubleClick(token.id);
  };

  // Flip button size and position
  const flipBtnSize = Math.min(20, maxSize / 3);
  const flipBtnX = imgWidth / 2 + 4;
  const flipBtnY = -imgHeight / 2 - 4;

  // Check if this is an image token (even if image hasn't loaded yet)
  const hasImageUrl = !!token.imageUrl;

  // Lock icon position
  const lockY = hasImageUrl ? imgHeight / 2 + 8 : radius + 8;

  // Character sheet display calculations
  const sheet = token.characterSheet;
  // Show HP/AC only on hover (not selection). Hide for monster tokens unless DM.
  const isMonster = token.layer === "monster";
  const showStats = isHovered && !isDragging && sheet && !(isMonster && !isDM);
  const hpPercent = sheet ? getHpPercentage(sheet.hpCurrent, sheet.hpMax) : 0;
  const hpBarColor = sheet ? getHpBarColor(hpPercent) : "#22c55e";

  // HP bar dimensions - flush on top of token
  const hpBarWidth = hasImageUrl ? imgWidth : radius * 2;
  const hpBarHeight = 10;
  const hpBarY = hasImageUrl ? -imgHeight / 2 - hpBarHeight / 2 : -radius - hpBarHeight / 2;

  // AC shield dimensions - cute shield above HP bar
  const acShieldWidth = 14;
  const acShieldHeight = 16;
  const acShieldY = hpBarY - hpBarHeight / 2 - acShieldHeight / 2 - 1; // Above HP bar

  // Token name position - flush under the token
  const nameY = hasImageUrl ? imgHeight / 2 + 10 : radius + 10;

  // Check if token color is light (for contrast handling)
  const isLight = isLightColor(token.color);
  const acTextColor = isLight ? "#000000" : "#ffffff";
  const acStrokeColor = isLight ? "#374151" : "#ffffff";

  return (
    <Group
      x={x}
      y={y}
      rotation={token.rotation}
      opacity={forceHidden ? 0 : isDragging ? 0.5 : 1}
      onMouseDown={handleMouseDown}
      onTouchStart={handleMouseDown}
      onClick={handleClick}
      onTap={handleClick}
      onDblClick={handleDoubleClick}
      onDblTap={handleDoubleClick}
      onContextMenu={handleRightClick}
      onMouseEnter={handleHoverStart}
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

      {/* Lock indicator - centered on token, only shown when clicking on a locked token */}
      {isLockedMouseDown && (
        <Group>
          <Rect
            width={42}
            height={15}
            offsetX={21}
            offsetY={7.5}
            fill="rgba(0, 0, 0, 0.8)"
            cornerRadius={3}
          />
          <Text
            text="Locked"
            fontSize={10}
            fill="#f87171"
            align="center"
            verticalAlign="middle"
            width={42}
            height={15}
            offsetX={21}
            offsetY={7.5}
          />
        </Group>
      )}

      {/* Token name and condition - flush under the token */}
      {isHovered && !isDragging && (
        <Group y={nameY}>
          <Rect
            width={token.name.length * 5.5 + 4}
            height={13}
            offsetX={(token.name.length * 5.5 + 4) / 2}
            offsetY={6.5}
            fill="rgba(0, 0, 0, 0.75)"
            cornerRadius={2}
          />
          <Text
            text={token.name}
            fontSize={10}
            fill="#ffffff"
            align="center"
            verticalAlign="middle"
            width={token.name.length * 5.5 + 4}
            height={13}
            offsetX={(token.name.length * 5.5 + 4) / 2}
            offsetY={6.5}
          />
          {/* Condition indicator - show if not Healthy */}
          {sheet?.condition && sheet.condition !== "Healthy" && (
            <Group y={14}>
              <Rect
                width={sheet.condition.length * 5 + 6}
                height={12}
                offsetX={(sheet.condition.length * 5 + 6) / 2}
                offsetY={6}
                fill="rgba(220, 38, 38, 0.9)"
                cornerRadius={2}
              />
              <Text
                text={sheet.condition}
                fontSize={9}
                fill="#ffffff"
                align="center"
                verticalAlign="middle"
                width={sheet.condition.length * 5 + 6}
                height={12}
                offsetX={(sheet.condition.length * 5 + 6) / 2}
                offsetY={6}
              />
            </Group>
          )}
        </Group>
      )}

      {/* HP Bar - shown when selected or hovered and has character sheet */}
      {showStats && (
        <Group y={hpBarY}>
          {/* HP bar background */}
          <Rect
            width={hpBarWidth}
            height={hpBarHeight}
            offsetX={hpBarWidth / 2}
            offsetY={hpBarHeight / 2}
            fill="rgba(0, 0, 0, 0.6)"
            cornerRadius={4}
          />
          {/* HP bar fill */}
          <Rect
            x={-hpBarWidth / 2 + 1}
            y={-hpBarHeight / 2 + 1}
            width={(hpBarWidth - 2) * (hpPercent / 100)}
            height={hpBarHeight - 2}
            fill={hpBarColor}
            cornerRadius={3}
          />
          {/* HP text */}
          <Text
            text={`${sheet!.hpCurrent}/${sheet!.hpMax}`}
            fontSize={8}
            fill="#ffffff"
            align="center"
            verticalAlign="middle"
            width={hpBarWidth}
            height={hpBarHeight}
            offsetX={hpBarWidth / 2}
            offsetY={hpBarHeight / 2}
          />
        </Group>
      )}

      {/* AC Shield - cute shield shape above HP bar */}
      {showStats && (
        <Group x={0} y={acShieldY}>
          {/* Shield shape with curved top and pointed bottom */}
          <Line
            points={[
              -acShieldWidth / 2, -acShieldHeight / 2 + 2,  // Top left (slightly down for curve effect)
              -acShieldWidth / 2 + 2, -acShieldHeight / 2,  // Curve to top
              acShieldWidth / 2 - 2, -acShieldHeight / 2,   // Top right curve start
              acShieldWidth / 2, -acShieldHeight / 2 + 2,   // Top right
              acShieldWidth / 2, acShieldHeight / 4,        // Right side
              0, acShieldHeight / 2,                         // Bottom point
              -acShieldWidth / 2, acShieldHeight / 4,       // Left side
            ]}
            closed
            fill={token.color}
            stroke={acStrokeColor}
            strokeWidth={1}
            tension={0.3}
          />
          {/* AC number */}
          <Text
            text={String(sheet!.ac)}
            fontSize={8}
            fontStyle="bold"
            fill={acTextColor}
            align="center"
            verticalAlign="middle"
            width={acShieldWidth}
            height={acShieldHeight}
            offsetX={acShieldWidth / 2}
            offsetY={acShieldHeight / 2 + 1}
          />
        </Group>
      )}
    </Group>
  );
});

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

// Drag overlay — renders path line, distance label, and ghost during drag
// Isolated so drag position updates don't re-render TokenItems
interface DragOverlayProps {
  dragState: DragState;
  token: Token;
  cellSize: number;
}

function DragOverlay({ dragState, token, cellSize }: DragOverlayProps) {
  const offset = (token.size * cellSize) / 2;

  // Get snapped destination for ghost
  const col = Math.round((dragState.currentX - offset) / cellSize);
  const row = Math.round((dragState.currentY - offset) / cellSize);
  const snappedX = col * cellSize + offset;
  const snappedY = row * cellSize + offset;

  // Calculate distance in cells (using center-to-center)
  const startCol = Math.round((dragState.startX - offset) / cellSize);
  const startRow = Math.round((dragState.startY - offset) / cellSize);

  // Calculate distance using Pythagorean theorem for diagonal movement
  const deltaCol = Math.abs(col - startCol);
  const deltaRow = Math.abs(row - startRow);
  const distanceInCells = Math.sqrt(deltaCol * deltaCol + deltaRow * deltaRow);
  const distanceInFeet = Math.round(distanceInCells * 5 * 10) / 10;

  // Position the label at the midpoint of the line
  const midX = (dragState.startX + snappedX) / 2;
  const midY = (dragState.startY + snappedY) / 2;

  // Format: show decimal only if not a whole number
  const displayText = Number.isInteger(distanceInFeet)
    ? `${distanceInFeet}ft`
    : `${distanceInFeet.toFixed(1)}ft`;
  const labelWidth = Math.max(40, displayText.length * 9 + 8);

  return (
    <>
      <Line
        points={[dragState.startX, dragState.startY, snappedX, snappedY]}
        stroke={token.color}
        strokeWidth={3}
        dash={[10, 5]}
        lineCap="round"
        lineJoin="round"
      />
      {/* Distance label */}
      {distanceInFeet > 0 && (
        <Group x={midX} y={midY}>
          <Rect
            offsetX={labelWidth / 2}
            offsetY={12}
            width={labelWidth}
            height={24}
            fill="rgba(0, 0, 0, 0.8)"
            cornerRadius={4}
          />
          <Text
            text={displayText}
            fontSize={14}
            fontStyle="bold"
            fill="white"
            align="center"
            width={labelWidth}
            offsetX={labelWidth / 2}
            offsetY={7}
          />
        </Group>
      )}
      {/* Ghost at destination */}
      <TokenGhost
        token={token}
        cellSize={cellSize}
        x={snappedX}
        y={snappedY}
      />
    </>
  );
}

interface TokenLayerProps {
  tokens: Token[];
  cellSize: number;
  stageRef: React.RefObject<any>;
  hoveredTokenId: string | null;
  nonFoggedTokenIds: Set<string>;
  onHoverStart: (tokenId: string) => void;
  onHoverEnd: () => void;
  onTokenMoved?: (tokenId: string, position: GridPosition) => void;
  onTokenFlip?: (tokenId: string) => void;
}

export const TokenLayer = memo(function TokenLayer({ tokens, cellSize, stageRef, hoveredTokenId, nonFoggedTokenIds, onHoverStart: onHoverStartProp, onHoverEnd: onHoverEndProp, onTokenMoved, onTokenFlip }: TokenLayerProps) {
  const moveToken = useMapStore((s) => s.moveToken);
  const flipToken = useMapStore((s) => s.flipToken);
  const selectedTool = useEditorStore((s) => s.selectedTool);
  const selectedIds = useEditorStore((s) => s.selectedElementIds);
  const setSelectedElements = useEditorStore((s) => s.setSelectedElements);
  const canEditToken = useEditorStore((s) => s.canEditToken);
  const canMoveToken = useEditorStore((s) => s.canMoveToken);
  const isDungeonMaster = useEditorStore((s) => s.isDungeonMaster);
  const openCharacterSheet = useEditorStore((s) => s.openCharacterSheet);
  const isPanning = useEditorStore((s) => s.isPanning);

  const [dragState, setDragState] = useState<DragState | null>(null);
  const [lockedMouseDownId, setLockedMouseDownId] = useState<string | null>(null);
  const draggingTokenRef = useRef<Token | null>(null);
  const isDraggingRef = useRef(false);
  const dragPositionRef = useRef<{ x: number; y: number } | null>(null);

  // Stable refs — keep callbacks stable so React.memo on TokenItem actually works.
  // Without these, every token/tool/cellSize change recreates callbacks,
  // which defeats memo on ALL TokenItems.
  const onTokenMovedRef = useRef(onTokenMoved);
  onTokenMovedRef.current = onTokenMoved;
  const onTokenFlipRef = useRef(onTokenFlip);
  onTokenFlipRef.current = onTokenFlip;
  const moveTokenRef = useRef(moveToken);
  moveTokenRef.current = moveToken;
  const canMoveTokenRef = useRef(canMoveToken);
  canMoveTokenRef.current = canMoveToken;
  const tokensRef = useRef(tokens);
  tokensRef.current = tokens;
  const selectedToolRef = useRef(selectedTool);
  selectedToolRef.current = selectedTool;
  const cellSizeRef = useRef(cellSize);
  cellSizeRef.current = cellSize;
  const isPanningRef = useRef(isPanning);
  isPanningRef.current = isPanning;
  const flipTokenRef = useRef(flipToken);
  flipTokenRef.current = flipToken;
  const openCharacterSheetRef = useRef(openCharacterSheet);
  openCharacterSheetRef.current = openCharacterSheet;

  // Handle mouse/touch move during drag - use refs to avoid effect re-running on every move
  useEffect(() => {
    const updateDragPosition = (clientX: number, clientY: number) => {
      if (!isDraggingRef.current || !stageRef.current) return;

      const stage = stageRef.current;
      const container = stage.container();
      const rect = container.getBoundingClientRect();

      const scale = stage.scaleX();
      const stageX = stage.x();
      const stageY = stage.y();

      const mouseX = (clientX - rect.left - stageX) / scale;
      const mouseY = (clientY - rect.top - stageY) / scale;

      dragPositionRef.current = { x: mouseX, y: mouseY };

      setDragState((prev) =>
        prev ? { ...prev, currentX: mouseX, currentY: mouseY } : null
      );
    };

    const handleMouseMove = (e: MouseEvent) => {
      updateDragPosition(e.clientX, e.clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDraggingRef.current) return;
      e.preventDefault(); // Prevent page scroll while dragging token
      const touch = e.touches[0];
      if (touch) updateDragPosition(touch.clientX, touch.clientY);
    };

    const handleMouseUp = () => {
      if (!isDraggingRef.current) return;

      const token = draggingTokenRef.current;
      const position = dragPositionRef.current;
      const cs = cellSizeRef.current;

      if (token && position) {
        const offset = (token.size * cs) / 2;

        // Snap to grid
        const col = Math.round((position.x - offset) / cs);
        const row = Math.round((position.y - offset) / cs);

        // Only move if user can move this token
        if (canMoveTokenRef.current(token.ownerId)) {
          moveTokenRef.current(token.id, { col, row });
          // Trigger immediate sync for real-time updates
          onTokenMovedRef.current?.(token.id, { col, row });
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
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleMouseUp);
    };
  }, [stageRef]); // Only stageRef — everything else via refs

  // Stable callbacks — created once, read current values from refs
  const handleMouseDown = useCallback(
    (tokenId: string, e: any) => {
      if (selectedToolRef.current !== "select") return;

      const token = tokensRef.current.find((t) => t.id === tokenId);
      if (!token) return;

      // Check if user can move this token
      if (!canMoveTokenRef.current(token.ownerId)) {
        // Show locked indicator while mouse is down
        setLockedMouseDownId(token.id);
        e.cancelBubble = true;
        return;
      }

      e.cancelBubble = true;

      // Prevent default drag behavior
      if (e.evt) {
        e.evt.preventDefault();
      }

      const cs = cellSizeRef.current;
      const offset = (token.size * cs) / 2;
      const x = token.position.col * cs + offset;
      const y = token.position.row * cs + offset;

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
    [setSelectedElements] // setSelectedElements is stable from zustand
  );

  const handleFlip = useCallback(
    (tokenId: string) => {
      flipTokenRef.current(tokenId);
      onTokenFlipRef.current?.(tokenId);
    },
    []
  );

  const handleSelect = useCallback(
    (tokenId: string) => {
      setSelectedElements([tokenId]);
    },
    [setSelectedElements]
  );

  const handleDoubleClick = useCallback(
    (tokenId: string) => {
      const token = tokensRef.current.find((t) => t.id === tokenId);
      if (token && canMoveTokenRef.current(token.ownerId)) {
        openCharacterSheetRef.current(tokenId);
      }
    },
    []
  );

  // Clear locked mouse down state on mouse up
  useEffect(() => {
    const handleMouseUp = () => {
      setLockedMouseDownId(null);
    };

    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchend", handleMouseUp);

    return () => {
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchend", handleMouseUp);
    };
  }, []);

  const onHoverStartPropRef = useRef(onHoverStartProp);
  onHoverStartPropRef.current = onHoverStartProp;
  const onHoverEndPropRef = useRef(onHoverEndProp);
  onHoverEndPropRef.current = onHoverEndProp;
  const nonFoggedTokenIdsRef = useRef(nonFoggedTokenIds);
  nonFoggedTokenIdsRef.current = nonFoggedTokenIds;

  const handleHoverStart = useCallback(
    (tokenId: string) => {
      // Skip hover entirely for fogged tokens
      if (!nonFoggedTokenIdsRef.current.has(tokenId)) return;
      onHoverStartPropRef.current(tokenId);
      // Change cursor to pointer (only if not panning)
      if (stageRef.current && !isPanningRef.current) {
        stageRef.current.container().style.cursor = "pointer";
      }
    },
    [stageRef]
  );

  const handleHoverEnd = useCallback(() => {
    onHoverEndPropRef.current();
    // Reset cursor (only if not panning)
    if (stageRef.current && !isPanningRef.current) {
      stageRef.current.container().style.cursor = "default";
    }
  }, [stageRef]);

  return (
    <>
      {/* Drag overlay - isolated from token list rendering */}
      {dragState && draggingTokenRef.current && (
        <DragOverlay
          dragState={dragState}
          token={draggingTokenRef.current}
          cellSize={cellSize}
        />
      )}

      {/* Sort tokens: movable (non-locked) above locked, then selected/hovered on top */}
      {[...tokens].sort((a, b) => {
        const aMovable = canMoveToken(a.ownerId) ? 1 : 0;
        const bMovable = canMoveToken(b.ownerId) ? 1 : 0;
        const aSelected = selectedIds.includes(a.id) ? 2 : 0;
        const bSelected = selectedIds.includes(b.id) ? 2 : 0;
        const aHovered = hoveredTokenId === a.id ? 4 : 0;
        const bHovered = hoveredTokenId === b.id ? 4 : 0;
        return (aMovable + aSelected + aHovered) - (bMovable + bSelected + bHovered);
      }).map((token) => {
        if (!token.visible) return null;

        const isEditable = canEditToken(token.ownerId);
        const isMovable = canMoveToken(token.ownerId);

        return (
          <TokenItem
            key={token.id}
            token={token}
            cellSize={cellSize}
            isSelected={selectedIds.includes(token.id)}
            isHovered={hoveredTokenId === token.id}
            isEditable={isEditable}
            isMovable={isMovable}
            isDM={isDungeonMaster()}
            selectedTool={selectedTool}
            isDragging={dragState?.tokenId === token.id}
            isLockedMouseDown={lockedMouseDownId === token.id}
            forceHidden={nonFoggedTokenIds.has(token.id)}
            onMouseDown={handleMouseDown}
            onFlip={handleFlip}
            onSelect={handleSelect}
            onHoverStart={handleHoverStart}
            onHoverEnd={handleHoverEnd}
            onDoubleClick={handleDoubleClick}
          />
        );
      })}
    </>
  );
});

// Selection overlay - renders above fog layer so selection is always visible
interface SelectedTokenOverlayProps {
  tokens: Token[];
  cellSize: number;
}

export const SelectedTokenOverlay = memo(function SelectedTokenOverlay({ tokens, cellSize }: SelectedTokenOverlayProps) {
  const selectedIds = useEditorStore((s) => s.selectedElementIds);

  return (
    <>
      {tokens
        .filter((token) => selectedIds.includes(token.id))
        .map((token) => {
          const x = token.position.col * cellSize + (token.size * cellSize) / 2;
          const y = token.position.row * cellSize + (token.size * cellSize) / 2;
          const tokenSizePx = token.size * cellSize;

          // For tokens with images, render the dotted rect border
          if (token.imageUrl) {
            return (
              <Rect
                key={`selection-overlay-${token.id}`}
                x={x}
                y={y}
                width={tokenSizePx + 2}
                height={tokenSizePx + 2}
                offsetX={(tokenSizePx + 2) / 2}
                offsetY={(tokenSizePx + 2) / 2}
                stroke={token.color}
                strokeWidth={2}
                dash={[4, 4]}
                listening={false}
              />
            );
          }

          // For circle tokens, render the dotted circle border
          const radius = tokenSizePx / 2;
          return (
            <Circle
              key={`selection-overlay-${token.id}`}
              x={x}
              y={y}
              radius={radius + 1}
              stroke={token.color}
              strokeWidth={2}
              dash={[4, 4]}
              listening={false}
            />
          );
        })}
    </>
  );
});

// Visual-only token rendered in the overlay layer (above fog)
interface OverlayTokenItemProps {
  token: Token;
  cellSize: number;
  isDM: boolean;
  isHovered: boolean;
}

const OverlayTokenItem = memo(function OverlayTokenItem({ token, cellSize, isDM, isHovered }: OverlayTokenItemProps) {
  const image = useImage(token.imageUrl);

  const offset = (token.size * cellSize) / 2;
  const x = token.position.col * cellSize + offset;
  const y = token.position.row * cellSize + offset;
  const radius = offset - 4;
  const maxSize = token.size * cellSize - 2;

  const hasImageUrl = !!token.imageUrl;

  // Calculate dimensions preserving aspect ratio
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

  // Hover highlight color
  const hoverStroke = token.color;
  const hoverStrokeWidth = 2;

  // Character sheet display calculations (only on hover)
  const sheet = token.characterSheet;
  const isMonster = token.layer === "monster";
  const showStats = isHovered && sheet && !(isMonster && !isDM);
  const hpPercent = sheet ? getHpPercentage(sheet.hpCurrent, sheet.hpMax) : 0;
  const hpBarColor = sheet ? getHpBarColor(hpPercent) : "#22c55e";

  // HP bar dimensions
  const hpBarWidth = hasImageUrl ? imgWidth : radius * 2;
  const hpBarHeight = 10;
  const hpBarY = hasImageUrl ? -imgHeight / 2 - hpBarHeight / 2 : -radius - hpBarHeight / 2;

  // AC shield dimensions
  const acShieldWidth = 14;
  const acShieldHeight = 16;
  const acShieldY = hpBarY - hpBarHeight / 2 - acShieldHeight / 2 - 1;

  // Token name position
  const nameY = hasImageUrl ? imgHeight / 2 + 10 : radius + 10;

  // Color contrast
  const isLight = isLightColor(token.color);
  const acTextColor = isLight ? "#000000" : "#ffffff";
  const acStrokeColor = isLight ? "#374151" : "#ffffff";

  return (
    <Group
      x={x}
      y={y}
      rotation={token.rotation}
      listening={false}
    >
      {hasImageUrl ? (
        <>
          {/* Hover highlight */}
          {isHovered && (
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
        </>
      ) : (
        <>
          {/* Hover highlight for circle tokens */}
          {isHovered && (
            <Circle
              radius={radius + 3}
              stroke={hoverStroke}
              strokeWidth={hoverStrokeWidth}
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

      {/* Token name and condition - only on hover */}
      {isHovered && (
        <Group y={nameY}>
          <Rect
            width={token.name.length * 5.5 + 4}
            height={13}
            offsetX={(token.name.length * 5.5 + 4) / 2}
            offsetY={6.5}
            fill="rgba(0, 0, 0, 0.75)"
            cornerRadius={2}
          />
          <Text
            text={token.name}
            fontSize={10}
            fill="#ffffff"
            align="center"
            verticalAlign="middle"
            width={token.name.length * 5.5 + 4}
            height={13}
            offsetX={(token.name.length * 5.5 + 4) / 2}
            offsetY={6.5}
          />
          {/* Condition indicator */}
          {sheet?.condition && sheet.condition !== "Healthy" && (
            <Group y={14}>
              <Rect
                width={sheet.condition.length * 5 + 6}
                height={12}
                offsetX={(sheet.condition.length * 5 + 6) / 2}
                offsetY={6}
                fill="rgba(220, 38, 38, 0.9)"
                cornerRadius={2}
              />
              <Text
                text={sheet.condition}
                fontSize={9}
                fill="#ffffff"
                align="center"
                verticalAlign="middle"
                width={sheet.condition.length * 5 + 6}
                height={12}
                offsetX={(sheet.condition.length * 5 + 6) / 2}
                offsetY={6}
              />
            </Group>
          )}
        </Group>
      )}

      {/* HP Bar */}
      {showStats && (
        <Group y={hpBarY}>
          <Rect
            width={hpBarWidth}
            height={hpBarHeight}
            offsetX={hpBarWidth / 2}
            offsetY={hpBarHeight / 2}
            fill="rgba(0, 0, 0, 0.6)"
            cornerRadius={4}
          />
          <Rect
            x={-hpBarWidth / 2 + 1}
            y={-hpBarHeight / 2 + 1}
            width={(hpBarWidth - 2) * (hpPercent / 100)}
            height={hpBarHeight - 2}
            fill={hpBarColor}
            cornerRadius={3}
          />
          <Text
            text={`${sheet!.hpCurrent}/${sheet!.hpMax}`}
            fontSize={8}
            fill="#ffffff"
            align="center"
            verticalAlign="middle"
            width={hpBarWidth}
            height={hpBarHeight}
            offsetX={hpBarWidth / 2}
            offsetY={hpBarHeight / 2}
          />
        </Group>
      )}

      {/* AC Shield */}
      {showStats && (
        <Group x={0} y={acShieldY}>
          <Line
            points={[
              -acShieldWidth / 2, -acShieldHeight / 2 + 2,
              -acShieldWidth / 2 + 2, -acShieldHeight / 2,
              acShieldWidth / 2 - 2, -acShieldHeight / 2,
              acShieldWidth / 2, -acShieldHeight / 2 + 2,
              acShieldWidth / 2, acShieldHeight / 4,
              0, acShieldHeight / 2,
              -acShieldWidth / 2, acShieldHeight / 4,
            ]}
            closed
            fill={token.color}
            stroke={acStrokeColor}
            strokeWidth={1}
            tension={0.3}
          />
          <Text
            text={String(sheet!.ac)}
            fontSize={8}
            fontStyle="bold"
            fill={acTextColor}
            align="center"
            verticalAlign="middle"
            width={acShieldWidth}
            height={acShieldHeight}
            offsetX={acShieldWidth / 2}
            offsetY={acShieldHeight / 2 + 1}
          />
        </Group>
      )}
    </Group>
  );
});

// Non-fogged tokens overlay - renders all non-fogged tokens above fog layer
interface NonFoggedTokensOverlayProps {
  tokens: Token[];
  cellSize: number;
  isDM: boolean;
  hoveredTokenId: string | null;
}

export const NonFoggedTokensOverlay = memo(function NonFoggedTokensOverlay({ tokens, cellSize, isDM, hoveredTokenId }: NonFoggedTokensOverlayProps) {
  const selectedIds = useEditorStore((s) => s.selectedElementIds);
  const canMoveToken = useEditorStore((s) => s.canMoveToken);

  return (
    <>
      {[...tokens].sort((a, b) => {
        const aMovable = canMoveToken(a.ownerId) ? 1 : 0;
        const bMovable = canMoveToken(b.ownerId) ? 1 : 0;
        const aSelected = selectedIds.includes(a.id) ? 2 : 0;
        const bSelected = selectedIds.includes(b.id) ? 2 : 0;
        const aHovered = hoveredTokenId === a.id ? 4 : 0;
        const bHovered = hoveredTokenId === b.id ? 4 : 0;
        return (aMovable + aSelected + aHovered) - (bMovable + bSelected + bHovered);
      }).map((token) => (
        <OverlayTokenItem
          key={`overlay-${token.id}`}
          token={token}
          cellSize={cellSize}
          isDM={isDM}
          isHovered={hoveredTokenId === token.id}
        />
      ))}
    </>
  );
});
