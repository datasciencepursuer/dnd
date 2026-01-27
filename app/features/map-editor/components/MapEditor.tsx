import { useEffect, lazy, Suspense, useState, useCallback } from "react";
import { Toolbar } from "./Toolbar/Toolbar";
import { Sidebar } from "./Sidebar/Sidebar";
import { DiceHistoryBar } from "./DiceHistoryBar";
import { TokenEditDialog } from "./TokenEditDialog";
import { useMapStore, useEditorStore } from "../store";
import { preloadImages } from "../hooks";
import { PRESET_IMAGES } from "../constants";
import type { Token, PlayerPermissions } from "../types";

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

  // Auto-save on map changes (only if not read-only)
  useEffect(() => {
    if (map && mapId && !readOnly) {
      const timeout = setTimeout(() => {
        // Save to server
        fetch(`/api/maps/${mapId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: map.name, data: map }),
        }).catch(console.error);
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [map, mapId, readOnly]);

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
      <Toolbar readOnly={readOnly} permission={permission} mapId={mapId} />
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
