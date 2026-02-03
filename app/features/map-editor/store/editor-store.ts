import { create } from "zustand";
import type { EditorTool, MapPermission, PlayerPermissions } from "../types";
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

  // Combat turn context - token IDs allowed to move this turn (null = no combat restriction)
  combatTurnTokenIds: string[] | null;

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

  // Combat turn context
  setCombatTurnTokenIds: (tokenIds: string[] | null) => void;

  // Permission helpers
  isDungeonMaster: () => boolean;
  isTokenOwner: (tokenOwnerId: string | null) => boolean;
  canEditToken: (tokenOwnerId: string | null) => boolean;
  canMoveToken: (tokenOwnerId: string | null, tokenId?: string) => boolean;
  canDeleteToken: (tokenOwnerId: string | null) => boolean;
  canEditMap: () => boolean;
  canCreateToken: () => boolean;
  canChangeTokenOwner: () => boolean;
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
  combatTurnTokenIds: null,

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

  // Combat turn context
  setCombatTurnTokenIds: (tokenIds) => set({ combatTurnTokenIds: tokenIds }),

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

  // DM can move any token, players can only move their own (and during combat, only on their turn)
  canMoveToken: (tokenOwnerId: string | null, tokenId?: string) => {
    const state = get();
    const perms = state.permissions;

    // DM can always move any token - full flexibility regardless of turn
    if (perms.canMoveAllTokens) return true;

    // Players can move their own tokens
    if (perms.canMoveOwnTokens) {
      const isOwner = tokenOwnerId === null
        ? state.permission === "dm"
        : tokenOwnerId === state.userId && state.userId !== null;

      if (!isOwner) return false;

      // During combat, players can only move their token on their turn
      if (state.combatTurnTokenIds && tokenId) {
        return state.combatTurnTokenIds.includes(tokenId);
      }

      return true;
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

  // Only DM can change token ownership
  canChangeTokenOwner: () => get().permissions.canChangeTokenOwner,

  // Can only link/save tokens you own
  canLinkOrSaveToken: (tokenOwnerId: string | null) => {
    const state = get();
    // If tokenOwnerId is null, it was created by DM
    if (tokenOwnerId === null) return state.permission === "dm";
    return tokenOwnerId === state.userId && state.userId !== null;
  },
}));
