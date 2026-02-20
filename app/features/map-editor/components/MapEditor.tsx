import { useEffect, lazy, Suspense, useState, useCallback, useRef, useMemo } from "react";
import { Toolbar } from "./Toolbar/Toolbar";
import { Sidebar } from "./Sidebar/Sidebar";
import { ChatPanel } from "./ChatPanel";
import { TokenEditDialog } from "./TokenEditDialog";
import { CharacterSheetPanel } from "./CharacterSheet";
import { InitiativeSetupModal } from "./InitiativeSetupModal";
import { MobileSidebarRail } from "./Mobile";
import { useMapStore, useEditorStore, useChatStore } from "../store";
import { useMapSync, useIsMobile } from "../hooks";
import { usePartySync } from "../hooks/usePartySync";
import { useChatPersistence } from "../hooks/useChatPersistence";
import type { ChatMessageData } from "../store/chat-store";
import { buildFogSet, isTokenUnderFog } from "../utils/fog-utils";
import { filterMessagesForAI } from "../utils/ai-context-utils";
import { VALID_CONDITIONS } from "../types";
import type { Token, PlayerPermissions, GridPosition, Ping, CharacterSheet, Condition, WallSegment, AreaShape, MonsterGroup } from "../types";
import type { AccountTier, TierLimits } from "~/lib/tier-limits";
import { getTierLimits } from "~/lib/tier-limits";

const AUTO_SAVE_DELAY = 2000; // 2 seconds debounce

const MapCanvas = lazy(() =>
  import("./Canvas/MapCanvas").then((mod) => ({ default: mod.MapCanvas }))
);

interface GroupMemberInfo {
  id: string;
  name: string;
}

interface MapEditorProps {
  mapId?: string;
  permission?: "dm" | "player";
  customPermissions?: PlayerPermissions | null;
  userId?: string | null;
  userName?: string | null;
  groupMembers?: GroupMemberInfo[];
  groupId?: string | null;
  mapOwnerId?: string | null;
  accountTier?: AccountTier;
  tierLimits?: TierLimits;
  realtimeSyncEnabled?: boolean;
}

export function MapEditor({
  mapId,
  permission = "dm",
  customPermissions = null,
  userId = null,
  userName = null,
  groupMembers = [],
  groupId = null,
  mapOwnerId = null,
  accountTier = "free",
  tierLimits: tierLimitsProp,
  realtimeSyncEnabled: realtimeSyncProp,
}: MapEditorProps) {
  const tierLimits = tierLimitsProp ?? getTierLimits(accountTier);
  const realtimeSyncEnabled = realtimeSyncProp ?? tierLimits.realtimeSync;
  const isMobile = useIsMobile();
  const map = useMapStore((s) => s.map);
  const newMap = useMapStore((s) => s.newMap);
  const updateToken = useMapStore((s) => s.updateToken);
  const removeToken = useMapStore((s) => s.removeToken);
  const duplicateToken = useMapStore((s) => s.duplicateToken);
  const moveToken = useMapStore((s) => s.moveToken);
  const updateCharacterSheet = useMapStore((s) => s.updateCharacterSheet);
  const initializeCharacterSheet = useMapStore((s) => s.initializeCharacterSheet);
  const setViewport = useMapStore((s) => s.setViewport);
  const setEditorContext = useEditorStore((s) => s.setEditorContext);
  const openCharacterSheetTokenId = useEditorStore((s) => s.openCharacterSheetTokenId);
  const closeCharacterSheet = useEditorStore((s) => s.closeCharacterSheet);
  const canMoveToken = useEditorStore((s) => s.canMoveToken);
  const canEditToken = useEditorStore((s) => s.canEditToken);
  const isDungeonMaster = useEditorStore((s) => s.isDungeonMaster);
  const isTokenOwner = useEditorStore((s) => s.isTokenOwner);
  const setSelectedElements = useEditorStore((s) => s.setSelectedElements);
  const getCanvasDimensions = useEditorStore((s) => s.getCanvasDimensions);
  // Combat state from map store
  const combat = useMapStore((s) => s.map?.combat ?? null);
  const setCombatTurnIndex = useMapStore((s) => s.setCombatTurnIndex);
  const isInCombat = combat?.isInCombat ?? false;
  const initiativeOrder = combat?.initiativeOrder ?? null;
  const currentTurnIndex = combat?.currentTurnIndex ?? 0;

  // Wall/area store actions for property editing
  const updateWall = useMapStore((s) => s.updateWall);
  const updateArea = useMapStore((s) => s.updateArea);
  const removeWallFromStore = useMapStore((s) => s.removeWall);
  const removeAreaFromStore = useMapStore((s) => s.removeArea);

  // Selected wall/area IDs (kept in sync with MapCanvas via selectedElementIds)
  const selectedElementIds = useEditorStore((s) => s.selectedElementIds);
  const selectedWallId = selectedElementIds.length === 1 && selectedElementIds[0].startsWith("wall:")
    ? selectedElementIds[0].slice(5)
    : null;
  const selectedAreaId = selectedElementIds.length === 1 && selectedElementIds[0].startsWith("area:")
    ? selectedElementIds[0].slice(5)
    : null;

  // HTTP sync for persistence to database
  const { syncNow, syncDebounced, syncTokenMove, syncTokenDelete, syncTokenUpdate, syncTokenCreate } = useMapSync(mapId);

  // WebSocket sync for real-time updates to other clients
  const {
    broadcastTokenMove,
    broadcastTokenUpdate,
    broadcastTokenDelete,
    broadcastTokenCreate,
    broadcastMapSync,
    broadcastFogPaint,
    broadcastFogErase,
    broadcastFogPaintRange,
    broadcastFogEraseRange,
    broadcastPing,
    broadcastTokenStats,
    broadcastDrawingAdd,
    broadcastDrawingRemove,
    broadcastDmTransfer,
    broadcastCombatRequest,
    broadcastCombatResponse,
    broadcastCombatEnd,
    broadcastChatMessage,
    broadcastChatClear,
    broadcastWallAdd,
    broadcastWallRemove,
    broadcastAreaAdd,
    broadcastAreaRemove,
    clearCombatRequest,
    activePings,
    combatRequest,
  } = usePartySync({
    mapId,
    userId,
    userName,
    enabled: !!mapId && !!userId && realtimeSyncEnabled,
  });

  useChatPersistence(mapId);

  // Scene actions
  const switchScene = useMapStore((s) => s.switchScene);
  const createScene = useMapStore((s) => s.createScene);
  const duplicateScene = useMapStore((s) => s.duplicateScene);
  const deleteScene = useMapStore((s) => s.deleteScene);
  const renameScene = useMapStore((s) => s.renameScene);

  // Scene switch confirmation dialog state
  const [pendingSceneSwitch, setPendingSceneSwitch] = useState<string | null>(null);

  // AI Battle Engine toggle state
  const [aiBattleEngine, setAiBattleEngine] = useState(false);

  // AI DM prompt state (shared between ChatPanel and CombatPanel)
  const [aiLoading, setAiLoading] = useState(false);
  const aiCooldownRef = useRef<number | null>(null);

  const sendAiPrompt = useCallback((aiPrompt: string, silent = false) => {
    if (!isDungeonMaster()) {
      const errMsg: ChatMessageData = {
        id: crypto.randomUUID(),
        mapId: mapId || "",
        userId: userId || "",
        userName: "System",
        message: "Only the Dungeon Master can use /ai.",
        role: "dm",
        createdAt: new Date().toISOString(),
        metadata: null,
        recipientId: userId || "",
        recipientName: userName || "",
      };
      useChatStore.getState().addMessage(errMsg);
      return;
    }

    const combat = useMapStore.getState().map?.combat;
    if (!combat?.isInCombat) {
      const errMsg: ChatMessageData = {
        id: crypto.randomUUID(),
        mapId: mapId || "",
        userId: userId || "",
        userName: "System",
        message: "Combat must be active to use the AI DM.",
        role: "dm",
        createdAt: new Date().toISOString(),
        metadata: null,
        recipientId: userId || "",
        recipientName: userName || "",
      };
      useChatStore.getState().addMessage(errMsg);
      return;
    }

    if (aiPrompt.length > 500) {
      const errMsg: ChatMessageData = {
        id: crypto.randomUUID(),
        mapId: mapId || "",
        userId: userId || "",
        userName: "System",
        message: "AI prompt too long (max 500 characters).",
        role: "dm",
        createdAt: new Date().toISOString(),
        metadata: null,
        recipientId: userId || "",
        recipientName: userName || "",
      };
      useChatStore.getState().addMessage(errMsg);
      return;
    }

    // Cooldown check (5 seconds)
    const now = Date.now();
    if (aiCooldownRef.current && now - aiCooldownRef.current < 5000) {
      const errMsg: ChatMessageData = {
        id: crypto.randomUUID(),
        mapId: mapId || "",
        userId: userId || "",
        userName: "System",
        message: "Please wait a few seconds before using /ai again.",
        role: "dm",
        createdAt: new Date().toISOString(),
        metadata: null,
        recipientId: userId || "",
        recipientName: userName || "",
      };
      useChatStore.getState().addMessage(errMsg);
      return;
    }

    setAiLoading(true);
    aiCooldownRef.current = now;

    // Show the prompt in chat so all players can see what was asked (skip for automatic prompts)
    if (!silent) {
      const promptMsg: ChatMessageData = {
        id: crypto.randomUUID(),
        mapId: mapId || "",
        userId: userId || "",
        userName: userName || "DM",
        message: `/ai ${aiPrompt}`,
        role: "dm",
        createdAt: new Date().toISOString(),
        metadata: null,
        recipientId: null,
        recipientName: null,
      };
      broadcastChatMessage(promptMsg);
    }

    // Collect combat context — filter stale dice rolls from previous turns
    const mapState = useMapStore.getState().map!;
    const allRecent = useChatStore
      .getState()
      .messages.filter((m) => !m.recipientId)
      .slice(-15);
    const recentMessages = filterMessagesForAI(allRecent, mapState.combat?.turnStartedAt);

    const combatContext = {
      combat: mapState.combat!,
      tokens: mapState.tokens,
      grid: mapState.grid,
      monsterGroups: mapState.monsterGroups,
      recentMessages,
      walls: mapState.walls,
      areas: mapState.areas,
    };

    fetch(`/api/maps/${mapId}/ai`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: aiPrompt, combatContext }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          const errMsg: ChatMessageData = {
            id: crypto.randomUUID(),
            mapId: mapId || "",
            userId: userId || "",
            userName: "System",
            message: data.error,
            role: "dm",
            createdAt: new Date().toISOString(),
            metadata: null,
            recipientId: userId || "",
            recipientName: userName || "",
          };
          useChatStore.getState().addMessage(errMsg);
        } else {
          const aiMsg: ChatMessageData = {
            id: crypto.randomUUID(),
            mapId: mapId || "",
            userId: userId || "",
            userName: userName || "DM",
            message: data.response,
            role: "dm",
            createdAt: new Date().toISOString(),
            metadata: { aiResponse: true },
            recipientId: null,
            recipientName: null,
          };
          broadcastChatMessage(aiMsg);

          // Apply HP/condition updates from AI
          const updates = data.updates as { tokenName: string; hpCurrent?: number; condition?: string; moveTo?: { col: number; row: number } }[] | undefined;
          const nameToId = data.displayNameToTokenId as Record<string, string> | undefined;
          if (updates && updates.length > 0) {
            const currentMap = useMapStore.getState().map;
            if (currentMap) {
              for (const u of updates) {
                // Resolve token: first try the display-name→ID mapping, then fall back to name match
                const resolvedId = nameToId?.[u.tokenName];
                const token = resolvedId
                  ? currentMap.tokens.find((t) => t.id === resolvedId)
                  : currentMap.tokens.find((t) => t.name === u.tokenName);
                if (!token) continue;

                // Apply HP/condition changes (requires character sheet)
                if (token.characterSheet) {
                  const cs = token.characterSheet;
                  const sheetUpdates: Partial<CharacterSheet> = {};
                  // Only apply HP if it actually changed (guards against AI re-applying old damage)
                  if (u.hpCurrent !== undefined) {
                    const clamped = Math.max(0, Math.min(u.hpCurrent, cs.hpMax));
                    if (clamped !== cs.hpCurrent) sheetUpdates.hpCurrent = clamped;
                  }
                  if (u.condition !== undefined && VALID_CONDITIONS.includes(u.condition as Condition) && u.condition !== cs.condition) {
                    sheetUpdates.condition = u.condition as Condition;
                  }
                  if (Object.keys(sheetUpdates).length > 0) {
                    updateCharacterSheet(token.id, sheetUpdates);

                    // Broadcast stats change to other clients
                    const stats: Record<string, number | string> = {};
                    if (sheetUpdates.hpCurrent !== undefined) stats.hpCurrent = sheetUpdates.hpCurrent;
                    if (sheetUpdates.condition !== undefined) stats.condition = sheetUpdates.condition;
                    broadcastTokenStats(token.id, stats);

                    // Sync to character library for linked characters
                    if (token.characterId) {
                      const updatedSheet = { ...cs, ...sheetUpdates };
                      fetch(`/api/characters/${token.characterId}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ characterSheet: updatedSheet }),
                      }).catch(() => { /* silent — map sync is primary, library sync is best-effort */ });
                    }
                  }
                }

                // Apply movement (monsters/NPCs only, never player characters)
                if (u.moveTo && token.layer !== "character") {
                  const grid = currentMap.grid;
                  const col = Math.round(u.moveTo.col);
                  const row = Math.round(u.moveTo.row);
                  const clampedCol = Math.max(0, Math.min(col, grid.width - token.size));
                  const clampedRow = Math.max(0, Math.min(row, grid.height - token.size));
                  if (clampedCol !== token.position.col || clampedRow !== token.position.row) {
                    const newPosition: GridPosition = { col: clampedCol, row: clampedRow };
                    // Animate on own client before store update
                    useEditorStore.getState().addPendingAnimation(token.id, token.position.col, token.position.row);
                    moveToken(token.id, newPosition);
                    broadcastTokenMove(token.id, newPosition);
                  }
                }
              }
              syncDebounced(1000);
            }
          }
        }
      })
      .catch(() => {
        const errMsg: ChatMessageData = {
          id: crypto.randomUUID(),
          mapId: mapId || "",
          userId: userId || "",
          userName: "System",
          message: "Failed to reach the AI DM. Please try again.",
          role: "dm",
          createdAt: new Date().toISOString(),
          metadata: null,
          recipientId: userId || "",
          recipientName: userName || "",
        };
        useChatStore.getState().addMessage(errMsg);
      })
      .finally(() => {
        setAiLoading(false);
      });
  }, [mapId, userId, userName, isDungeonMaster, broadcastChatMessage, updateCharacterSheet, broadcastTokenStats, moveToken, broadcastTokenMove, syncDebounced]);

  // Combined handler: broadcast via WebSocket + persist to DB
  const handleTokenMoved = useCallback(
    (tokenId: string, position: GridPosition) => {
      // 1. Broadcast instantly to other clients via WebSocket
      broadcastTokenMove(tokenId, position);
      // 2. Persist to database
      syncTokenMove(tokenId, position);
    },
    [broadcastTokenMove, syncTokenMove]
  );

  // Combined handler for token deletion
  const handleTokenDelete = useCallback(
    (tokenId: string) => {
      broadcastTokenDelete(tokenId);
      syncTokenDelete(tokenId);
    },
    [broadcastTokenDelete, syncTokenDelete]
  );

  // Combined handler for token updates
  const handleTokenUpdate = useCallback(
    (tokenId: string, updates: Record<string, unknown>) => {
      broadcastTokenUpdate(tokenId, updates as Partial<Token>);
      syncTokenUpdate(tokenId, updates);
    },
    [broadcastTokenUpdate, syncTokenUpdate]
  );

  // Combined handler for token creation
  const handleTokenCreate = useCallback(
    (token: Token) => {
      broadcastTokenCreate(token);
      syncTokenCreate(token);
    },
    [broadcastTokenCreate, syncTokenCreate]
  );

  // Sync after token flip with 500ms debounce + broadcast
  const handleTokenFlip = useCallback(
    (tokenId: string) => {
      const token = map?.tokens.find((t) => t.id === tokenId);
      if (token) {
        broadcastTokenUpdate(tokenId, { flipped: !token.flipped });
      }
      syncDebounced(500);
    },
    [map?.tokens, broadcastTokenUpdate, syncDebounced]
  );

  // Combined handler for fog painting: broadcast + debounced sync
  const handleFogPaint = useCallback(
    (col: number, row: number, creatorId: string) => {
      broadcastFogPaint(col, row, creatorId);
      syncDebounced(1000); // Debounce fog syncs to reduce DB writes
    },
    [broadcastFogPaint, syncDebounced]
  );

  // Combined handler for fog erasing: broadcast + debounced sync
  const handleFogErase = useCallback(
    (col: number, row: number) => {
      broadcastFogErase(col, row, isDungeonMaster());
      syncDebounced(1000);
    },
    [broadcastFogErase, isDungeonMaster, syncDebounced]
  );

  // Combined handler for fog painting in range: broadcast + debounced sync
  const handleFogPaintRange = useCallback(
    (startCol: number, startRow: number, endCol: number, endRow: number, creatorId: string) => {
      broadcastFogPaintRange(startCol, startRow, endCol, endRow, creatorId);
      syncDebounced(1000);
    },
    [broadcastFogPaintRange, syncDebounced]
  );

  // Combined handler for fog erasing in range: broadcast + debounced sync
  const handleFogEraseRange = useCallback(
    (startCol: number, startRow: number, endCol: number, endRow: number) => {
      broadcastFogEraseRange(startCol, startRow, endCol, endRow, isDungeonMaster());
      syncDebounced(1000);
    },
    [broadcastFogEraseRange, isDungeonMaster, syncDebounced]
  );

  // Combined handler for wall add: broadcast + debounced sync
  const handleWallAdd = useCallback(
    (wall: WallSegment) => {
      broadcastWallAdd(wall);
      syncDebounced(1000);
    },
    [broadcastWallAdd, syncDebounced]
  );

  // Combined handler for wall remove: broadcast + debounced sync
  const handleWallRemove = useCallback(
    (wallId: string) => {
      broadcastWallRemove(wallId);
      syncDebounced(1000);
    },
    [broadcastWallRemove, syncDebounced]
  );

  // Combined handler for area add: broadcast + debounced sync
  const handleAreaAdd = useCallback(
    (area: AreaShape) => {
      broadcastAreaAdd(area);
      syncDebounced(1000);
    },
    [broadcastAreaAdd, syncDebounced]
  );

  // Combined handler for area remove: broadcast + debounced sync
  const handleAreaRemove = useCallback(
    (areaId: string) => {
      broadcastAreaRemove(areaId);
      syncDebounced(1000);
    },
    [broadcastAreaRemove, syncDebounced]
  );

  // Handlers for wall/area property edits from sidebar panel
  const handleUpdateWall = useCallback(
    (id: string, updates: Partial<WallSegment>) => {
      updateWall(id, updates);
      syncDebounced(1000);
    },
    [updateWall, syncDebounced]
  );

  const handleDeleteWall = useCallback(
    (id: string) => {
      removeWallFromStore(id);
      broadcastWallRemove(id);
      syncDebounced(1000);
    },
    [removeWallFromStore, broadcastWallRemove, syncDebounced]
  );

  const handleUpdateArea = useCallback(
    (id: string, updates: Partial<AreaShape>) => {
      updateArea(id, updates);
      syncDebounced(1000);
    },
    [updateArea, syncDebounced]
  );

  const handleDeleteArea = useCallback(
    (id: string) => {
      removeAreaFromStore(id);
      broadcastAreaRemove(id);
      syncDebounced(1000);
    },
    [removeAreaFromStore, broadcastAreaRemove, syncDebounced]
  );

  // Handler for selecting and centering on a token
  const handleSelectAndCenter = useCallback(
    (token: Token) => {
      if (!map) return;

      // Select the token
      setSelectedElements([token.id]);

      // Calculate token center in pixels
      const cellSize = map.grid.cellSize;
      const tokenCenterX = (token.position.col + token.size / 2) * cellSize;
      const tokenCenterY = (token.position.row + token.size / 2) * cellSize;

      // Get canvas dimensions
      const { width, height } = getCanvasDimensions();
      const scale = map.viewport.scale;

      // Calculate viewport position to center the token
      const viewportX = width / 2 - tokenCenterX * scale;
      const viewportY = height / 2 - tokenCenterY * scale;

      setViewport(viewportX, viewportY, scale);
    },
    [map, setSelectedElements, getCanvasDimensions, setViewport]
  );

  const fogSet = useMemo(() => buildFogSet(map?.fogOfWar?.paintedCells || []), [map?.fogOfWar?.paintedCells]);

  // State for initiative setup modal
  type DraftInitiativeEntry = {
    tokenId: string;
    tokenName: string;
    tokenColor: string;
    initiative: number;
    initMod: number;
    roll: number;
    layer: string;
    groupId: string | null;
    groupCount: number;
    groupTokenIds: string[];
  };
  const [showInitiativeSetup, setShowInitiativeSetup] = useState(false);
  const [draftInitiativeEntries, setDraftInitiativeEntries] = useState<DraftInitiativeEntry[]>([]);

  // Helper to prepare initiative entries for the setup modal
  const prepareInitiativeEntries = useCallback((): DraftInitiativeEntry[] => {
    if (!map) return [];

    // Get visible tokens that are not under fog and not objects
    const eligibleTokens = map.tokens.filter((token) => {
      if (!token.visible) return false;
      if (isTokenUnderFog(token, fogSet)) return false;
      if (token.layer === "object") return false;
      return true;
    });

    // Separate characters and monsters
    const characters = eligibleTokens.filter((t) => t.layer === "character");
    const monsters = eligibleTokens.filter((t) => t.layer === "monster");

    // Group monsters by monsterGroupId
    const monstersByGroup = new Map<string | null, typeof monsters>();
    monsters.forEach((monster) => {
      const groupId = monster.monsterGroupId;
      if (!monstersByGroup.has(groupId)) {
        monstersByGroup.set(groupId, []);
      }
      monstersByGroup.get(groupId)!.push(monster);
    });

    const initiativeRolls: DraftInitiativeEntry[] = [];

    // Roll initiative for each character individually
    characters.forEach((token) => {
      const initMod = token.characterSheet?.initiative ?? 0;
      const roll = Math.floor(Math.random() * 20) + 1;
      const initiative = roll + initMod;
      initiativeRolls.push({
        tokenId: token.id,
        tokenName: token.name,
        tokenColor: token.color,
        initiative,
        initMod,
        roll,
        layer: token.layer,
        groupId: null,
        groupCount: 1,
        groupTokenIds: [token.id],
      });
    });

    // Roll initiative for each monster group (shared roll)
    monstersByGroup.forEach((groupMonsters, groupId) => {
      if (groupMonsters.length === 0) return;

      const firstMonster = groupMonsters[0];
      const initMod = firstMonster.characterSheet?.initiative ?? 0;
      const roll = Math.floor(Math.random() * 20) + 1;
      const initiative = roll + initMod;

      const group = groupId ? map.monsterGroups?.find((g) => g.id === groupId) : null;
      const displayName = group
        ? `${group.name} (${groupMonsters.length})`
        : groupMonsters.length > 1
          ? `${firstMonster.name} x${groupMonsters.length}`
          : firstMonster.name;

      initiativeRolls.push({
        tokenId: firstMonster.id,
        tokenName: displayName,
        tokenColor: firstMonster.color,
        initiative,
        initMod,
        roll,
        layer: "monster",
        groupId,
        groupCount: groupMonsters.length,
        groupTokenIds: groupMonsters.map((m) => m.id),
      });
    });

    return initiativeRolls;
  }, [map, fogSet]);

  // Handler for starting combat - opens initiative setup modal
  const handleStartCombat = useCallback(() => {
    const entries = prepareInitiativeEntries();
    setDraftInitiativeEntries(entries);
    setShowInitiativeSetup(true);
  }, [prepareInitiativeEntries]);

  // Handler for confirming combat from the setup modal
  const handleConfirmCombat = useCallback(
    (entries: DraftInitiativeEntry[]) => {
      // Convert to the format expected by broadcastCombatResponse (without initMod and roll)
      const order = entries.map(({ initMod, roll, ...rest }) => rest);
      broadcastCombatResponse(true, order);
      syncDebounced(500);
      setShowInitiativeSetup(false);
      setDraftInitiativeEntries([]);
      // Clear the combat request if one exists
      clearCombatRequest();
      // AI Battle Engine: only auto-fire on monster/NPC first turn
      if (aiBattleEngine) {
        const firstEntry = entries[0];
        if (firstEntry && firstEntry.layer !== "character") {
          sendAiPrompt("Run this creature's turn. Decide movement, action, and bonus action.", true);
        }
      }
    },
    [broadcastCombatResponse, clearCombatRequest, syncDebounced, aiBattleEngine, sendAiPrompt]
  );

  // Handler for ending combat - broadcast + persist
  const handleEndCombat = useCallback(() => {
    broadcastCombatEnd();
    syncDebounced(500);
  }, [broadcastCombatEnd, syncDebounced]);

  // Handler for canceling initiative setup
  const handleCancelInitiativeSetup = useCallback(() => {
    setShowInitiativeSetup(false);
    setDraftInitiativeEntries([]);
    // If this was triggered by a combat request, deny it
    if (combatRequest) {
      broadcastCombatResponse(false, null);
    }
  }, [combatRequest, broadcastCombatResponse]);

  // Handler for accepting combat request from player
  const handleAcceptCombatRequest = useCallback(() => {
    handleStartCombat();
  }, [handleStartCombat]);

  // Handler for denying combat request
  const handleDenyCombatRequest = useCallback(() => {
    broadcastCombatResponse(false, null);
  }, [broadcastCombatResponse]);

  // Turn navigation handlers
  const handleNextTurn = useCallback(() => {
    if (!initiativeOrder) return;
    const isWrapping = currentTurnIndex >= initiativeOrder.length - 1;
    const nextIndex = isWrapping ? 0 : currentTurnIndex + 1;
    setCombatTurnIndex(nextIndex);
    syncDebounced(500);
    const currentMap = useMapStore.getState().map;
    if (currentMap) broadcastMapSync(currentMap);
    // AI Battle Engine
    if (aiBattleEngine) {
      const entry = initiativeOrder[nextIndex];
      if (isWrapping) {
        // New round — always trigger AI to continue combat
        sendAiPrompt(
          entry && entry.layer !== "character"
            ? "New round. Run this creature's turn. Decide movement, action, and bonus action."
            : "New round begins. Summarize the state of combat briefly.",
          true
        );
      } else if (entry && entry.layer !== "character") {
        sendAiPrompt("Run this creature's turn. Decide movement, action, and bonus action.", true);
      }
    }
  }, [initiativeOrder, currentTurnIndex, setCombatTurnIndex, syncDebounced, broadcastMapSync, aiBattleEngine, sendAiPrompt]);

  const handlePrevTurn = useCallback(() => {
    if (currentTurnIndex > 0) {
      setCombatTurnIndex(currentTurnIndex - 1);
      syncDebounced(500);
      const currentMap = useMapStore.getState().map;
      if (currentMap) broadcastMapSync(currentMap);
    }
  }, [currentTurnIndex, setCombatTurnIndex, syncDebounced, broadcastMapSync]);

  const [editingToken, setEditingToken] = useState<Token | null>(null);

  // Compute the navigable token list (matches what TokenPanel shows)
  const editableTokens = useMemo(() => {
    if (!map) return [];

    // Filter to visible tokens (same logic as TokenPanel)
    const visible = map.tokens.filter((token) => {
      if (isDungeonMaster()) return true;
      if (isTokenOwner(token.ownerId)) return true;
      if (!token.visible) return false;
      if (isTokenUnderFog(token, fogSet)) return false;
      return true;
    });

    // During combat, filter to combatants and sort by initiative
    if (isInCombat && initiativeOrder) {
      const initMap = new Map<string, number>();
      initiativeOrder.forEach((entry) => {
        if (entry.groupTokenIds) {
          entry.groupTokenIds.forEach((id) => initMap.set(id, entry.initiative));
        } else {
          initMap.set(entry.tokenId, entry.initiative);
        }
      });

      return visible
        .filter((t) => initMap.has(t.id))
        .sort((a, b) => (initMap.get(b.id) ?? 0) - (initMap.get(a.id) ?? 0));
    }

    // Only include tokens the user can edit
    return visible.filter((t) => canEditToken(t.ownerId));
  }, [map, isDungeonMaster, isTokenOwner, fogSet, canEditToken, isInCombat, initiativeOrder]);

  // Current index of editing token in the navigable list
  const editingTokenIndex = editingToken
    ? editableTokens.findIndex((t) => t.id === editingToken.id)
    : -1;

  const handleEditTokenNext = useCallback(() => {
    if (editingTokenIndex < 0 || editingTokenIndex >= editableTokens.length - 1) return;
    setEditingToken(editableTokens[editingTokenIndex + 1]);
  }, [editingTokenIndex, editableTokens]);

  const handleEditTokenPrev = useCallback(() => {
    if (editingTokenIndex <= 0) return;
    setEditingToken(editableTokens[editingTokenIndex - 1]);
  }, [editingTokenIndex, editableTokens]);

  // Find the token for the open character sheet
  const characterSheetToken = openCharacterSheetTokenId
    ? map?.tokens.find((t) => t.id === openCharacterSheetTokenId) ?? null
    : null;

  // Handler for character sheet updates - sync via HTTP + broadcast stats
  const handleCharacterSheetUpdate = useCallback(
    (updates: Partial<CharacterSheet>) => {
      if (!openCharacterSheetTokenId) return;
      updateCharacterSheet(openCharacterSheetTokenId, updates);

      // Broadcast AC, HP, condition, and aura changes instantly via WebSocket
      const stats: Record<string, number | string | boolean> = {};
      if (updates.ac !== undefined) stats.ac = updates.ac;
      if (updates.hpCurrent !== undefined) stats.hpCurrent = updates.hpCurrent;
      if (updates.hpMax !== undefined) stats.hpMax = updates.hpMax;
      if (updates.condition !== undefined) stats.condition = updates.condition;
      if (updates.auraCircleEnabled !== undefined) stats.auraCircleEnabled = updates.auraCircleEnabled;
      if (updates.auraCircleRange !== undefined) stats.auraCircleRange = updates.auraCircleRange;
      if (updates.auraSquareEnabled !== undefined) stats.auraSquareEnabled = updates.auraSquareEnabled;
      if (updates.auraSquareRange !== undefined) stats.auraSquareRange = updates.auraSquareRange;
      if (Object.keys(stats).length > 0) {
        broadcastTokenStats(openCharacterSheetTokenId, stats);
      }

      // Debounced sync since character sheet changes don't need instant sync
      syncDebounced(1000);
    },
    [openCharacterSheetTokenId, updateCharacterSheet, broadcastTokenStats, syncDebounced]
  );

  // Handler for initializing a character sheet
  const handleInitializeCharacterSheet = useCallback(() => {
    if (!openCharacterSheetTokenId) return;
    initializeCharacterSheet(openCharacterSheetTokenId);
    syncDebounced(500);
  }, [openCharacterSheetTokenId, initializeCharacterSheet, syncDebounced]);

  // Handler for linking a library character to a token (from CharacterSheetPanel)
  const handleLinkCharacter = useCallback(
    (character: { id: string; name: string; imageUrl: string | null; color: string; size: number; layer: string; characterSheet: CharacterSheet | null }) => {
      if (!openCharacterSheetTokenId) return;
      updateToken(openCharacterSheetTokenId, {
        characterId: character.id,
        characterSheet: character.characterSheet,
        name: character.name,
        imageUrl: character.imageUrl,
        color: character.color,
        size: character.size,
      });
      syncDebounced(500);
    },
    [openCharacterSheetTokenId, updateToken, syncDebounced]
  );

  // Handler for changing a token's image from the character sheet avatar
  const handleTokenImageChange = useCallback(
    (imageUrl: string | null) => {
      if (!openCharacterSheetTokenId) return;
      updateToken(openCharacterSheetTokenId, { imageUrl });
      syncDebounced(500);
    },
    [openCharacterSheetTokenId, updateToken, syncDebounced]
  );

  // Set editor context on mount/update
  useEffect(() => {
    setEditorContext(userId, permission, customPermissions);
  }, [userId, permission, customPermissions, setEditorContext]);

  // Auto-select and center on a token when first opening a map
  const hasAutoSelectedRef = useRef(false);
  useEffect(() => {
    if (!map?.tokens || map.tokens.length === 0 || hasAutoSelectedRef.current) return;
    // Wait for canvas to be ready (dimensions > 0)
    const { width, height } = getCanvasDimensions();
    if (width === 0 || height === 0) return;

    hasAutoSelectedRef.current = true;

    // For players: prefer their own movable token
    // For DM: pick the first token in the list
    let target: Token | undefined;
    if (!isDungeonMaster()) {
      target = map.tokens.find((t) => t.visible && canMoveToken(t.ownerId));
    }
    // Fallback: first visible token
    if (!target) {
      target = map.tokens.find((t) => t.visible);
    }

    if (target) {
      handleSelectAndCenter(target);
    }
  }, [map?.tokens, isDungeonMaster, canMoveToken, getCanvasDimensions, handleSelectAndCenter]);

  // Track which tokens we've already fetched sheets for (to avoid duplicate fetches)
  const fetchedTokenSheetsRef = useRef<Set<string>>(new Set());

  // Populate linked token character sheets on map load
  // This ensures HP bar and AC icon show on hover for linked tokens
  useEffect(() => {
    if (!map?.tokens) return;

    // Find linked tokens that don't have a cached character sheet
    const tokensNeedingSheets = map.tokens.filter(
      (t) => t.characterId && !t.characterSheet && !fetchedTokenSheetsRef.current.has(t.id)
    );

    if (tokensNeedingSheets.length === 0) return;

    // Mark these tokens as being fetched to avoid duplicate requests
    tokensNeedingSheets.forEach((t) => fetchedTokenSheetsRef.current.add(t.id));

    // Fetch character sheets from the library
    tokensNeedingSheets.forEach((token) => {
      fetch(`/api/characters/${token.characterId}`)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to fetch character");
          return res.json();
        })
        .then((data) => {
          const sheet = data.character?.characterSheet;
          if (sheet) {
            // Update token's cached copy for display (HP bar, AC icon)
            updateToken(token.id, { characterSheet: sheet });
          }
        })
        .catch((err) => {
          console.error(`Failed to fetch character sheet for token ${token.id}:`, err);
          // Remove from fetched set so we can retry later
          fetchedTokenSheetsRef.current.delete(token.id);
        });
    });
  }, [map?.tokens, updateToken]);

  // Undo/Redo - for fog, drawing, and token operations
  const temporalStore = useMapStore.temporal;
  const undo = useCallback(() => {
    temporalStore.getState().undo();
    // Sync changes after undo (fog/drawing/tokens)
    const currentMap = useMapStore.getState().map;
    if (currentMap) {
      broadcastMapSync(currentMap);
      syncDebounced(500);
    }
  }, [temporalStore, broadcastMapSync, syncDebounced]);

  const redo = useCallback(() => {
    temporalStore.getState().redo();
    // Sync changes after redo (fog/drawing/tokens)
    const currentMap = useMapStore.getState().map;
    if (currentMap) {
      broadcastMapSync(currentMap);
      syncDebounced(500);
    }
  }, [temporalStore, broadcastMapSync, syncDebounced]);

  // Scene handlers
  const performSceneSwitch = useCallback((sceneId: string) => {
    switchScene(sceneId);
    temporalStore.getState().clear();
    const currentMap = useMapStore.getState().map;
    if (currentMap) {
      broadcastMapSync(currentMap);
      syncNow();
    }
  }, [switchScene, temporalStore, broadcastMapSync, syncNow]);

  const initiateSceneSwitch = useCallback((sceneId: string, importTokens?: Token[], importGroups?: MonsterGroup[]) => {
    performSceneSwitch(sceneId);

    // If tokens were selected for import, inject groups and queue placement
    if (importTokens && importTokens.length > 0) {
      if (importGroups && importGroups.length > 0) {
        const currentMap = useMapStore.getState().map;
        if (currentMap) {
          useMapStore.setState({
            map: {
              ...currentMap,
              monsterGroups: [...currentMap.monsterGroups, ...importGroups],
              updatedAt: new Date().toISOString(),
            },
          });
        }
      }
      useEditorStore.getState().setTokenPlacementQueue(importTokens);
    }
  }, [performSceneSwitch]);

  const handleSwitchScene = useCallback((sceneId: string, importTokens?: Token[], importGroups?: MonsterGroup[]) => {
    if (isInCombat) {
      setPendingSceneSwitch(sceneId);
      return;
    }
    initiateSceneSwitch(sceneId, importTokens, importGroups);
  }, [isInCombat, initiateSceneSwitch]);

  const handleCreateScene = useCallback((name: string) => {
    createScene(name);
    temporalStore.getState().clear();
    const currentMap = useMapStore.getState().map;
    if (currentMap) {
      broadcastMapSync(currentMap);
      syncNow();
    }
  }, [createScene, temporalStore, broadcastMapSync, syncNow]);

  const handleDeleteScene = useCallback((sceneId: string) => {
    deleteScene(sceneId);
    temporalStore.getState().clear();
    const currentMap = useMapStore.getState().map;
    if (currentMap) {
      broadcastMapSync(currentMap);
      syncNow();
    }
  }, [deleteScene, temporalStore, broadcastMapSync, syncNow]);

  const handleRenameScene = useCallback((sceneId: string, newName: string) => {
    renameScene(sceneId, newName);
    syncDebounced(500);
  }, [renameScene, syncDebounced]);

  const handleDuplicateScene = useCallback((sceneId: string) => {
    duplicateScene(sceneId);
    const currentMap = useMapStore.getState().map;
    if (currentMap) {
      broadcastMapSync(currentMap);
      syncNow();
    }
  }, [duplicateScene, broadcastMapSync, syncNow]);

  // Keyboard shortcuts - undo/redo for fog, drawing, and token operations
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Allow native undo/redo for inputs and text areas
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Ctrl+Z / Cmd+Z for undo (fog, drawing, and token operations)
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }

      // Ctrl+Shift+Z / Cmd+Shift+Z or Ctrl+Y for redo (fog, drawing, and token operations)
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    },
    [undo, redo]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Auto-save with proper debouncing to prevent excessive API calls
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string | null>(null);
  const mapRef = useRef(map);
  mapRef.current = map; // Always keep current map in ref

  useEffect(() => {
    if (!map || !mapId) return;

    // Create a hash of the map to detect actual changes
    const mapHash = JSON.stringify({ name: map.name, updatedAt: map.updatedAt });

    // Skip if nothing has changed since last save
    if (lastSavedRef.current === mapHash) return;

    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Schedule a save after debounce delay
    saveTimeoutRef.current = setTimeout(() => {
      const currentMap = mapRef.current;
      if (!currentMap) return;

      // Save to server
      fetch(`/api/maps/${mapId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: currentMap.name, data: currentMap }),
      })
        .then(() => {
          // Update last saved hash on success
          lastSavedRef.current = JSON.stringify({
            name: currentMap.name,
            updatedAt: currentMap.updatedAt
          });
        })
        .catch(console.error);
    }, AUTO_SAVE_DELAY);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [map?.updatedAt, mapId]); // Only trigger on updatedAt changes, not entire map

  // Create new map if none loaded
  useEffect(() => {
    if (!map && !mapId) {
      newMap("Untitled Map");
    }
  }, [map, mapId, newMap]);

  const handleEditTokenDelete = useCallback(
    (tokenId: string) => {
      removeToken(tokenId);
      handleTokenDelete(tokenId);
    },
    [removeToken, handleTokenDelete]
  );

  const handleEditTokenClone = useCallback(
    (tokenId: string) => {
      const newToken = duplicateToken(tokenId, { sameGroup: true });
      if (newToken) handleTokenCreate(newToken);
    },
    [duplicateToken, handleTokenCreate]
  );

  const handleEditToken = (token: Token) => {
    setEditingToken(token);
  };

  const handleCloseEditDialog = () => {
    setEditingToken(null);
  };

  if (!map) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Toolbar userName={userName} userId={userId} mapId={mapId} groupId={groupId} groupMembers={groupMembers} onDmTransfer={broadcastDmTransfer} onGridChange={() => { const currentMap = useMapStore.getState().map; if (currentMap) { broadcastMapSync(currentMap); syncDebounced(500); } }} tierLimits={tierLimits} />
      <div className="flex flex-1 overflow-hidden relative">
        {isMobile ? (
          <MobileSidebarRail
            mapId={mapId}
            onEditToken={handleEditToken}
            onTokenDelete={handleTokenDelete}
            onTokenCreate={handleTokenCreate}
            onMapChanged={() => { const currentMap = useMapStore.getState().map; if (currentMap) { broadcastMapSync(currentMap); syncDebounced(500); } }}
            onBackgroundChange={() => { const currentMap = useMapStore.getState().map; if (currentMap) { broadcastMapSync(currentMap); syncDebounced(500); } }}
            onSelectAndCenter={handleSelectAndCenter}
            onCombatRequest={broadcastCombatRequest}
            onStartCombat={handleStartCombat}
            onEndCombat={handleEndCombat}
            isInCombat={isInCombat}
            initiativeOrder={initiativeOrder}
            pendingCombatRequest={combatRequest}
            currentUserName={userName}
            currentTurnIndex={currentTurnIndex}
            onNextTurn={handleNextTurn}
            onPrevTurn={handlePrevTurn}
            userName={userName}
            userId={userId}
            onSendChatMessage={broadcastChatMessage}
            onClearChat={broadcastChatClear}
            isDM={isDungeonMaster()}
            mapOwnerId={mapOwnerId || userId || ""}
            aiLoading={aiLoading}
            onAiPrompt={sendAiPrompt}
            aiBattleEngine={aiBattleEngine}
            onAiBattleEngineChange={setAiBattleEngine}
            onSwitchScene={handleSwitchScene}
            onCreateScene={handleCreateScene}
            onDeleteScene={handleDeleteScene}
            onRenameScene={handleRenameScene}
            onDuplicateScene={handleDuplicateScene}
            tierLimits={tierLimits}
          />
        ) : (
          <Sidebar
            mapId={mapId}
            onEditToken={handleEditToken}
            onTokenDelete={handleTokenDelete}
            onTokenCreate={handleTokenCreate}
            onMapChanged={() => { const currentMap = useMapStore.getState().map; if (currentMap) { broadcastMapSync(currentMap); syncDebounced(500); } }}
            onBackgroundChange={() => { const currentMap = useMapStore.getState().map; if (currentMap) { broadcastMapSync(currentMap); syncDebounced(500); } }}
            onSelectAndCenter={handleSelectAndCenter}
            onCombatRequest={broadcastCombatRequest}
            onStartCombat={handleStartCombat}
            onEndCombat={handleEndCombat}
            isInCombat={isInCombat}
            initiativeOrder={initiativeOrder}
            pendingCombatRequest={combatRequest}
            currentUserName={userName}
            currentTurnIndex={currentTurnIndex}
            onNextTurn={handleNextTurn}
            onPrevTurn={handlePrevTurn}
            aiLoading={aiLoading}
            onAiPrompt={sendAiPrompt}
            aiBattleEngine={aiBattleEngine}
            onAiBattleEngineChange={setAiBattleEngine}
            userId={userId}
            onSendMessage={broadcastChatMessage}
            selectedWallId={selectedWallId}
            selectedAreaId={selectedAreaId}
            onUpdateWall={handleUpdateWall}
            onDeleteWall={handleDeleteWall}
            onUpdateArea={handleUpdateArea}
            onDeleteArea={handleDeleteArea}
            onSwitchScene={handleSwitchScene}
            onCreateScene={handleCreateScene}
            onDeleteScene={handleDeleteScene}
            onRenameScene={handleRenameScene}
            onDuplicateScene={handleDuplicateScene}
            tierLimits={tierLimits}
          />
        )}
        <Suspense
          fallback={
            <div className="flex-1 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
              <p className="text-gray-500">Loading canvas...</p>
            </div>
          }
        >
          <MapCanvas
            onTokenMoved={handleTokenMoved}
            onTokenFlip={handleTokenFlip}
            onTokenCreate={handleTokenCreate}
            onFogPaint={handleFogPaint}
            onFogErase={handleFogErase}
            onFogPaintRange={handleFogPaintRange}
            onFogEraseRange={handleFogEraseRange}
            onPing={broadcastPing}
            onDrawingAdd={broadcastDrawingAdd}
            onDrawingRemove={broadcastDrawingRemove}
            onWallAdd={handleWallAdd}
            onWallRemove={handleWallRemove}
            onAreaAdd={handleAreaAdd}
            onAreaRemove={handleAreaRemove}
            activePings={activePings}
          />
        </Suspense>
        {!isMobile && (
          <ChatPanel
            mapId={mapId || ""}
            userId={userId || ""}
            userName={userName || "Anonymous"}
            isDM={isDungeonMaster()}
            onSendMessage={broadcastChatMessage}
            onClearChat={broadcastChatClear}
            mapOwnerId={mapOwnerId || userId || ""}
            aiLoading={aiLoading}
            onAiPrompt={sendAiPrompt}
            aiBattleEngine={aiBattleEngine}
            tierLimits={tierLimits}
          />
        )}
      </div>

      {editingToken && (
        <TokenEditDialog
          token={editingToken}
          onClose={handleCloseEditDialog}
          groupMembers={groupMembers}
          onSave={syncNow}
          onTokenUpdate={handleTokenUpdate}
          onDelete={canEditToken(editingToken.ownerId) || isDungeonMaster() ? handleEditTokenDelete : undefined}
          onClone={isDungeonMaster() ? handleEditTokenClone : undefined}
          mapId={mapId}
          onNext={handleEditTokenNext}
          onPrev={handleEditTokenPrev}
          hasNext={editingTokenIndex >= 0 && editingTokenIndex < editableTokens.length - 1}
          hasPrev={editingTokenIndex > 0}
          tokenIndex={editingTokenIndex >= 0 ? editingTokenIndex : undefined}
          tokenCount={editableTokens.length}
        />
      )}

      {characterSheetToken && (
        <CharacterSheetPanel
          token={characterSheetToken}
          onUpdate={handleCharacterSheetUpdate}
          onClose={closeCharacterSheet}
          onInitialize={handleInitializeCharacterSheet}
          onLinkCharacter={isTokenOwner(characterSheetToken.ownerId) ? handleLinkCharacter : undefined}
          onTokenImageChange={handleTokenImageChange}
        />
      )}

      {/* Combat Request Modal - shown to DM when player requests combat */}
      {combatRequest && isDungeonMaster() && !showInitiativeSetup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600 dark:text-red-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6.92 5H5l5.5 5.5.71-.71L6.92 5zm12.08 0h-1.92l-4.29 4.29.71.71L19 5zM12 9.17L5.83 15.34 4.42 13.93 10.59 7.76l.71.71L5.83 13.93l1.41 1.41L12 10.59l4.76 4.75 1.41-1.41L12.71 8.46l.71-.71 5.46 5.46-1.41 1.42L12 9.17zM3 19v2h18v-2H3z"/>
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Combat Request</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {combatRequest.requesterName} has requested to start combat
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleDenyCombatRequest}
                className="flex-1 px-4 py-2 rounded font-medium cursor-pointer transition-colors bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Deny
              </button>
              <button
                onClick={handleAcceptCombatRequest}
                className="flex-1 px-4 py-2 rounded font-medium cursor-pointer transition-colors bg-red-600 hover:bg-red-700 text-white"
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Initiative Setup Modal - shown when DM starts or accepts combat */}
      <InitiativeSetupModal
        isOpen={showInitiativeSetup}
        entries={draftInitiativeEntries}
        onConfirm={handleConfirmCombat}
        onCancel={handleCancelInitiativeSetup}
      />

      {/* Scene Switch During Combat Confirmation */}
      {pendingSceneSwitch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Switch Scene?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Combat is active. Tokens in the initiative tracker may not be on the new scene.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setPendingSceneSwitch(null)}
                className="w-full px-4 py-2 rounded font-medium cursor-pointer transition-colors bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const endCombatAction = useMapStore.getState().endCombat;
                  endCombatAction();
                  const target = pendingSceneSwitch;
                  setPendingSceneSwitch(null);
                  initiateSceneSwitch(target);
                }}
                className="w-full px-4 py-2 rounded font-medium cursor-pointer transition-colors bg-amber-600 hover:bg-amber-700 text-white"
              >
                End Combat & Switch
              </button>
              <button
                onClick={() => {
                  const target = pendingSceneSwitch;
                  setPendingSceneSwitch(null);
                  initiateSceneSwitch(target);
                }}
                className="w-full px-4 py-2 rounded font-medium cursor-pointer transition-colors bg-blue-600 hover:bg-blue-700 text-white"
              >
                Switch (Keep Combat)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
