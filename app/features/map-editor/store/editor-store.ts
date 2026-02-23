import { create } from "zustand";
import type { EditorTool, MapPermission, PlayerPermissions, WallType, TerrainType, Token } from "../types";
import { DEFAULT_PERMISSIONS } from "../types";

interface EditorState {
  selectedTool: EditorTool;
  selectedElementIds: string[];
  currentColor: string;
  currentStrokeWidth: number;
  isDrawing: boolean;
  isPanning: boolean;
  snapToGrid: boolean;

  // Editor context for permissions
  userId: string | null;
  permission: MapPermission;
  permissions: PlayerPermissions;

  // Ping rate limiting (4 pings per 10 seconds)
  pingTimestamps: number[];

  // Character sheet panel
  openCharacterSheetTokenId: string | null;

  // Canvas dimensions for centering calculations
  canvasDimensions: { width: number; height: number };

  // Local play mode - DM sees fog as opaque (player perspective)
  isPlayingLocally: boolean;

  // Wall/area tool state
  currentWallType: WallType;
  currentTerrainType: TerrainType;

  // Build mode - walls/areas visible when Edit Map panel is open
  buildMode: boolean;

  // Pending token animations (AI combat moves)
  pendingAnimations: Record<string, { fromCol: number; fromRow: number }>;

  // Token placement queue (scene import)
  tokenPlacementQueue: Token[];
  tokenPlacementIndex: number;

  // AI image generation usage (shared pool for portraits + maps)
  aiImageRemaining: number | null;
  aiImageLimit: number | null;
  aiImageWindow: string | null;
  aiImageEnabled: boolean | null;

  // Actions
  setTool: (tool: EditorTool) => void;
  setColor: (color: string) => void;
  setStrokeWidth: (width: number) => void;
  setSelectedElements: (ids: string[]) => void;
  addSelectedElement: (id: string) => void;
  clearSelection: () => void;
  setIsDrawing: (isDrawing: boolean) => void;
  setIsPanning: (isPanning: boolean) => void;
  toggleSnapToGrid: () => void;
  setEditorContext: (
    userId: string | null,
    permission: MapPermission,
    customPermissions?: PlayerPermissions | null
  ) => void;

  // Ping rate limiting
  canPing: () => boolean;
  recordPing: () => void;
  getPingsRemaining: () => number;

  // Character sheet panel
  openCharacterSheet: (tokenId: string) => void;
  closeCharacterSheet: () => void;

  // Canvas dimensions
  setCanvasDimensions: (width: number, height: number) => void;
  getCanvasDimensions: () => { width: number; height: number };
  /** Get the grid cell at the center of the visible viewport. */
  getViewportCenterCell: (viewport: { x: number; y: number; scale: number }, cellSize: number) => { col: number; row: number };

  // Local play mode
  togglePlayingLocally: () => void;

  // Wall/area tool state
  setWallType: (type: WallType) => void;
  setTerrainType: (type: TerrainType) => void;

  // Build mode
  setBuildMode: (value: boolean) => void;

  // Pending token animations
  addPendingAnimation: (tokenId: string, fromCol: number, fromRow: number) => void;
  clearPendingAnimation: (tokenId: string) => void;

  // Token placement queue (scene import)
  setTokenPlacementQueue: (tokens: Token[]) => void;
  advancePlacementQueue: () => void;
  cancelPlacementQueue: () => void;
  currentPlacementToken: () => Token | null;

  // AI image usage
  fetchAiImageUsage: () => Promise<void>;
  updateAiImageUsage: (remaining: number | null, window?: string | null) => void;

  // Permission helpers
  isDungeonMaster: () => boolean;
  isTokenOwner: (tokenOwnerId: string | null) => boolean;
  canEditToken: (tokenOwnerId: string | null) => boolean;
  canMoveToken: (tokenOwnerId: string | null) => boolean;
  canDeleteToken: (tokenOwnerId: string | null) => boolean;
  canEditMap: () => boolean;
  canCreateToken: () => boolean;
  canChangeTokenOwner: (tokenOwnerId: string | null) => boolean;
  canLinkOrSaveToken: (tokenOwnerId: string | null) => boolean;
  getPermissions: () => PlayerPermissions;
}

const PING_RATE_LIMIT = 4; // Max pings
const PING_RATE_WINDOW = 10000; // 10 seconds in ms

export const useEditorStore = create<EditorState>((set, get) => ({
  selectedTool: "select",
  selectedElementIds: [],
  currentColor: "#ef4444",
  currentStrokeWidth: 2,
  isDrawing: false,
  isPanning: false,
  snapToGrid: true,
  userId: null,
  permission: "player",
  permissions: DEFAULT_PERMISSIONS.player,
  pingTimestamps: [],
  openCharacterSheetTokenId: null,
  canvasDimensions: { width: 800, height: 600 },
  isPlayingLocally: false,
  currentWallType: "wall",
  currentTerrainType: "difficult",
  buildMode: false,
  pendingAnimations: {},
  tokenPlacementQueue: [],
  tokenPlacementIndex: 0,
  aiImageRemaining: null,
  aiImageLimit: null,
  aiImageWindow: null,
  aiImageEnabled: null,

  setTool: (tool) =>
    set((state) => ({
      selectedTool: tool,
      // Preserve selection when switching to draw or ping tool (needs selected token for color)
      selectedElementIds: tool === "draw" || tool === "ping" ? state.selectedElementIds : [],
    })),

  setColor: (color) => set({ currentColor: color }),

  setStrokeWidth: (width) => set({ currentStrokeWidth: width }),

  setSelectedElements: (ids) => set({ selectedElementIds: ids }),

  addSelectedElement: (id) =>
    set((state) => ({
      selectedElementIds: [...state.selectedElementIds, id],
    })),

  clearSelection: () => set({ selectedElementIds: [] }),

  setIsDrawing: (isDrawing) => set({ isDrawing }),

  setIsPanning: (isPanning) => set({ isPanning }),

  toggleSnapToGrid: () => set((state) => ({ snapToGrid: !state.snapToGrid })),

  setEditorContext: (userId, permission, customPermissions) => {
    // Merge custom permissions with defaults to ensure new fields are always present
    const defaults = DEFAULT_PERMISSIONS[permission];
    const permissions = customPermissions
      ? { ...defaults, ...customPermissions }
      : defaults;
    set({ userId, permission, permissions });
  },

  // Ping rate limiting
  canPing: () => {
    const now = Date.now();
    const recentPings = get().pingTimestamps.filter(
      (ts) => now - ts < PING_RATE_WINDOW
    );
    return recentPings.length < PING_RATE_LIMIT;
  },

  recordPing: () => {
    const now = Date.now();
    set((state) => ({
      pingTimestamps: [
        ...state.pingTimestamps.filter((ts) => now - ts < PING_RATE_WINDOW),
        now,
      ],
    }));
  },

  getPingsRemaining: () => {
    const now = Date.now();
    const recentPings = get().pingTimestamps.filter(
      (ts) => now - ts < PING_RATE_WINDOW
    );
    return Math.max(0, PING_RATE_LIMIT - recentPings.length);
  },

  // Character sheet panel
  openCharacterSheet: (tokenId) => set({ openCharacterSheetTokenId: tokenId }),
  closeCharacterSheet: () => set({ openCharacterSheetTokenId: null }),

  // Canvas dimensions
  setCanvasDimensions: (width, height) => set({ canvasDimensions: { width, height } }),
  getCanvasDimensions: () => get().canvasDimensions,
  getViewportCenterCell: (viewport, cellSize) => {
    const { width, height } = get().canvasDimensions;
    const worldX = (width / 2 - viewport.x) / viewport.scale;
    const worldY = (height / 2 - viewport.y) / viewport.scale;
    return { col: Math.floor(worldX / cellSize), row: Math.floor(worldY / cellSize) };
  },

  // Local play mode
  togglePlayingLocally: () => set((state) => ({ isPlayingLocally: !state.isPlayingLocally })),

  // Wall/area tool state
  setWallType: (type) => set({ currentWallType: type }),
  setTerrainType: (type) => set({ currentTerrainType: type }),

  // Build mode
  setBuildMode: (value) => set({ buildMode: value }),

  // Pending token animations
  addPendingAnimation: (tokenId, fromCol, fromRow) =>
    set((state) => ({
      pendingAnimations: { ...state.pendingAnimations, [tokenId]: { fromCol, fromRow } },
    })),
  clearPendingAnimation: (tokenId) =>
    set((state) => {
      const { [tokenId]: _, ...rest } = state.pendingAnimations;
      return { pendingAnimations: rest };
    }),

  // Token placement queue (scene import)
  setTokenPlacementQueue: (tokens) =>
    set({ tokenPlacementQueue: tokens, tokenPlacementIndex: 0, selectedTool: "token", selectedElementIds: [] }),
  advancePlacementQueue: () => {
    const { tokenPlacementIndex, tokenPlacementQueue } = get();
    const nextIndex = tokenPlacementIndex + 1;
    if (nextIndex >= tokenPlacementQueue.length) {
      // Queue exhausted
      set({ tokenPlacementQueue: [], tokenPlacementIndex: 0, selectedTool: "select" });
    } else {
      set({ tokenPlacementIndex: nextIndex });
    }
  },
  cancelPlacementQueue: () =>
    set({ tokenPlacementQueue: [], tokenPlacementIndex: 0, selectedTool: "select" }),
  currentPlacementToken: () => {
    const { tokenPlacementQueue, tokenPlacementIndex } = get();
    return tokenPlacementQueue[tokenPlacementIndex] ?? null;
  },

  // AI image usage
  fetchAiImageUsage: async () => {
    try {
      const res = await fetch("/api/generate-portrait");
      const data = await res.json();
      set({
        aiImageRemaining: data.remaining ?? null,
        aiImageLimit: data.limit ?? null,
        aiImageWindow: data.window ?? null,
        aiImageEnabled: data.enabled ?? null,
      });
    } catch {
      // Silently fail — usage stats are non-critical
    }
  },
  updateAiImageUsage: (remaining, window) => {
    const update: Partial<EditorState> = {};
    if (remaining !== undefined) update.aiImageRemaining = remaining;
    if (window !== undefined) update.aiImageWindow = window;
    set(update);
  },

  // Permission helpers
  isDungeonMaster: () => get().permission === "dm",

  getPermissions: () => get().permissions,

  // Check if current user owns the token
  isTokenOwner: (tokenOwnerId: string | null) => {
    const state = get();
    // If tokenOwnerId is null, it was created by DM (map owner)
    // DM is always considered the owner of null-owner tokens
    if (tokenOwnerId === null) return state.permission === "dm";
    return tokenOwnerId === state.userId && state.userId !== null;
  },

  // DM can edit any token, players can only edit their own
  canEditToken: (tokenOwnerId: string | null) => {
    const state = get();
    const perms = state.permissions;

    // DM can edit any token
    if (perms.canEditAllTokens) return true;

    // Players can edit their own tokens
    if (perms.canEditOwnTokens) {
      if (tokenOwnerId === null) return state.permission === "dm";
      return tokenOwnerId === state.userId && state.userId !== null;
    }

    return false;
  },

  // DM can move any token, players can only move their own
  canMoveToken: (tokenOwnerId: string | null) => {
    const state = get();
    const perms = state.permissions;

    // DM can always move any token
    if (perms.canMoveAllTokens) return true;

    // Players can move their own tokens
    if (perms.canMoveOwnTokens) {
      const isOwner = tokenOwnerId === null
        ? state.permission === "dm"
        : tokenOwnerId === state.userId && state.userId !== null;

      return isOwner;
    }

    return false;
  },

  // Can delete if DM (all tokens) or token owner (own tokens)
  canDeleteToken: (tokenOwnerId: string | null) => {
    const state = get();
    const perms = state.permissions;

    // DM can delete any token
    if (perms.canDeleteAllTokens) return true;

    // Token owners can delete their own tokens
    if (perms.canDeleteOwnTokens) {
      // If tokenOwnerId is null, it was created by DM
      if (tokenOwnerId === null) return state.permission === "dm";
      return tokenOwnerId === state.userId && state.userId !== null;
    }

    return false;
  },

  // Only DM can edit map settings
  canEditMap: () => get().permissions.canEditMap,

  // All roles can create tokens
  canCreateToken: () => get().permissions.canCreateTokens,

  // Token owner or DM can change token ownership
  canChangeTokenOwner: (tokenOwnerId: string | null) => {
    const state = get();
    // DM can always reassign any token
    if (state.permission === "dm") return true;
    // Player owns their own tokens
    return tokenOwnerId === state.userId && state.userId !== null;
  },

  // Can only link/save tokens you own
  canLinkOrSaveToken: (tokenOwnerId: string | null) => {
    const state = get();
    // If tokenOwnerId is null, it was created by DM
    if (tokenOwnerId === null) return state.permission === "dm";
    return tokenOwnerId === state.userId && state.userId !== null;
  },
}));
