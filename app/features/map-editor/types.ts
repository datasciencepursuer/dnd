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
  flipped: boolean;
  visible: boolean;
  layer: TokenLayer;
  ownerId: string | null; // User who created/owns this token (null = map owner)
}

// Permission levels for map access
export type MapPermission = "view" | "edit" | "owner";

// Granular player permissions
export interface PlayerPermissions {
  canCreateTokens: boolean;
  canEditOwnTokens: boolean;
  canEditAllTokens: boolean;
  canDeleteOwnTokens: boolean;
  canDeleteAllTokens: boolean;
  canMoveOwnTokens: boolean;
  canMoveAllTokens: boolean;
  canViewMap: boolean;
  canEditMap: boolean;
  canManagePlayers: boolean;
}

// Default permissions for each role
export const DEFAULT_PERMISSIONS: Record<MapPermission, PlayerPermissions> = {
  view: {
    canCreateTokens: false,
    canEditOwnTokens: false,
    canEditAllTokens: false,
    canDeleteOwnTokens: false,
    canDeleteAllTokens: false,
    canMoveOwnTokens: true, // View users can move their own tokens
    canMoveAllTokens: false,
    canViewMap: true,
    canEditMap: false,
    canManagePlayers: false,
  },
  edit: {
    canCreateTokens: false,
    canEditOwnTokens: true,
    canEditAllTokens: false,
    canDeleteOwnTokens: true,
    canDeleteAllTokens: false,
    canMoveOwnTokens: true,
    canMoveAllTokens: false,
    canViewMap: true,
    canEditMap: false,
    canManagePlayers: false,
  },
  owner: {
    canCreateTokens: true,
    canEditOwnTokens: true,
    canEditAllTokens: true,
    canDeleteOwnTokens: true,
    canDeleteAllTokens: true,
    canMoveOwnTokens: true,
    canMoveAllTokens: true,
    canViewMap: true,
    canEditMap: true,
    canManagePlayers: true,
  },
};

// Editor context for permission checking
export interface EditorContext {
  userId: string | null;
  permission: MapPermission;
  permissions: PlayerPermissions;
  isMapOwner: boolean;
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
  | "draw"
  | "erase"
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
