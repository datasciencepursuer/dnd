import { useEffect, lazy, Suspense, useState, useCallback, useRef } from "react";
import { Toolbar } from "./Toolbar/Toolbar";
import { Sidebar } from "./Sidebar/Sidebar";
import { DiceHistoryBar } from "./DiceHistoryBar";
import { TokenEditDialog } from "./TokenEditDialog";
import { useMapStore, useEditorStore } from "../store";
import { preloadImages } from "../hooks";
import { PRESET_IMAGES } from "../constants";
import type { Token, PlayerPermissions } from "../types";

const AUTO_SAVE_DELAY = 2000; // 2 seconds debounce

const MapCanvas = lazy(() =>
  import("./Canvas/MapCanvas").then((mod) => ({ default: mod.MapCanvas }))
);

interface MapEditorProps {
  mapId?: string;
  readOnly?: boolean;
  permission?: "view" | "edit" | "owner";
  customPermissions?: PlayerPermissions | null;
  userId?: string | null;
}

export function MapEditor({
  mapId,
  readOnly = false,
  permission = "owner",
  customPermissions = null,
  userId = null,
}: MapEditorProps) {
  const map = useMapStore((s) => s.map);
  const newMap = useMapStore((s) => s.newMap);
  const setEditorContext = useEditorStore((s) => s.setEditorContext);

  const [editingToken, setEditingToken] = useState<Token | null>(null);

  // Set editor context on mount/update
  useEffect(() => {
    setEditorContext(userId, permission, customPermissions);
  }, [userId, permission, customPermissions, setEditorContext]);

  // Preload preset images on mount
  useEffect(() => {
    preloadImages(Object.values(PRESET_IMAGES));
  }, []);

  // Undo/Redo - get stable references directly from temporal store
  const temporalStore = useMapStore.temporal;
  const undo = useCallback(() => temporalStore.getState().undo(), [temporalStore]);
  const redo = useCallback(() => temporalStore.getState().redo(), [temporalStore]);

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
    if (!map || !mapId || readOnly) return;

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
  }, [map?.updatedAt, mapId, readOnly]); // Only trigger on updatedAt changes, not entire map

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
      <Toolbar readOnly={readOnly} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar mapId={mapId} onEditToken={handleEditToken} />
        <Suspense
          fallback={
            <div className="flex-1 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
              <p className="text-gray-500">Loading canvas...</p>
            </div>
          }
        >
          <MapCanvas />
        </Suspense>
        <DiceHistoryBar />
      </div>

      {editingToken && (
        <TokenEditDialog token={editingToken} onClose={handleCloseEditDialog} />
      )}
    </div>
  );
}
