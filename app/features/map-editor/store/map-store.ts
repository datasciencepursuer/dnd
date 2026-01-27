import { create } from "zustand";
import { temporal } from "zundo";
import type { DnDMap, Token, GridPosition, GridSettings, Background, FreehandPath } from "../types";
import { createNewMap } from "../constants";

interface MapState {
  map: DnDMap | null;

  // Map actions
  loadMap: (map: DnDMap) => void;
  newMap: (name: string) => void;
  updateMapName: (name: string) => void;

  // Token actions
  addToken: (token: Token) => void;
  updateToken: (id: string, updates: Partial<Token>) => void;
  removeToken: (id: string) => void;
  moveToken: (id: string, position: GridPosition) => void;
  flipToken: (id: string) => void;
  reorderTokens: (fromIndex: number, toIndex: number) => void;

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

  // Drawing actions
  addFreehandPath: (path: FreehandPath) => void;
  removeFreehandPath: (id: string) => void;
  clearAllDrawings: () => void;
}

export const useMapStore = create<MapState>()(
  temporal(
    (set) => ({
      map: null,

      loadMap: (map) => set({ map }),

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
          return {
            map: {
              ...state.map,
              tokens: [...state.map.tokens, token],
              updatedAt: new Date().toISOString(),
            },
          };
        }),

      updateToken: (id, updates) =>
        set((state) => {
          if (!state.map) return state;
          return {
            map: {
              ...state.map,
              tokens: state.map.tokens.map((t) =>
                t.id === id ? { ...t, ...updates } : t
              ),
              updatedAt: new Date().toISOString(),
            },
          };
        }),

      removeToken: (id) =>
        set((state) => {
          if (!state.map) return state;
          return {
            map: {
              ...state.map,
              tokens: state.map.tokens.filter((t) => t.id !== id),
              updatedAt: new Date().toISOString(),
            },
          };
        }),

      moveToken: (id, position) =>
        set((state) => {
          if (!state.map) return state;
          return {
            map: {
              ...state.map,
              tokens: state.map.tokens.map((t) =>
                t.id === id ? { ...t, position } : t
              ),
              updatedAt: new Date().toISOString(),
            },
          };
        }),

      flipToken: (id) =>
        set((state) => {
          if (!state.map) return state;
          return {
            map: {
              ...state.map,
              tokens: state.map.tokens.map((t) =>
                t.id === id ? { ...t, flipped: !t.flipped } : t
              ),
              updatedAt: new Date().toISOString(),
            },
          };
        }),

      reorderTokens: (fromIndex, toIndex) =>
        set((state) => {
          if (!state.map) return state;
          const tokens = [...state.map.tokens];
          const [removed] = tokens.splice(fromIndex, 1);
          tokens.splice(toIndex, 0, removed);
          return {
            map: {
              ...state.map,
              tokens,
              updatedAt: new Date().toISOString(),
            },
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
    }),
    { limit: 50 }
  )
);
