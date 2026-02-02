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
  paintedCells: [],
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

export interface CreateMapOptions {
  name: string;
  gridWidth?: number;
  gridHeight?: number;
}

export function createNewMap(options: CreateMapOptions | string): DnDMap {
  // Support legacy string argument
  const { name, gridWidth, gridHeight } =
    typeof options === "string"
      ? { name: options, gridWidth: undefined, gridHeight: undefined }
      : options;

  return {
    id: crypto.randomUUID(),
    name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    grid: {
      ...DEFAULT_GRID,
      width: gridWidth ?? DEFAULT_GRID.width,
      height: gridHeight ?? DEFAULT_GRID.height,
    },
    background: null,
    tokens: [],
    walls: [],
    areas: [],
    labels: [],
    freehand: [],
    fogOfWar: { ...DEFAULT_FOG },
    rollHistory: [],
    monsterGroups: [],
    viewport: { ...DEFAULT_VIEWPORT },
  };
}
