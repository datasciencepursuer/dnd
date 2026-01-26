import { Stage, Layer } from "react-konva";
import { useEffect, useRef, useState } from "react";
import { BackgroundLayer } from "./BackgroundLayer";
import { GridLayer } from "./GridLayer";
import { TokenLayer } from "./TokenLayer";
import { useMapStore, useEditorStore } from "../../store";
import { MIN_ZOOM, MAX_ZOOM, ZOOM_STEP } from "../../constants";

export function MapCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [isRightClickPanning, setIsRightClickPanning] = useState(false);
  const lastMousePos = useRef<{ x: number; y: number } | null>(null);

  const map = useMapStore((s) => s.map);
  const setViewport = useMapStore((s) => s.setViewport);
  const selectedTool = useEditorStore((s) => s.selectedTool);
  const setIsPanning = useEditorStore((s) => s.setIsPanning);
  const clearSelection = useEditorStore((s) => s.clearSelection);

  const stageRef = useRef<any>(null);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  // Handle right-click panning with mouse move
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isRightClickPanning || !lastMousePos.current || !stageRef.current)
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
      if (e.button === 2 && isRightClickPanning) {
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

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isRightClickPanning, setIsPanning, setViewport]);

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

  const handleMouseDown = (e: any) => {
    // Right-click to pan
    if (e.evt.button === 2) {
      setIsRightClickPanning(true);
      setIsPanning(true);
      lastMousePos.current = { x: e.evt.clientX, y: e.evt.clientY };
    }
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
    // If clicking on empty canvas, clear selection
    if (e.target === e.target.getStage()) {
      clearSelection();
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
      : "default";

  return (
    <div
      ref={containerRef}
      className="flex-1 bg-gray-100 dark:bg-gray-800 overflow-hidden"
      style={{ cursor: cursorStyle }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Stage
        ref={stageRef}
        width={dimensions.width}
        height={dimensions.height}
        draggable={selectedTool === "pan"}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
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
        <Layer name="tokens">
          <TokenLayer
            tokens={map.tokens}
            cellSize={map.grid.cellSize}
            stageRef={stageRef}
          />
        </Layer>
      </Stage>
    </div>
  );
}
