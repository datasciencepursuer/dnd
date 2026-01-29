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

  // Permission helpers
  isOwner: () => boolean;
  canEditToken: (tokenOwnerId: string | null) => boolean;
  canMoveToken: (tokenOwnerId: string | null) => boolean;
  canDeleteToken: (tokenOwnerId: string | null) => boolean;
  canEditMap: () => boolean;
  canCreateToken: () => boolean;
  canManagePlayers: () => boolean;
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
  permission: "view",
  permissions: DEFAULT_PERMISSIONS.view,
  pingTimestamps: [],

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
    // Use custom permissions if provided, otherwise use defaults for the permission level
    const permissions = customPermissions || DEFAULT_PERMISSIONS[permission];
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

  // Permission helpers
  isOwner: () => get().permission === "owner",

  getPermissions: () => get().permissions,

  canEditToken: (tokenOwnerId: string | null) => {
    const state = get();
    const perms = state.permissions;

    // Can edit all tokens?
    if (perms.canEditAllTokens) return true;

    // Token owners can always edit their own tokens
    if (tokenOwnerId === state.userId && state.userId !== null) return true;

    // Can edit own tokens based on permissions?
    if (perms.canEditOwnTokens) {
      if (tokenOwnerId === state.userId) return true;
    }

    return false;
  },

  canMoveToken: (tokenOwnerId: string | null) => {
    const state = get();
    const perms = state.permissions;

    // Can move all tokens?
    if (perms.canMoveAllTokens) return true;

    // Can move own tokens?
    if (perms.canMoveOwnTokens) {
      if (tokenOwnerId === state.userId) return true;
    }

    return false;
  },

  canDeleteToken: (tokenOwnerId: string | null) => {
    const state = get();
    const perms = state.permissions;

    // Can delete all tokens?
    if (perms.canDeleteAllTokens) return true;

    // Token owners can always delete their own tokens
    if (tokenOwnerId === state.userId && state.userId !== null) return true;

    // Can delete own tokens based on permissions?
    if (perms.canDeleteOwnTokens) {
      if (tokenOwnerId === state.userId) return true;
    }

    return false;
  },

  canEditMap: () => get().permissions.canEditMap,

  canCreateToken: () => get().permissions.canCreateTokens,

  canManagePlayers: () => get().permissions.canManagePlayers,
}));
