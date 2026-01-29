import { create } from "zustand";
import { temporal } from "zundo";
import type { DnDMap, Token, GridPosition, GridSettings, Background, FreehandPath, RollResult, FogCell } from "../types";
import { createNewMap } from "../constants";

// Timeout for dirty tokens - after this time, server updates will overwrite local changes
const DIRTY_TOKEN_STALE_MS = 10000; // 10 seconds

interface MapState {
  map: DnDMap | null;

  // Dirty token tracking for optimistic updates
  dirtyTokens: Set<string>;
  dirtyTimestamps: Map<string, number>;

  // Map actions
  loadMap: (map: DnDMap) => void;
  syncMap: (map: DnDMap) => void;
  newMap: (name: string) => void;
  updateMapName: (name: string) => void;

  // Token actions
  addToken: (token: Token) => void;
  updateToken: (id: string, updates: Partial<Token>) => void;
  removeToken: (id: string) => void;
  moveToken: (id: string, position: GridPosition) => void;
  flipToken: (id: string) => void;
  reorderTokens: (fromIndex: number, toIndex: number) => void;

  // Dirty token management
  markTokenDirty: (tokenId: string) => void;
  clearDirtyToken: (tokenId: string) => void;
  clearStaleDirtyTokens: () => void;

  // Grid actions
  updateGrid: (settings: Partial<GridSettings>) => void;

  // Background actions
  setBackground: (imageUrl: string | null) => void;

  // Viewport actions
  setViewport: (x: number, y: number, scale: number) => void;

  // Fog actions
  toggleFog: () => void;
  revealCell: (col: number, row: number) => void;
  hideCell: (col: number, row: number) => void;
  paintFogCell: (col: number, row: number, creatorId: string) => void;
  eraseFogCell: (col: number, row: number) => void;
  paintFogInRange: (startCol: number, startRow: number, endCol: number, endRow: number, creatorId: string) => void;
  eraseFogInRange: (startCol: number, startRow: number, endCol: number, endRow: number) => void;
  clearAllFog: () => void;

  // Drawing actions
  addFreehandPath: (path: FreehandPath) => void;
  removeFreehandPath: (id: string) => void;
  clearAllDrawings: () => void;

  // Roll history actions
  addRollResult: (result: RollResult) => void;
  clearRollHistory: () => void;
}

export const useMapStore = create<MapState>()(
  temporal(
    (set, get) => ({
      map: null,
      dirtyTokens: new Set<string>(),
      dirtyTimestamps: new Map<string, number>(),

      loadMap: (map) => set({ map, dirtyTokens: new Set(), dirtyTimestamps: new Map() }),

      // Sync map data from server while preserving local dirty tokens and viewport
      syncMap: (serverMap) =>
        set((state) => {
          if (!state.map) return { map: serverMap };

          const now = Date.now();

          // Filter out stale dirty tokens
          const activeDirtyTokens = new Set<string>();
          for (const tokenId of state.dirtyTokens) {
            const timestamp = state.dirtyTimestamps.get(tokenId);
            if (timestamp && now - timestamp < DIRTY_TOKEN_STALE_MS) {
              activeDirtyTokens.add(tokenId);
            }
          }

          // Merge tokens: keep local dirty tokens, take server's for others
          const mergedTokens = serverMap.tokens.map((serverToken) => {
            // If this token is dirty locally, keep our version
            if (activeDirtyTokens.has(serverToken.id)) {
              const localToken = state.map!.tokens.find((t) => t.id === serverToken.id);
              if (localToken) {
                return localToken;
              }
            }
            return serverToken;
          });

          // Also preserve any local-only tokens that are dirty but not yet on server
          const serverTokenIds = new Set(serverMap.tokens.map((t) => t.id));
          const localOnlyDirtyTokens = state.map.tokens.filter(
            (t) => activeDirtyTokens.has(t.id) && !serverTokenIds.has(t.id)
          );

          return {
            map: {
              ...serverMap,
              tokens: [...mergedTokens, ...localOnlyDirtyTokens],
              viewport: state.map.viewport, // Preserve viewport
            },
            dirtyTokens: activeDirtyTokens,
            dirtyTimestamps: new Map(
              [...state.dirtyTimestamps].filter(([id]) => activeDirtyTokens.has(id))
            ),
          };
        }),

      newMap: (name) => set({ map: createNewMap(name) }),

      updateMapName: (name) =>
        set((state) => {
          if (!state.map) return state;
          return {
            map: {
              ...state.map,
              name,
              updatedAt: new Date().toISOString(),
            },
          };
        }),

      addToken: (token) =>
        set((state) => {
          if (!state.map) return state;
          const newDirtyTokens = new Set(state.dirtyTokens).add(token.id);
          const newDirtyTimestamps = new Map(state.dirtyTimestamps).set(token.id, Date.now());
          return {
            map: {
              ...state.map,
              tokens: [...state.map.tokens, token],
              updatedAt: new Date().toISOString(),
            },
            dirtyTokens: newDirtyTokens,
            dirtyTimestamps: newDirtyTimestamps,
          };
        }),

      updateToken: (id, updates) =>
        set((state) => {
          if (!state.map) return state;
          const newDirtyTokens = new Set(state.dirtyTokens).add(id);
          const newDirtyTimestamps = new Map(state.dirtyTimestamps).set(id, Date.now());
          return {
            map: {
              ...state.map,
              tokens: state.map.tokens.map((t) =>
                t.id === id ? { ...t, ...updates } : t
              ),
              updatedAt: new Date().toISOString(),
            },
            dirtyTokens: newDirtyTokens,
            dirtyTimestamps: newDirtyTimestamps,
          };
        }),

      removeToken: (id) =>
        set((state) => {
          if (!state.map) return state;
          // Remove from dirty tracking when deleted
          const newDirtyTokens = new Set(state.dirtyTokens);
          newDirtyTokens.delete(id);
          const newDirtyTimestamps = new Map(state.dirtyTimestamps);
          newDirtyTimestamps.delete(id);
          return {
            map: {
              ...state.map,
              tokens: state.map.tokens.filter((t) => t.id !== id),
              updatedAt: new Date().toISOString(),
            },
            dirtyTokens: newDirtyTokens,
            dirtyTimestamps: newDirtyTimestamps,
          };
        }),

      moveToken: (id, position) =>
        set((state) => {
          if (!state.map) return state;
          const newDirtyTokens = new Set(state.dirtyTokens).add(id);
          const newDirtyTimestamps = new Map(state.dirtyTimestamps).set(id, Date.now());
          return {
            map: {
              ...state.map,
              tokens: state.map.tokens.map((t) =>
                t.id === id ? { ...t, position } : t
              ),
              updatedAt: new Date().toISOString(),
            },
            dirtyTokens: newDirtyTokens,
            dirtyTimestamps: newDirtyTimestamps,
          };
        }),

      flipToken: (id) =>
        set((state) => {
          if (!state.map) return state;
          const newDirtyTokens = new Set(state.dirtyTokens).add(id);
          const newDirtyTimestamps = new Map(state.dirtyTimestamps).set(id, Date.now());
          return {
            map: {
              ...state.map,
              tokens: state.map.tokens.map((t) =>
                t.id === id ? { ...t, flipped: !t.flipped } : t
              ),
              updatedAt: new Date().toISOString(),
            },
            dirtyTokens: newDirtyTokens,
            dirtyTimestamps: newDirtyTimestamps,
          };
        }),

      reorderTokens: (fromIndex, toIndex) =>
        set((state) => {
          if (!state.map) return state;
          const tokens = [...state.map.tokens];
          const [removed] = tokens.splice(fromIndex, 1);
          tokens.splice(toIndex, 0, removed);
          // Mark reordered token as dirty
          const newDirtyTokens = new Set(state.dirtyTokens).add(removed.id);
          const newDirtyTimestamps = new Map(state.dirtyTimestamps).set(removed.id, Date.now());
          return {
            map: {
              ...state.map,
              tokens,
              updatedAt: new Date().toISOString(),
            },
            dirtyTokens: newDirtyTokens,
            dirtyTimestamps: newDirtyTimestamps,
          };
        }),

      // Dirty token management
      markTokenDirty: (tokenId) =>
        set((state) => {
          const newDirtyTokens = new Set(state.dirtyTokens).add(tokenId);
          const newDirtyTimestamps = new Map(state.dirtyTimestamps).set(tokenId, Date.now());
          return {
            dirtyTokens: newDirtyTokens,
            dirtyTimestamps: newDirtyTimestamps,
          };
        }),

      clearDirtyToken: (tokenId) =>
        set((state) => {
          const newDirtyTokens = new Set(state.dirtyTokens);
          newDirtyTokens.delete(tokenId);
          const newDirtyTimestamps = new Map(state.dirtyTimestamps);
          newDirtyTimestamps.delete(tokenId);
          return {
            dirtyTokens: newDirtyTokens,
            dirtyTimestamps: newDirtyTimestamps,
          };
        }),

      clearStaleDirtyTokens: () =>
        set((state) => {
          const now = Date.now();
          const newDirtyTokens = new Set<string>();
          const newDirtyTimestamps = new Map<string, number>();

          for (const [tokenId, timestamp] of state.dirtyTimestamps) {
            if (now - timestamp < DIRTY_TOKEN_STALE_MS) {
              newDirtyTokens.add(tokenId);
              newDirtyTimestamps.set(tokenId, timestamp);
            }
          }

          return {
            dirtyTokens: newDirtyTokens,
            dirtyTimestamps: newDirtyTimestamps,
          };
        }),

      updateGrid: (settings) =>
        set((state) => {
          if (!state.map) return state;
          return {
            map: {
              ...state.map,
              grid: { ...state.map.grid, ...settings },
              updatedAt: new Date().toISOString(),
            },
          };
        }),

      setBackground: (imageUrl) =>
        set((state) => {
          if (!state.map) return state;
          return {
            map: {
              ...state.map,
              background: imageUrl
                ? { imageUrl, position: { x: 0, y: 0 }, scale: 1, rotation: 0 }
                : null,
              updatedAt: new Date().toISOString(),
            },
          };
        }),

      setViewport: (x, y, scale) =>
        set((state) => {
          if (!state.map) return state;
          return {
            map: {
              ...state.map,
              viewport: { x, y, scale },
            },
          };
        }),

      toggleFog: () =>
        set((state) => {
          if (!state.map) return state;
          return {
            map: {
              ...state.map,
              fogOfWar: {
                ...state.map.fogOfWar,
                enabled: !state.map.fogOfWar.enabled,
              },
              updatedAt: new Date().toISOString(),
            },
          };
        }),

      revealCell: (col, row) =>
        set((state) => {
          if (!state.map) return state;
          const key = `${col},${row}`;
          if (state.map.fogOfWar.revealedCells.includes(key)) return state;
          return {
            map: {
              ...state.map,
              fogOfWar: {
                ...state.map.fogOfWar,
                revealedCells: [...state.map.fogOfWar.revealedCells, key],
              },
              updatedAt: new Date().toISOString(),
            },
          };
        }),

      hideCell: (col, row) =>
        set((state) => {
          if (!state.map) return state;
          const key = `${col},${row}`;
          return {
            map: {
              ...state.map,
              fogOfWar: {
                ...state.map.fogOfWar,
                revealedCells: state.map.fogOfWar.revealedCells.filter(
                  (k) => k !== key
                ),
              },
              updatedAt: new Date().toISOString(),
            },
          };
        }),

      paintFogCell: (col, row, creatorId) =>
        set((state) => {
          if (!state.map) return state;
          const key = `${col},${row}`;
          const paintedCells = state.map.fogOfWar.paintedCells || [];
          // Don't add if already exists
          if (paintedCells.some((c) => c.key === key)) return state;
          const newCell: FogCell = { key, creatorId };
          return {
            map: {
              ...state.map,
              fogOfWar: {
                ...state.map.fogOfWar,
                paintedCells: [...paintedCells, newCell],
              },
              updatedAt: new Date().toISOString(),
            },
          };
        }),

      eraseFogCell: (col, row) =>
        set((state) => {
          if (!state.map) return state;
          const key = `${col},${row}`;
          const paintedCells = state.map.fogOfWar.paintedCells || [];
          return {
            map: {
              ...state.map,
              fogOfWar: {
                ...state.map.fogOfWar,
                paintedCells: paintedCells.filter((c) => c.key !== key),
              },
              updatedAt: new Date().toISOString(),
            },
          };
        }),

      paintFogInRange: (startCol, startRow, endCol, endRow, creatorId) =>
        set((state) => {
          if (!state.map) return state;
          const paintedCells = state.map.fogOfWar.paintedCells || [];
          const existingKeys = new Set(paintedCells.map((c) => c.key));
          const newCells: FogCell[] = [];

          // Normalize range (handle any drag direction)
          const minCol = Math.min(startCol, endCol);
          const maxCol = Math.max(startCol, endCol);
          const minRow = Math.min(startRow, endRow);
          const maxRow = Math.max(startRow, endRow);

          for (let col = minCol; col <= maxCol; col++) {
            for (let row = minRow; row <= maxRow; row++) {
              const key = `${col},${row}`;
              if (!existingKeys.has(key)) {
                newCells.push({ key, creatorId });
              }
            }
          }

          if (newCells.length === 0) return state;

          return {
            map: {
              ...state.map,
              fogOfWar: {
                ...state.map.fogOfWar,
                paintedCells: [...paintedCells, ...newCells],
              },
              updatedAt: new Date().toISOString(),
            },
          };
        }),

      eraseFogInRange: (startCol, startRow, endCol, endRow) =>
        set((state) => {
          if (!state.map) return state;
          const paintedCells = state.map.fogOfWar.paintedCells || [];

          // Normalize range
          const minCol = Math.min(startCol, endCol);
          const maxCol = Math.max(startCol, endCol);
          const minRow = Math.min(startRow, endRow);
          const maxRow = Math.max(startRow, endRow);

          const keysToRemove = new Set<string>();
          for (let col = minCol; col <= maxCol; col++) {
            for (let row = minRow; row <= maxRow; row++) {
              keysToRemove.add(`${col},${row}`);
            }
          }

          const filteredCells = paintedCells.filter((c) => !keysToRemove.has(c.key));
          if (filteredCells.length === paintedCells.length) return state;

          return {
            map: {
              ...state.map,
              fogOfWar: {
                ...state.map.fogOfWar,
                paintedCells: filteredCells,
              },
              updatedAt: new Date().toISOString(),
            },
          };
        }),

      clearAllFog: () =>
        set((state) => {
          if (!state.map) return state;
          return {
            map: {
              ...state.map,
              fogOfWar: {
                ...state.map.fogOfWar,
                paintedCells: [],
              },
              updatedAt: new Date().toISOString(),
            },
          };
        }),

      addFreehandPath: (path) =>
        set((state) => {
          if (!state.map) return state;
          return {
            map: {
              ...state.map,
              freehand: [...state.map.freehand, path],
              updatedAt: new Date().toISOString(),
            },
          };
        }),

      removeFreehandPath: (id) =>
        set((state) => {
          if (!state.map) return state;
          return {
            map: {
              ...state.map,
              freehand: state.map.freehand.filter((p) => p.id !== id),
              updatedAt: new Date().toISOString(),
            },
          };
        }),

      clearAllDrawings: () =>
        set((state) => {
          if (!state.map) return state;
          return {
            map: {
              ...state.map,
              freehand: [],
              updatedAt: new Date().toISOString(),
            },
          };
        }),

      addRollResult: (result) =>
        set((state) => {
          if (!state.map) return state;
          // Keep only the 8 most recent rolls
          const rollHistory = [result, ...(state.map.rollHistory || [])].slice(0, 8);
          return {
            map: {
              ...state.map,
              rollHistory,
              updatedAt: new Date().toISOString(),
            },
          };
        }),

      clearRollHistory: () =>
        set((state) => {
          if (!state.map) return state;
          return {
            map: {
              ...state.map,
              rollHistory: [],
              updatedAt: new Date().toISOString(),
            },
          };
        }),
    }),
    { limit: 50 }
  )
);
