import { Stage, Layer, Rect } from "react-konva";
import { useEffect, useRef, useState } from "react";
import { BackgroundLayer } from "./BackgroundLayer";
import { GridLayer } from "./GridLayer";
import { TokenLayer, SelectedTokenOverlay } from "./TokenLayer";
import { DrawingLayer } from "./DrawingLayer";
import { FogLayer } from "./FogLayer";
import { PingLayer } from "./PingLayer";
import { useMapStore, useEditorStore } from "../../store";
import { MIN_ZOOM, MAX_ZOOM, ZOOM_STEP } from "../../constants";
import type { FreehandPath, GridPosition, Ping } from "../../types";

interface MapCanvasProps {
  onTokenMoved?: (tokenId: string, position: GridPosition) => void;
  onTokenFlip?: (tokenId: string) => void;
  onFogPaint?: (col: number, row: number, creatorId: string) => void;
  onFogErase?: (col: number, row: number) => void;
  onFogPaintRange?: (startCol: number, startRow: number, endCol: number, endRow: number, creatorId: string) => void;
  onFogEraseRange?: (startCol: number, startRow: number, endCol: number, endRow: number) => void;
  onPing?: (ping: Ping) => void;
  onDrawingAdd?: (path: FreehandPath) => void;
  onDrawingRemove?: (pathId: string) => void;
  activePings?: Ping[];
}

export function MapCanvas({ onTokenMoved, onTokenFlip, onFogPaint, onFogErase, onFogPaintRange, onFogEraseRange, onPing, onDrawingAdd, onDrawingRemove, activePings = [] }: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [isRightClickPanning, setIsRightClickPanning] = useState(false);
  const isRightClickPanningRef = useRef(false); // Ref to avoid effect re-runs
  const lastMousePos = useRef<{ x: number; y: number } | null>(null);
  const hasCenteredRef = useRef<string | null>(null); // Track which map we've centered

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<number[] | null>(null);

  // Drag rectangle state for fog and erase tools
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingRect, setIsDraggingRect] = useState(false);
  const [dragMode, setDragMode] = useState<"fog" | "erase" | null>(null);

  const map = useMapStore((s) => s.map);
  const setViewport = useMapStore((s) => s.setViewport);
  const addFreehandPath = useMapStore((s) => s.addFreehandPath);
  const removeFreehandPath = useMapStore((s) => s.removeFreehandPath);
  const paintFogInRange = useMapStore((s) => s.paintFogInRange);
  const eraseFogInRange = useMapStore((s) => s.eraseFogInRange);
  const selectedTool = useEditorStore((s) => s.selectedTool);
  const selectedElementIds = useEditorStore((s) => s.selectedElementIds);
  const setIsPanning = useEditorStore((s) => s.setIsPanning);
  const clearSelection = useEditorStore((s) => s.clearSelection);
  const userId = useEditorStore((s) => s.userId);
  const isDungeonMaster = useEditorStore((s) => s.isDungeonMaster);
  const canPing = useEditorStore((s) => s.canPing);
  const recordPing = useEditorStore((s) => s.recordPing);
  const setCanvasDimensions = useEditorStore((s) => s.setCanvasDimensions);

  const stageRef = useRef<any>(null);

  // Get selected token for drawing color
  const selectedToken = map?.tokens.find((t) => selectedElementIds.includes(t.id));
  const drawingColor = selectedToken?.color || "#ef4444";
  const drawingWidth = 3;

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        const height = containerRef.current.offsetHeight;
        setDimensions({ width, height });
        setCanvasDimensions(width, height);
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, [setCanvasDimensions]);

  // Center the grid on initial load - always center for each client session
  useEffect(() => {
    if (!map || dimensions.width === 0 || dimensions.height === 0) return;

    // Only center once per map (check if we've already centered this map)
    if (hasCenteredRef.current === map.id) return;

    const gridWidthPx = map.grid.width * map.grid.cellSize;
    const gridHeightPx = map.grid.height * map.grid.cellSize;
    const scale = map.viewport.scale;

    // Calculate position to center the grid on screen
    const centerX = (dimensions.width - gridWidthPx * scale) / 2;
    const centerY = (dimensions.height - gridHeightPx * scale) / 2;

    setViewport(centerX, centerY, scale);
    hasCenteredRef.current = map.id;
  }, [map?.id, map?.grid.width, map?.grid.height, map?.grid.cellSize, map?.viewport.scale, dimensions.width, dimensions.height, setViewport]);

  // Set cursor during right-click panning (on body, container, and stage)
  useEffect(() => {
    if (isRightClickPanning) {
      document.body.style.cursor = "grabbing";
      if (containerRef.current) {
        containerRef.current.style.cursor = "grabbing";
      }
      if (stageRef.current) {
        const container = stageRef.current.container();
        if (container) {
          container.style.cursor = "grabbing";
        }
      }
      return () => {
        document.body.style.cursor = "";
        if (containerRef.current) {
          containerRef.current.style.cursor = "";
        }
        if (stageRef.current) {
          const container = stageRef.current.container();
          if (container) {
            container.style.cursor = "";
          }
        }
      };
    }
  }, [isRightClickPanning]);

  // Handle right-click panning with mouse move - use ref to avoid effect re-runs
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isRightClickPanningRef.current || !lastMousePos.current || !stageRef.current)
        return;

      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;

      const stage = stageRef.current;
      const newX = stage.x() + dx;
      const newY = stage.y() + dy;

      stage.position({ x: newX, y: newY });
      stage.batchDraw();

      lastMousePos.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 2 && isRightClickPanningRef.current) {
        isRightClickPanningRef.current = false;
        setIsRightClickPanning(false);
        setIsPanning(false);
        lastMousePos.current = null;

        // Save final viewport position
        if (stageRef.current) {
          const stage = stageRef.current;
          setViewport(stage.x(), stage.y(), stage.scaleX());
        }
      }
    };

    // Set up listeners once on mount
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [setIsPanning, setViewport]); // Removed isRightClickPanning from deps

  if (!map) return null;

  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = Math.max(
      MIN_ZOOM,
      Math.min(MAX_ZOOM, oldScale + direction * ZOOM_STEP)
    );

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };

    stage.scale({ x: newScale, y: newScale });
    stage.position(newPos);
    setViewport(newPos.x, newPos.y, newScale);
  };

  // Helper to get grid cell from canvas position
  const getCellFromPosition = (pos: { x: number; y: number }) => {
    const col = Math.floor(pos.x / map!.grid.cellSize);
    const row = Math.floor(pos.y / map!.grid.cellSize);
    return { col, row };
  };

  const handleMouseDown = (e: any) => {
    // Right-click to pan
    if (e.evt.button === 2) {
      isRightClickPanningRef.current = true;
      setIsRightClickPanning(true);
      setIsPanning(true);
      lastMousePos.current = { x: e.evt.clientX, y: e.evt.clientY };
      return;
    }

    // Fog tool: drag to paint rectangle
    if (selectedTool === "fog" && e.evt.button === 0 && userId) {
      const stage = stageRef.current;
      const pos = stage.getRelativePointerPosition();
      setDragStart(pos);
      setDragEnd(pos);
      setIsDraggingRect(true);
      setDragMode("fog");
      return;
    }

    // Erase tool: drag to create erase rectangle
    if (selectedTool === "erase" && e.evt.button === 0) {
      const stage = stageRef.current;
      const pos = stage.getRelativePointerPosition();
      setDragStart(pos);
      setDragEnd(pos);
      setIsDraggingRect(true);
      setDragMode("erase");
      return;
    }

    // Drawing with left click when draw tool is selected
    if (selectedTool === "draw" && e.evt.button === 0 && selectedToken) {
      const stage = stageRef.current;
      const pos = stage.getRelativePointerPosition();
      setIsDrawing(true);
      setCurrentPath([pos.x, pos.y]);
    }
  };

  const handleMouseMove = (e: any) => {
    // Update drag rectangle
    if (isDraggingRect && dragStart) {
      const stage = stageRef.current;
      const pos = stage.getRelativePointerPosition();
      setDragEnd(pos);
      return;
    }

    if (!isDrawing || selectedTool !== "draw" || !currentPath) return;

    const stage = stageRef.current;
    const pos = stage.getRelativePointerPosition();
    setCurrentPath([...currentPath, pos.x, pos.y]);
  };

  const handleMouseUp = (e: any) => {
    // Complete drag rectangle operation
    if (isDraggingRect && dragStart && dragEnd && dragMode) {
      const { col: startCol, row: startRow } = getCellFromPosition(dragStart);
      const { col: endCol, row: endRow } = getCellFromPosition(dragEnd);

      if (dragMode === "fog" && userId) {
        // Paint fog in range
        paintFogInRange(startCol, startRow, endCol, endRow, userId);
        onFogPaintRange?.(startCol, startRow, endCol, endRow, userId);
      } else if (dragMode === "erase" && userId) {
        // Erase fog in range (players can only erase their own fog, DM can erase all)
        eraseFogInRange(startCol, startRow, endCol, endRow, userId, isDungeonMaster());
        onFogEraseRange?.(startCol, startRow, endCol, endRow);

        // Also erase drawings that fall within the rectangle
        const minX = Math.min(dragStart.x, dragEnd.x);
        const maxX = Math.max(dragStart.x, dragEnd.x);
        const minY = Math.min(dragStart.y, dragEnd.y);
        const maxY = Math.max(dragStart.y, dragEnd.y);

        // Find and remove paths that have any point within the rectangle
        map?.freehand.forEach((path) => {
          for (let i = 0; i < path.points.length; i += 2) {
            const px = path.points[i];
            const py = path.points[i + 1];
            if (px >= minX && px <= maxX && py >= minY && py <= maxY) {
              removeFreehandPath(path.id);
              break;
            }
          }
        });
      }

      setDragStart(null);
      setDragEnd(null);
      setIsDraggingRect(false);
      setDragMode(null);
      return;
    }

    if (isDrawing && currentPath && currentPath.length >= 4) {
      // Save the path
      const path: FreehandPath = {
        id: crypto.randomUUID(),
        points: currentPath,
        color: drawingColor,
        width: drawingWidth,
      };
      addFreehandPath(path);
      // Broadcast to other clients via WebSocket
      onDrawingAdd?.(path);
    }
    setIsDrawing(false);
    setCurrentPath(null);
  };

  const handleDragStart = (e: any) => {
    // Only handle stage drag, not token drag
    if (e.target !== stageRef.current) return;
    setIsPanning(true);
  };

  const handleDragEnd = (e: any) => {
    // Only handle stage drag, not token drag
    if (e.target !== stageRef.current) return;
    setIsPanning(false);
    const stage = stageRef.current;
    setViewport(stage.x(), stage.y(), stage.scaleX());
  };

  const handleClick = (e: any) => {
    // Ping tool click handler
    if (selectedTool === "ping" && selectedToken && userId) {
      // Check rate limit
      if (!canPing()) {
        return;
      }

      const stage = stageRef.current;
      const pos = stage.getRelativePointerPosition();

      const ping: Ping = {
        id: crypto.randomUUID(),
        x: pos.x,
        y: pos.y,
        color: selectedToken.color,
        userId,
        timestamp: Date.now(),
      };

      recordPing();
      onPing?.(ping);
      return;
    }

    // If clicking on empty canvas (Stage or Layer), clear selection
    // But keep selection when using draw tool (needs selected token for color)
    // In Konva, clicking empty space in a Layer targets the Layer, not the Stage
    const targetType = e.target.getType?.() || e.target.nodeType;
    if (e.target === e.target.getStage() || targetType === "Layer") {
      if (selectedTool !== "draw") {
        clearSelection();
      }
    }
  };

  const handleContextMenu = (e: any) => {
    // Prevent context menu on right-click
    e.evt.preventDefault();
  };

  const cursorStyle = isRightClickPanning
    ? "grabbing"
    : selectedTool === "pan"
      ? "grab"
      : selectedTool === "draw"
        ? selectedToken
          ? "crosshair"
          : "not-allowed"
        : selectedTool === "erase"
          ? "crosshair"
          : selectedTool === "fog"
            ? "crosshair"
            : selectedTool === "ping"
              ? selectedToken
                ? "crosshair"
                : "not-allowed"
              : "default";

  return (
    <div
      ref={containerRef}
      className="flex-1 bg-gray-100 dark:bg-gray-800 overflow-hidden relative"
      style={{ cursor: cursorStyle }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Draw tool warning when no token selected */}
      {selectedTool === "draw" && !selectedToken && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-yellow-500 text-black px-4 py-2 rounded-lg shadow-lg text-sm font-medium">
          Select a token to use its color for drawing
        </div>
      )}
      {/* Fog tool hint */}
      {selectedTool === "fog" && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium">
          Click and drag to paint fog
        </div>
      )}
      {/* Erase tool hint */}
      {selectedTool === "erase" && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium">
          Drag to erase fog and drawings | Click on drawing to erase
        </div>
      )}
      {/* Ping tool warning when no token selected */}
      {selectedTool === "ping" && !selectedToken && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-yellow-500 text-black px-4 py-2 rounded-lg shadow-lg text-sm font-medium">
          Select a token to use its color for pinging
        </div>
      )}
      {/* Ping tool hint */}
      {selectedTool === "ping" && selectedToken && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium">
          Click to ping (4 per 10s limit)
        </div>
      )}
      <Stage
        ref={stageRef}
        width={dimensions.width}
        height={dimensions.height}
        draggable={selectedTool === "pan"}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={handleClick}
        onTap={handleClick}
        onContextMenu={handleContextMenu}
        x={map.viewport.x}
        y={map.viewport.y}
        scaleX={map.viewport.scale}
        scaleY={map.viewport.scale}
      >
        <Layer name="background">
          <BackgroundLayer background={map.background} grid={map.grid} />
        </Layer>
        <Layer name="grid">
          <GridLayer grid={map.grid} />
        </Layer>
        <Layer name="drawings">
          <DrawingLayer
            paths={map.freehand}
            currentPath={currentPath}
            currentColor={drawingColor}
            currentWidth={drawingWidth}
            isEraseMode={selectedTool === "erase"}
            onErasePath={removeFreehandPath}
          />
        </Layer>
        <Layer name="tokens">
          <TokenLayer
            tokens={map.tokens}
            cellSize={map.grid.cellSize}
            stageRef={stageRef}
            onTokenMoved={onTokenMoved}
            onTokenFlip={onTokenFlip}
          />
        </Layer>
        <Layer name="fog">
          <FogLayer
            paintedCells={map.fogOfWar.paintedCells || []}
            grid={map.grid}
            currentUserId={userId}
          />
        </Layer>
        <Layer name="token-selection">
          <SelectedTokenOverlay tokens={map.tokens} cellSize={map.grid.cellSize} />
        </Layer>
        <Layer name="pings">
          <PingLayer pings={activePings} />
        </Layer>
        {/* Drag rectangle overlay */}
        {isDraggingRect && dragStart && dragEnd && (
          <Layer name="drag-rect">
            <Rect
              x={Math.min(dragStart.x, dragEnd.x)}
              y={Math.min(dragStart.y, dragEnd.y)}
              width={Math.abs(dragEnd.x - dragStart.x)}
              height={Math.abs(dragEnd.y - dragStart.y)}
              fill={dragMode === "fog" ? "#1a1a2e" : "#ef4444"}
              opacity={0.3}
              stroke={dragMode === "fog" ? "#4a4a6e" : "#dc2626"}
              strokeWidth={2}
              dash={[5, 5]}
            />
          </Layer>
        )}
      </Stage>
    </div>
  );
}
