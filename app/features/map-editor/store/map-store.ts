import { create } from "zustand";
import { temporal } from "zundo";
import type { DnDMap, Token, GridPosition, GridSettings, Background, FreehandPath, RollResult, FogCell, CharacterSheet, MonsterGroup, InitiativeEntry } from "../types";
import { createNewMap } from "../constants";
import { createDefaultCharacterSheet } from "../utils/character-utils";
import { normalizeGridRange } from "../utils/grid-utils";

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
  addTokenFromSync: (token: Token) => void;
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
  eraseFogCell: (col: number, row: number, eraserId: string, isDM: boolean) => void;
  paintFogInRange: (startCol: number, startRow: number, endCol: number, endRow: number, creatorId: string) => void;
  eraseFogInRange: (startCol: number, startRow: number, endCol: number, endRow: number, eraserId: string, isDM: boolean) => void;
  clearAllFog: () => void;

  // Drawing actions
  addFreehandPath: (path: FreehandPath) => void;
  removeFreehandPath: (id: string) => void;
  clearAllDrawings: () => void;

  // Roll history actions
  addRollResult: (result: RollResult) => void;
  clearRollHistory: () => void;

  // Character sheet actions
  updateCharacterSheet: (tokenId: string, updates: Partial<CharacterSheet>) => void;
  initializeCharacterSheet: (tokenId: string) => void;
  removeCharacterSheet: (tokenId: string) => void;

  // Monster group actions
  createMonsterGroup: (name: string, tokenIds: string[]) => string;
  addToMonsterGroup: (groupId: string, tokenId: string) => void;
  removeFromMonsterGroup: (tokenId: string) => void;
  deleteMonsterGroup: (groupId: string) => void;

  // Combat actions
  startCombat: (initiativeOrder: InitiativeEntry[]) => void;
  endCombat: () => void;
  setCombatTurnIndex: (index: number) => void;

  // Token duplication
  duplicateToken: (tokenId: string, options?: { sameGroup?: boolean }) => Token | null;
}

export const useMapStore = create<MapState>()(
  temporal(
    (set, get) => ({
      map: null,
      dirtyTokens: new Set<string>(),
      dirtyTimestamps: new Map<string, number>(),

      loadMap: (map) => set({
        map: {
          ...map,
          // Ensure new fields have defaults for older maps
          monsterGroups: map.monsterGroups || [],
          combat: map.combat ?? null,
          tokens: map.tokens.map((t) => ({
            ...t,
            monsterGroupId: t.monsterGroupId ?? null,
          })),
        },
        dirtyTokens: new Set(),
        dirtyTimestamps: new Map()
      }),

      // Sync map data from server while preserving local dirty tokens and viewport
      syncMap: (serverMap) =>
        set((state) => {
          // Ensure monsterGroups and combat exist for backward compatibility
          const normalizedServerMap = {
            ...serverMap,
            monsterGroups: serverMap.monsterGroups || [],
            combat: serverMap.combat ?? null,
            tokens: serverMap.tokens.map((t) => ({
              ...t,
              monsterGroupId: t.monsterGroupId ?? null,
            })),
          };

          if (!state.map) return { map: normalizedServerMap };

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
          const mergedTokens = normalizedServerMap.tokens.map((serverToken) => {
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
          const serverTokenIds = new Set(normalizedServerMap.tokens.map((t) => t.id));
          const localOnlyDirtyTokens = state.map.tokens.filter(
            (t) => activeDirtyTokens.has(t.id) && !serverTokenIds.has(t.id)
          );

          return {
            map: {
              ...normalizedServerMap,
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

      // Add token from sync (WebSocket) without marking as dirty
      addTokenFromSync: (token) =>
        set((state) => {
          if (!state.map) return state;
          // Check if token already exists to avoid duplicates
          if (state.map.tokens.some((t) => t.id === token.id)) {
            return state;
          }
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

      eraseFogCell: (col, row, eraserId, isDM) =>
        set((state) => {
          if (!state.map) return state;
          const key = `${col},${row}`;
          const paintedCells = state.map.fogOfWar.paintedCells || [];

          // Filter cells - DM can erase anything, players can only erase their own fog
          const filteredCells = paintedCells.filter((c) => {
            if (c.key !== key) return true; // Keep cells that don't match
            // For the matching cell, check permissions
            if (isDM) return false; // DM can erase any cell
            return c.creatorId !== eraserId; // Players can only erase their own cells
          });

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

      paintFogInRange: (startCol, startRow, endCol, endRow, creatorId) =>
        set((state) => {
          if (!state.map) return state;
          const paintedCells = state.map.fogOfWar.paintedCells || [];
          const existingKeys = new Set(paintedCells.map((c) => c.key));
          const newCells: FogCell[] = [];

          const { minCol, maxCol, minRow, maxRow } = normalizeGridRange(startCol, startRow, endCol, endRow);

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

      eraseFogInRange: (startCol, startRow, endCol, endRow, eraserId, isDM) =>
        set((state) => {
          if (!state.map) return state;
          const paintedCells = state.map.fogOfWar.paintedCells || [];

          const { minCol, maxCol, minRow, maxRow } = normalizeGridRange(startCol, startRow, endCol, endRow);

          const keysToRemove = new Set<string>();
          for (let col = minCol; col <= maxCol; col++) {
            for (let row = minRow; row <= maxRow; row++) {
              keysToRemove.add(`${col},${row}`);
            }
          }

          // Filter cells - DM can erase anything, players can only erase their own fog
          const filteredCells = paintedCells.filter((c) => {
            if (!keysToRemove.has(c.key)) return true; // Keep cells outside the range
            // For cells in range, check permissions
            if (isDM) return false; // DM can erase any cell
            return c.creatorId !== eraserId; // Players can only erase their own cells
          });

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

      // Character sheet actions
      updateCharacterSheet: (tokenId, updates) =>
        set((state) => {
          if (!state.map) return state;
          const token = state.map.tokens.find((t) => t.id === tokenId);
          if (!token) return state;

          const newDirtyTokens = new Set(state.dirtyTokens).add(tokenId);
          const newDirtyTimestamps = new Map(state.dirtyTimestamps).set(tokenId, Date.now());

          // If token has no characterSheet, initialize with defaults before applying updates
          const baseSheet = token.characterSheet ?? createDefaultCharacterSheet();

          // Fields that stay individual per monster in a group
          const individualFields = new Set<string>(['hpCurrent', 'deathSaves', 'condition']);

          // Build shared updates (everything except individual fields)
          const sharedUpdates: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(updates)) {
            if (!individualFields.has(key)) {
              sharedUpdates[key] = value;
            }
          }

          // Find sibling tokens in the same monster group
          const groupId = token.monsterGroupId;
          const hasSiblings = groupId && Object.keys(sharedUpdates).length > 0;

          // Mark siblings as dirty too
          if (hasSiblings) {
            for (const t of state.map.tokens) {
              if (t.id !== tokenId && t.monsterGroupId === groupId) {
                newDirtyTokens.add(t.id);
                newDirtyTimestamps.set(t.id, Date.now());
              }
            }
          }

          return {
            map: {
              ...state.map,
              tokens: state.map.tokens.map((t) => {
                if (t.id === tokenId) {
                  return { ...t, characterSheet: { ...baseSheet, ...updates } };
                }
                // Propagate shared fields to siblings in the same monster group
                if (hasSiblings && t.monsterGroupId === groupId) {
                  const siblingBase = t.characterSheet ?? createDefaultCharacterSheet();
                  return { ...t, characterSheet: { ...siblingBase, ...sharedUpdates } };
                }
                return t;
              }),
              updatedAt: new Date().toISOString(),
            },
            dirtyTokens: newDirtyTokens,
            dirtyTimestamps: newDirtyTimestamps,
          };
        }),

      initializeCharacterSheet: (tokenId) =>
        set((state) => {
          if (!state.map) return state;
          const token = state.map.tokens.find((t) => t.id === tokenId);
          if (!token) return state;

          const newDirtyTokens = new Set(state.dirtyTokens).add(tokenId);
          const newDirtyTimestamps = new Map(state.dirtyTimestamps).set(tokenId, Date.now());

          return {
            map: {
              ...state.map,
              tokens: state.map.tokens.map((t) =>
                t.id === tokenId
                  ? { ...t, characterSheet: createDefaultCharacterSheet() }
                  : t
              ),
              updatedAt: new Date().toISOString(),
            },
            dirtyTokens: newDirtyTokens,
            dirtyTimestamps: newDirtyTimestamps,
          };
        }),

      removeCharacterSheet: (tokenId) =>
        set((state) => {
          if (!state.map) return state;
          const newDirtyTokens = new Set(state.dirtyTokens).add(tokenId);
          const newDirtyTimestamps = new Map(state.dirtyTimestamps).set(tokenId, Date.now());

          return {
            map: {
              ...state.map,
              tokens: state.map.tokens.map((t) =>
                t.id === tokenId ? { ...t, characterSheet: null } : t
              ),
              updatedAt: new Date().toISOString(),
            },
            dirtyTokens: newDirtyTokens,
            dirtyTimestamps: newDirtyTimestamps,
          };
        }),

      // Monster group actions
      createMonsterGroup: (name, tokenIds) => {
        const groupId = crypto.randomUUID();
        set((state) => {
          if (!state.map) return state;
          const newGroup: MonsterGroup = { id: groupId, name };
          const newDirtyTokens = new Set(state.dirtyTokens);
          const newDirtyTimestamps = new Map(state.dirtyTimestamps);

          // Mark all affected tokens as dirty
          tokenIds.forEach((id) => {
            newDirtyTokens.add(id);
            newDirtyTimestamps.set(id, Date.now());
          });

          return {
            map: {
              ...state.map,
              monsterGroups: [...(state.map.monsterGroups || []), newGroup],
              tokens: state.map.tokens.map((t) =>
                tokenIds.includes(t.id) ? { ...t, monsterGroupId: groupId } : t
              ),
              updatedAt: new Date().toISOString(),
            },
            dirtyTokens: newDirtyTokens,
            dirtyTimestamps: newDirtyTimestamps,
          };
        });
        return groupId;
      },

      addToMonsterGroup: (groupId, tokenId) =>
        set((state) => {
          if (!state.map) return state;
          const newDirtyTokens = new Set(state.dirtyTokens).add(tokenId);
          const newDirtyTimestamps = new Map(state.dirtyTimestamps).set(tokenId, Date.now());

          return {
            map: {
              ...state.map,
              tokens: state.map.tokens.map((t) =>
                t.id === tokenId ? { ...t, monsterGroupId: groupId } : t
              ),
              updatedAt: new Date().toISOString(),
            },
            dirtyTokens: newDirtyTokens,
            dirtyTimestamps: newDirtyTimestamps,
          };
        }),

      removeFromMonsterGroup: (tokenId) =>
        set((state) => {
          if (!state.map) return state;
          const newDirtyTokens = new Set(state.dirtyTokens).add(tokenId);
          const newDirtyTimestamps = new Map(state.dirtyTimestamps).set(tokenId, Date.now());

          return {
            map: {
              ...state.map,
              tokens: state.map.tokens.map((t) =>
                t.id === tokenId ? { ...t, monsterGroupId: null } : t
              ),
              updatedAt: new Date().toISOString(),
            },
            dirtyTokens: newDirtyTokens,
            dirtyTimestamps: newDirtyTimestamps,
          };
        }),

      deleteMonsterGroup: (groupId) =>
        set((state) => {
          if (!state.map) return state;
          const newDirtyTokens = new Set(state.dirtyTokens);
          const newDirtyTimestamps = new Map(state.dirtyTimestamps);

          // Mark all tokens in this group as dirty
          state.map.tokens.forEach((t) => {
            if (t.monsterGroupId === groupId) {
              newDirtyTokens.add(t.id);
              newDirtyTimestamps.set(t.id, Date.now());
            }
          });

          return {
            map: {
              ...state.map,
              monsterGroups: (state.map.monsterGroups || []).filter((g) => g.id !== groupId),
              tokens: state.map.tokens.map((t) =>
                t.monsterGroupId === groupId ? { ...t, monsterGroupId: null } : t
              ),
              updatedAt: new Date().toISOString(),
            },
            dirtyTokens: newDirtyTokens,
            dirtyTimestamps: newDirtyTimestamps,
          };
        }),

      // Combat actions
      startCombat: (initiativeOrder) =>
        set((state) => {
          if (!state.map) return state;
          return {
            map: {
              ...state.map,
              combat: {
                isInCombat: true,
                initiativeOrder,
                currentTurnIndex: 0,
              },
              updatedAt: new Date().toISOString(),
            },
          };
        }),

      endCombat: () =>
        set((state) => {
          if (!state.map) return state;
          return {
            map: {
              ...state.map,
              combat: null,
              updatedAt: new Date().toISOString(),
            },
          };
        }),

      setCombatTurnIndex: (index) =>
        set((state) => {
          if (!state.map || !state.map.combat) return state;
          return {
            map: {
              ...state.map,
              combat: {
                ...state.map.combat,
                currentTurnIndex: index,
              },
              updatedAt: new Date().toISOString(),
            },
          };
        }),

      // Token duplication
      duplicateToken: (tokenId, options = {}) => {
        const state = get();
        if (!state.map) return null;

        const sourceToken = state.map.tokens.find((t) => t.id === tokenId);
        if (!sourceToken) return null;

        // Extract base name and number for incrementing
        const nameMatch = sourceToken.name.match(/^(.+?)\s*(\d+)?$/);
        const baseName = nameMatch ? nameMatch[1].trim() : sourceToken.name;

        // Find the highest number used for this base name
        let maxNumber = 0;
        state.map.tokens.forEach((t) => {
          const match = t.name.match(new RegExp(`^${baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*(\\d+)?$`));
          if (match) {
            const num = match[1] ? parseInt(match[1], 10) : 1;
            if (num > maxNumber) maxNumber = num;
          }
        });

        // When duplicating into the same group, reset individual combat state
        const duplicatedSheet = sourceToken.characterSheet
          ? options.sameGroup
            ? {
                ...sourceToken.characterSheet,
                hpCurrent: sourceToken.characterSheet.hpMax,
                deathSaves: {
                  successes: [false, false, false] as [boolean, boolean, boolean],
                  failures: [false, false, false] as [boolean, boolean, boolean],
                },
                condition: "Healthy" as const,
              }
            : { ...sourceToken.characterSheet }
          : sourceToken.characterSheet;

        const newToken: Token = {
          ...sourceToken,
          id: crypto.randomUUID(),
          name: `${baseName} ${maxNumber + 1}`,
          position: {
            col: sourceToken.position.col + 1,
            row: sourceToken.position.row,
          },
          // Keep same group if sameGroup option is true, otherwise no group
          monsterGroupId: options.sameGroup ? sourceToken.monsterGroupId : null,
          // Don't copy character link - duplicates should be independent
          characterId: null,
          // Use reset character sheet for group duplicates
          characterSheet: duplicatedSheet,
        };

        set((prevState) => {
          if (!prevState.map) return prevState;
          const newDirtyTokens = new Set(prevState.dirtyTokens).add(newToken.id);
          const newDirtyTimestamps = new Map(prevState.dirtyTimestamps).set(newToken.id, Date.now());

          return {
            map: {
              ...prevState.map,
              tokens: [...prevState.map.tokens, newToken],
              updatedAt: new Date().toISOString(),
            },
            dirtyTokens: newDirtyTokens,
            dirtyTimestamps: newDirtyTimestamps,
          };
        });

        return newToken;
      },
    }),
    { limit: 50 }
  )
);
