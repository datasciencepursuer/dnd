import { Stage, Layer, Rect, Group } from "react-konva";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { BackgroundLayer } from "./BackgroundLayer";
import { GridLayer } from "./GridLayer";
import { AuraLayer } from "./AuraLayer";
import { TokenLayer, SelectedTokenOverlay, NonFoggedTokensOverlay, DragOverlay, SelectedTokenControls } from "./TokenLayer";
import type { DragState } from "./TokenLayer";
import { DrawingLayer } from "./DrawingLayer";
import { FogLayer } from "./FogLayer";
import { PingLayer } from "./PingLayer";
import { useMapStore, useEditorStore } from "../../store";
import { MIN_ZOOM, MAX_ZOOM, ZOOM_STEP } from "../../constants";
import { buildFogSet, isTokenUnderFog } from "../../utils/fog-utils";
import type { FreehandPath, GridPosition, Ping, Token } from "../../types";

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
  const dragEndRef = useRef<{ x: number; y: number } | null>(null);
  const dragRectRef = useRef<any>(null);
  const [isDraggingRect, setIsDraggingRect] = useState(false);
  const [dragMode, setDragMode] = useState<"fog" | "erase" | null>(null);

  // Multi-touch (pinch/pan) tracking
  const multiTouchRef = useRef<{
    active: boolean;
    initialDistance: number;
    initialScale: number;
    lastMidpoint: { x: number; y: number };
  } | null>(null);

  // Shallow-compared selector prevents re-renders when unrelated map fields change
  // (e.g. viewport saves won't trigger re-render if tokens/grid/fog haven't changed)
  const { tokens, grid, fogPaintedCells, background, freehand, mapId } = useMapStore(
    useShallow((s) => ({
      tokens: s.map?.tokens,
      grid: s.map?.grid,
      fogPaintedCells: s.map?.fogOfWar?.paintedCells,
      background: s.map?.background,
      freehand: s.map?.freehand,
      mapId: s.map?.id,
    }))
  );
  // Viewport managed as ref — no selector subscription.
  // The Konva Stage is updated imperatively; subscribing to viewport
  // changes in the store would trigger a full React re-render on every
  // zoom/pan, which is unnecessary since Konva already has the correct position.

  const setViewport = useMapStore((s) => s.setViewport);
  const flipToken = useMapStore((s) => s.flipToken);
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
  const canMoveToken = useEditorStore((s) => s.canMoveToken);
  const canPing = useEditorStore((s) => s.canPing);
  const recordPing = useEditorStore((s) => s.recordPing);
  const setCanvasDimensions = useEditorStore((s) => s.setCanvasDimensions);
  const isPlayingLocally = useEditorStore((s) => s.isPlayingLocally);

  // Hovered token state (lifted from TokenLayer)
  const [hoveredTokenId, setHoveredTokenId] = useState<string | null>(null);

  // Drag overlay state (lifted from TokenLayer so we can render above fog)
  const [dragOverlay, setDragOverlay] = useState<{ dragState: DragState; token: Token } | null>(null);
  const handleDragChange = useCallback((dragState: DragState | null, token: Token | null) => {
    setDragOverlay(dragState && token ? { dragState, token } : null);
  }, []);

  const handleFlipToken = useCallback((tokenId: string) => {
    flipToken(tokenId);
    onTokenFlip?.(tokenId);
  }, [flipToken, onTokenFlip]);

  const handleTokenHoverStart = useCallback((tokenId: string) => {
    setHoveredTokenId(tokenId);
  }, []);

  const handleTokenHoverEnd = useCallback(() => {
    setHoveredTokenId(null);
  }, []);

  // Fog lookup set for O(1) per-cell checks
  const fogSet = useMemo(() => buildFogSet(fogPaintedCells || []), [fogPaintedCells]);

  // All visible, non-fogged tokens — rendered in overlay above fog
  const nonFoggedTokens = useMemo(() => {
    if (!tokens) return [];
    return tokens.filter((t) => t.visible && !isTokenUnderFog(t, fogSet));
  }, [tokens, fogSet]);

  const nonFoggedTokenIds = useMemo(() => {
    return new Set(nonFoggedTokens.map((t) => t.id));
  }, [nonFoggedTokens]);

  const stageRef = useRef<any>(null);
  const viewportTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Viewport ref — source of truth for Stage position/scale, updated imperatively
  const viewportRef = useRef({ x: 0, y: 0, scale: 2.2185 });

  // Get selected token for drawing color
  const selectedToken = tokens?.find((t) => selectedElementIds.includes(t.id));
  const drawingColor = selectedToken?.color || "#ef4444";
  const drawingWidth = 3;

  // Stable ref for freehand to use in mouseUp without causing re-renders
  const freehandRef = useRef(freehand);
  freehandRef.current = freehand;

  // Auto-scroll callback — moves the viewport by (dx, dy) screen pixels
  const handleAutoScroll = useCallback((dx: number, dy: number) => {
    const stage = stageRef.current;
    if (!stage) return;
    const newX = stage.x() + dx;
    const newY = stage.y() + dy;
    stage.x(newX);
    stage.y(newY);
    stage.batchDraw();
    viewportRef.current = { x: newX, y: newY, scale: stage.scaleX() };
    // Debounce store update for persistence
    if (viewportTimeoutRef.current) clearTimeout(viewportTimeoutRef.current);
    viewportTimeoutRef.current = setTimeout(() => {
      setViewport(newX, newY, stage.scaleX());
    }, 150);
  }, [setViewport]);

  // Wrapper that removes a freehand path locally and broadcasts the removal
  const handleErasePath = useCallback((pathId: string) => {
    removeFreehandPath(pathId);
    onDrawingRemove?.(pathId);
  }, [removeFreehandPath, onDrawingRemove]);

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

    // ResizeObserver catches container size changes from sidebar collapse/expand
    const ro = new ResizeObserver(updateDimensions);
    if (containerRef.current) ro.observe(containerRef.current);

    return () => {
      window.removeEventListener("resize", updateDimensions);
      ro.disconnect();
    };
  }, [setCanvasDimensions]);

  // Sync viewport ref from store when map changes (initial load / map switch)
  useEffect(() => {
    if (!mapId) return;
    const vp = useMapStore.getState().map?.viewport;
    if (vp) {
      viewportRef.current = { x: vp.x, y: vp.y, scale: vp.scale };
      // Also update Stage directly if it exists
      if (stageRef.current) {
        stageRef.current.x(vp.x);
        stageRef.current.y(vp.y);
        stageRef.current.scaleX(vp.scale);
        stageRef.current.scaleY(vp.scale);
        stageRef.current.batchDraw();
      }
    }
  }, [mapId]);

  // Subscribe to external viewport changes (e.g. zoom slider in Toolbar)
  // Only apply if the store viewport differs from our local ref (i.e. not self-caused)
  useEffect(() => {
    const unsub = useMapStore.subscribe((state, prevState) => {
      const vp = state.map?.viewport;
      const prevVp = prevState.map?.viewport;
      if (!vp || !prevVp) return;
      if (vp === prevVp) return;
      const ref = viewportRef.current;
      // Skip if the ref already matches — this was a self-caused update
      if (Math.abs(ref.x - vp.x) < 0.5 && Math.abs(ref.y - vp.y) < 0.5 && Math.abs(ref.scale - vp.scale) < 0.001) return;
      viewportRef.current = { x: vp.x, y: vp.y, scale: vp.scale };
      if (stageRef.current) {
        stageRef.current.x(vp.x);
        stageRef.current.y(vp.y);
        stageRef.current.scaleX(vp.scale);
        stageRef.current.scaleY(vp.scale);
        stageRef.current.batchDraw();
      }
    });
    return unsub;
  }, []);

  // Center the grid on initial load - always center for each client session
  useEffect(() => {
    if (!grid || !mapId || dimensions.width === 0 || dimensions.height === 0) return;

    // Only center once per map (check if we've already centered this map)
    if (hasCenteredRef.current === mapId) return;

    const gridWidthPx = grid.width * grid.cellSize;
    const gridHeightPx = grid.height * grid.cellSize;
    const scale = viewportRef.current.scale;

    // Calculate position to center the grid on screen
    const centerX = (dimensions.width - gridWidthPx * scale) / 2;
    const centerY = (dimensions.height - gridHeightPx * scale) / 2;

    viewportRef.current = { x: centerX, y: centerY, scale };
    // Update Stage directly
    if (stageRef.current) {
      stageRef.current.x(centerX);
      stageRef.current.y(centerY);
      stageRef.current.scaleX(scale);
      stageRef.current.scaleY(scale);
      stageRef.current.batchDraw();
    }
    setViewport(centerX, centerY, scale);
    hasCenteredRef.current = mapId;
  }, [mapId, grid?.width, grid?.height, grid?.cellSize, dimensions.width, dimensions.height, setViewport]);

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

        // Save final viewport position to ref + store
        if (stageRef.current) {
          const stage = stageRef.current;
          const vp = { x: stage.x(), y: stage.y(), scale: stage.scaleX() };
          viewportRef.current = vp;
          setViewport(vp.x, vp.y, vp.scale);
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
  }, [setIsPanning, setViewport]);

  // Cleanup viewport debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (viewportTimeoutRef.current) clearTimeout(viewportTimeoutRef.current);
    };
  }, []);

  if (!grid || !tokens || !freehand || !fogPaintedCells) return null;

  const cellSize = grid.cellSize;

  const getTouchDistance = (t1: Touch, t2: Touch) =>
    Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

  const getTouchMidpoint = (t1: Touch, t2: Touch) => ({
    x: (t1.clientX + t2.clientX) / 2,
    y: (t1.clientY + t2.clientY) / 2,
  });

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

    // Apply zoom to Konva Stage directly for immediate visual feedback
    stage.scale({ x: newScale, y: newScale });
    stage.position(newPos);

    // Update ref immediately
    viewportRef.current = { x: newPos.x, y: newPos.y, scale: newScale };

    // Debounce the store update for persistence only
    if (viewportTimeoutRef.current) clearTimeout(viewportTimeoutRef.current);
    viewportTimeoutRef.current = setTimeout(() => {
      setViewport(newPos.x, newPos.y, newScale);
    }, 150);
  };

  // Helper to get grid cell from canvas position
  const getCellFromPosition = (pos: { x: number; y: number }) => {
    const col = Math.floor(pos.x / cellSize);
    const row = Math.floor(pos.y / cellSize);
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
      dragEndRef.current = pos;
      setIsDraggingRect(true);
      setDragMode("fog");
      return;
    }

    // Erase tool: drag to create erase rectangle
    if (selectedTool === "erase" && e.evt.button === 0) {
      const stage = stageRef.current;
      const pos = stage.getRelativePointerPosition();
      setDragStart(pos);
      dragEndRef.current = pos;
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
    // Update drag rectangle imperatively (no React state update)
    if (isDraggingRect && dragStart) {
      const stage = stageRef.current;
      const pos = stage.getRelativePointerPosition();
      dragEndRef.current = pos;
      if (dragRectRef.current) {
        dragRectRef.current.x(Math.min(dragStart.x, pos.x));
        dragRectRef.current.y(Math.min(dragStart.y, pos.y));
        dragRectRef.current.width(Math.abs(pos.x - dragStart.x));
        dragRectRef.current.height(Math.abs(pos.y - dragStart.y));
        dragRectRef.current.getLayer().batchDraw();
      }
      return;
    }

    if (!isDrawing || selectedTool !== "draw" || !currentPath) return;

    const stage = stageRef.current;
    const pos = stage.getRelativePointerPosition();
    setCurrentPath([...currentPath, pos.x, pos.y]);
  };

  const handleMouseUp = (e: any) => {
    // Complete drag rectangle operation
    const dragEnd = dragEndRef.current;
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
        freehandRef.current?.forEach((path) => {
          for (let i = 0; i < path.points.length; i += 2) {
            const px = path.points[i];
            const py = path.points[i + 1];
            if (px >= minX && px <= maxX && py >= minY && py <= maxY) {
              removeFreehandPath(path.id);
              onDrawingRemove?.(path.id);
              break;
            }
          }
        });
      }

      setDragStart(null);
      dragEndRef.current = null;
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

  const handleTouchStart = (e: any) => {
    const touches = e.evt.touches;

    // Two-finger gesture: start pinch/pan regardless of tool
    if (touches && touches.length >= 2) {
      e.evt.preventDefault();
      const t1 = touches[0];
      const t2 = touches[1];
      const stage = stageRef.current;
      if (!stage) return;

      multiTouchRef.current = {
        active: true,
        initialDistance: getTouchDistance(t1, t2),
        initialScale: stage.scaleX(),
        lastMidpoint: getTouchMidpoint(t1, t2),
      };
      return;
    }

    // Pan tool: Konva's draggable handles touch panning natively
    if (selectedTool === "pan") return;

    // Fog tool: start drag rectangle
    if (selectedTool === "fog" && userId) {
      const stage = stageRef.current;
      const pos = stage.getRelativePointerPosition();
      setDragStart(pos);
      dragEndRef.current = pos;
      setIsDraggingRect(true);
      setDragMode("fog");
      return;
    }

    // Erase tool: start drag rectangle
    if (selectedTool === "erase") {
      const stage = stageRef.current;
      const pos = stage.getRelativePointerPosition();
      setDragStart(pos);
      dragEndRef.current = pos;
      setIsDraggingRect(true);
      setDragMode("erase");
      return;
    }

    // Draw tool: start drawing path
    if (selectedTool === "draw" && selectedToken) {
      const stage = stageRef.current;
      const pos = stage.getRelativePointerPosition();
      setIsDrawing(true);
      setCurrentPath([pos.x, pos.y]);
    }
  };

  const handleTouchMove = (e: any) => {
    e.evt.preventDefault();
    const touches = e.evt.touches;

    // Two-finger gesture: pinch-to-zoom + pan
    if (touches && touches.length >= 2 && multiTouchRef.current?.active) {
      const t1 = touches[0];
      const t2 = touches[1];
      const stage = stageRef.current;
      if (!stage) return;

      const newDistance = getTouchDistance(t1, t2);
      const newMidpoint = getTouchMidpoint(t1, t2);

      // Calculate new scale from pinch ratio
      const scaleRatio = newDistance / multiTouchRef.current.initialDistance;
      const newScale = Math.max(
        MIN_ZOOM,
        Math.min(MAX_ZOOM, multiTouchRef.current.initialScale * scaleRatio)
      );

      // Calculate pan delta from midpoint movement
      const dx = newMidpoint.x - multiTouchRef.current.lastMidpoint.x;
      const dy = newMidpoint.y - multiTouchRef.current.lastMidpoint.y;

      // Zoom toward midpoint (same math as handleWheel)
      const oldScale = stage.scaleX();
      const midpointWorld = {
        x: (newMidpoint.x - stage.x()) / oldScale,
        y: (newMidpoint.y - stage.y()) / oldScale,
      };

      const newPos = {
        x: newMidpoint.x - midpointWorld.x * newScale + dx,
        y: newMidpoint.y - midpointWorld.y * newScale + dy,
      };

      // Apply imperatively (no React state during gesture)
      stage.scale({ x: newScale, y: newScale });
      stage.position(newPos);
      stage.batchDraw();

      viewportRef.current = { x: newPos.x, y: newPos.y, scale: newScale };
      multiTouchRef.current.lastMidpoint = newMidpoint;
      return;
    }

    // Update drag rectangle imperatively (no React state update)
    if (isDraggingRect && dragStart) {
      const stage = stageRef.current;
      const pos = stage.getRelativePointerPosition();
      dragEndRef.current = pos;
      if (dragRectRef.current) {
        dragRectRef.current.x(Math.min(dragStart.x, pos.x));
        dragRectRef.current.y(Math.min(dragStart.y, pos.y));
        dragRectRef.current.width(Math.abs(pos.x - dragStart.x));
        dragRectRef.current.height(Math.abs(pos.y - dragStart.y));
        dragRectRef.current.getLayer().batchDraw();
      }
      return;
    }

    if (!isDrawing || selectedTool !== "draw" || !currentPath) return;

    const stage = stageRef.current;
    const pos = stage.getRelativePointerPosition();
    setCurrentPath([...currentPath, pos.x, pos.y]);
  };

  const handleTouchEnd = (e: any) => {
    // Finalize multi-touch gesture
    if (multiTouchRef.current?.active) {
      const remaining = e.evt.touches?.length ?? 0;
      if (remaining < 2) {
        multiTouchRef.current = null;
        setViewport(viewportRef.current.x, viewportRef.current.y, viewportRef.current.scale);
        return;
      }
      return;
    }

    handleMouseUp(e);
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
    const vp = { x: stage.x(), y: stage.y(), scale: stage.scaleX() };
    viewportRef.current = vp;
    setViewport(vp.x, vp.y, vp.scale);
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
    // Also skip clearing when the player has exactly one movable token (auto-select keeps it selected)
    // In Konva, clicking empty space in a Layer targets the Layer, not the Stage
    const targetType = e.target.getType?.() || e.target.nodeType;
    if (e.target === e.target.getStage() || targetType === "Layer") {
      if (selectedTool !== "draw") {
        // Don't deselect if the player only has one movable token (auto-select would re-select it)
        if (!isDungeonMaster() && tokens) {
          const movable = tokens.filter((t) => t.visible && canMoveToken(t.ownerId));
          if (movable.length === 1) return;
        }
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
      style={{ cursor: cursorStyle, touchAction: "none" }}
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
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onContextMenu={handleContextMenu}
        x={viewportRef.current.x}
        y={viewportRef.current.y}
        scaleX={viewportRef.current.scale}
        scaleY={viewportRef.current.scale}
      >
        <Layer name="base" listening={false}>
          <Group>
            <BackgroundLayer background={background ?? null} grid={grid} />
          </Group>
          <Group>
            <GridLayer grid={grid} />
          </Group>
          <Group>
            <AuraLayer tokens={tokens} cellSize={cellSize} />
          </Group>
        </Layer>
        <Layer name="content">
          <Group>
            <DrawingLayer
              paths={freehand}
              currentPath={currentPath}
              currentColor={drawingColor}
              currentWidth={drawingWidth}
              isEraseMode={selectedTool === "erase"}
              isDragging={isDraggingRect}
              onErasePath={handleErasePath}
            />
          </Group>
          <Group>
            <TokenLayer
              tokens={tokens}
              cellSize={cellSize}
              stageRef={stageRef}
              hoveredTokenId={hoveredTokenId}
              nonFoggedTokenIds={nonFoggedTokenIds}
              onHoverStart={handleTokenHoverStart}
              onHoverEnd={handleTokenHoverEnd}
              onTokenMoved={onTokenMoved}
              onAutoScroll={handleAutoScroll}
              onDragChange={handleDragChange}
            />
          </Group>
        </Layer>
        <Layer name="overlay" listening={false}>
          <Group>
            <FogLayer
              paintedCells={fogPaintedCells || []}
              grid={grid}
              currentUserId={userId}
              isPlayingLocally={isPlayingLocally}
            />
          </Group>
          <Group>
            <SelectedTokenOverlay tokens={tokens} cellSize={cellSize} />
          </Group>
          {nonFoggedTokens.length > 0 && (
            <Group>
              <NonFoggedTokensOverlay
                tokens={nonFoggedTokens}
                cellSize={cellSize}
                isDM={isDungeonMaster()}
                hoveredTokenId={hoveredTokenId}
              />
            </Group>
          )}
          <Group>
            <PingLayer pings={activePings} />
          </Group>
          {/* Drag rectangle overlay — updated imperatively via dragRectRef */}
          {isDraggingRect && dragStart && (
            <Rect
              ref={dragRectRef}
              x={dragStart.x}
              y={dragStart.y}
              width={0}
              height={0}
              fill={dragMode === "fog" ? "#1a1a2e" : "#ef4444"}
              opacity={0.3}
              stroke={dragMode === "fog" ? "#4a4a6e" : "#dc2626"}
              strokeWidth={2}
              dash={[5, 5]}
            />
          )}
          {/* Token drag overlay — rendered above fog/pings so line and ghost are always visible */}
          {dragOverlay && (
            <DragOverlay
              dragState={dragOverlay.dragState}
              token={dragOverlay.token}
              cellSize={cellSize}
            />
          )}
        </Layer>
        <Layer name="controls">
          <SelectedTokenControls
            tokens={tokens}
            cellSize={cellSize}
            onFlip={handleFlipToken}
            draggingTokenId={dragOverlay?.dragState?.tokenId ?? null}
          />
        </Layer>
      </Stage>
    </div>
  );
}
