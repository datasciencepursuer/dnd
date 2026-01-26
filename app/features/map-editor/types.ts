// Grid Types
export type GridType = "square" | "hex";

export interface GridSettings {
  type: GridType;
  cellSize: number;
  width: number;
  height: number;
  showGrid: boolean;
  gridColor: string;
  gridOpacity: number;
}

// Position Types
export interface Position {
  x: number;
  y: number;
}

export interface GridPosition {
  col: number;
  row: number;
}

// Token Types
export type TokenLayer = "character" | "monster" | "object";

export interface Token {
  id: string;
  name: string;
  imageUrl: string | null;
  color: string;
  size: number;
  position: GridPosition;
  rotation: number;
  visible: boolean;
  layer: TokenLayer;
}

// Drawing Types
export type DrawingTool = "wall" | "area" | "text" | "freehand";

export interface WallSegment {
  id: string;
  points: Position[];
  color: string;
  width: number;
  doorway: boolean;
}

export interface AreaShape {
  id: string;
  type: "rectangle" | "circle" | "polygon";
  points: Position[];
  fillColor: string;
  fillOpacity: number;
  strokeColor: string;
  strokeWidth: number;
  label?: string;
}

export interface TextLabel {
  id: string;
  text: string;
  position: Position;
  fontSize: number;
  color: string;
  rotation: number;
}

export interface FreehandPath {
  id: string;
  points: number[];
  color: string;
  width: number;
}

// Fog of War
export interface FogOfWar {
  enabled: boolean;
  revealedCells: string[];
}

// Background
export interface Background {
  imageUrl: string;
  position: Position;
  scale: number;
  rotation: number;
}

// Complete Map
export interface DnDMap {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  grid: GridSettings;
  background: Background | null;
  tokens: Token[];
  walls: WallSegment[];
  areas: AreaShape[];
  labels: TextLabel[];
  freehand: FreehandPath[];
  fogOfWar: FogOfWar;
  viewport: {
    x: number;
    y: number;
    scale: number;
  };
}

// Editor State
export type EditorTool =
  | "select"
  | "pan"
  | "token"
  | "wall"
  | "area"
  | "text"
  | "fog-reveal"
  | "fog-hide";

export interface EditorState {
  selectedTool: EditorTool;
  selectedElementIds: string[];
  currentColor: string;
  currentStrokeWidth: number;
  isDrawing: boolean;
  isPanning: boolean;
  snapToGrid: boolean;
}
