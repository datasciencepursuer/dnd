import { Stage, Layer } from "react-konva";
import { useEffect, useRef, useState } from "react";
import { GridLayer } from "./GridLayer";
import { TokenLayer } from "./TokenLayer";
import { useMapStore, useEditorStore } from "../../store";
import { MIN_ZOOM, MAX_ZOOM, ZOOM_STEP } from "../../constants";

export function MapCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

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

  const handleDragStart = () => {
    if (selectedTool === "pan") {
      setIsPanning(true);
    }
  };

  const handleDragEnd = (e: any) => {
    if (selectedTool === "pan") {
      setIsPanning(false);
      const stage = e.target;
      setViewport(stage.x(), stage.y(), stage.scaleX());
    }
  };

  const handleClick = (e: any) => {
    // If clicking on empty canvas, clear selection
    if (e.target === e.target.getStage()) {
      clearSelection();
    }
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 bg-gray-100 dark:bg-gray-800 overflow-hidden"
      style={{ cursor: selectedTool === "pan" ? "grab" : "default" }}
    >
      <Stage
        ref={stageRef}
        width={dimensions.width}
        height={dimensions.height}
        draggable={selectedTool === "pan"}
        onWheel={handleWheel}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={handleClick}
        onTap={handleClick}
        x={map.viewport.x}
        y={map.viewport.y}
        scaleX={map.viewport.scale}
        scaleY={map.viewport.scale}
      >
        <Layer name="grid">
          <GridLayer grid={map.grid} />
        </Layer>
        <Layer name="tokens">
          <TokenLayer tokens={map.tokens} cellSize={map.grid.cellSize} />
        </Layer>
      </Stage>
    </div>
  );
}
