import type { GridSettings, DnDMap, FogOfWar } from "./types";

export const DEFAULT_GRID: GridSettings = {
  type: "square",
  cellSize: 40,
  width: 30,
  height: 20,
  showGrid: true,
  gridColor: "#cccccc",
  gridOpacity: 0.5,
};

export const DEFAULT_FOG: FogOfWar = {
  enabled: false,
  revealedCells: [],
};

export const DEFAULT_VIEWPORT = {
  x: 0,
  y: 0,
  scale: 1,
};

export const TOKEN_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#3b82f6", // blue
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#6b7280", // gray
  "#000000", // black
  "#ffffff", // white
];

export const GRID_COLORS = [
  "#cccccc",
  "#666666",
  "#333333",
  "#000000",
  "#3b82f6",
  "#22c55e",
];

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 3;
export const ZOOM_STEP = 0.1;

export function createNewMap(name: string): DnDMap {
  return {
    id: crypto.randomUUID(),
    name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    grid: { ...DEFAULT_GRID },
    background: null,
    tokens: [],
    walls: [],
    areas: [],
    labels: [],
    freehand: [],
    fogOfWar: { ...DEFAULT_FOG },
    viewport: { ...DEFAULT_VIEWPORT },
  };
}
