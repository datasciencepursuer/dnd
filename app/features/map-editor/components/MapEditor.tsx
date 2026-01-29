import { useEffect, lazy, Suspense, useState, useCallback, useRef } from "react";
import { Toolbar } from "./Toolbar/Toolbar";
import { Sidebar } from "./Sidebar/Sidebar";
import { DiceHistoryBar } from "./DiceHistoryBar";
import { TokenEditDialog } from "./TokenEditDialog";
import { useMapStore, useEditorStore } from "../store";
import { useMapSync } from "../hooks";
import { usePartySync } from "../hooks/usePartySync";
import type { Token, PlayerPermissions, GridPosition, Ping } from "../types";

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
  readOnly?: boolean;
  permission?: "view" | "edit" | "owner";
  customPermissions?: PlayerPermissions | null;
  userId?: string | null;
  userName?: string | null;
  groupMembers?: GroupMemberInfo[];
}

export function MapEditor({
  mapId,
  readOnly = false,
  permission = "owner",
  customPermissions = null,
  userId = null,
  userName = null,
  groupMembers = [],
}: MapEditorProps) {
  const map = useMapStore((s) => s.map);
  const newMap = useMapStore((s) => s.newMap);
  const setEditorContext = useEditorStore((s) => s.setEditorContext);

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
    activePings,
  } = usePartySync({
    mapId,
    userId,
    userName,
    enabled: !!mapId && !!userId,
  });

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
      broadcastFogErase(col, row);
      syncDebounced(1000);
    },
    [broadcastFogErase, syncDebounced]
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
      broadcastFogEraseRange(startCol, startRow, endCol, endRow);
      syncDebounced(1000);
    },
    [broadcastFogEraseRange, syncDebounced]
  );

  const [editingToken, setEditingToken] = useState<Token | null>(null);

  // Set editor context on mount/update
  useEffect(() => {
    setEditorContext(userId, permission, customPermissions);
  }, [userId, permission, customPermissions, setEditorContext]);

  // Undo/Redo - get stable references directly from temporal store
  const temporalStore = useMapStore.temporal;
  const undo = useCallback(() => {
    temporalStore.getState().undo();
    // Sync changes after undo
    const currentMap = useMapStore.getState().map;
    if (currentMap) {
      broadcastMapSync(currentMap);
      syncDebounced(500);
    }
  }, [temporalStore, broadcastMapSync, syncDebounced]);

  const redo = useCallback(() => {
    temporalStore.getState().redo();
    // Sync changes after redo
    const currentMap = useMapStore.getState().map;
    if (currentMap) {
      broadcastMapSync(currentMap);
      syncDebounced(500);
    }
  }, [temporalStore, broadcastMapSync, syncDebounced]);

  // Keyboard shortcuts for undo/redo
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Ctrl+Z / Cmd+Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }

      // Ctrl+Shift+Z / Cmd+Shift+Z or Ctrl+Y for redo
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
      <Toolbar readOnly={readOnly} userName={userName} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar mapId={mapId} onEditToken={handleEditToken} readOnly={readOnly} onTokenDelete={handleTokenDelete} onTokenCreate={handleTokenCreate} onBackgroundChange={() => { const currentMap = useMapStore.getState().map; if (currentMap) { broadcastMapSync(currentMap); syncDebounced(500); } }} />
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
            onFogPaint={handleFogPaint}
            onFogErase={handleFogErase}
            onFogPaintRange={handleFogPaintRange}
            onFogEraseRange={handleFogEraseRange}
            onPing={broadcastPing}
            activePings={activePings}
          />
        </Suspense>
        <DiceHistoryBar onRoll={syncNow} userName={userName} userId={userId} />
      </div>

      {editingToken && (
        <TokenEditDialog
          token={editingToken}
          onClose={handleCloseEditDialog}
          groupMembers={groupMembers}
          canAssignOwner={permission === "owner" || permission === "edit"}
          onSave={syncNow}
          onTokenUpdate={handleTokenUpdate}
          mapId={mapId}
        />
      )}
    </div>
  );
}
