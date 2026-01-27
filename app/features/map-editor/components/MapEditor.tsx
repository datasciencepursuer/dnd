import { useEffect, lazy, Suspense, useState } from "react";
import { Toolbar } from "./Toolbar/Toolbar";
import { Sidebar } from "./Sidebar/Sidebar";
import { TokenEditDialog } from "./TokenEditDialog";
import { useMapStore, useEditorStore } from "../store";
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
        <Suspense
          fallback={
            <div className="flex-1 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
              <p className="text-gray-500">Loading canvas...</p>
            </div>
          }
        >
          <MapCanvas onEditToken={handleEditToken} />
        </Suspense>
        <Sidebar />
      </div>

      {editingToken && (
        <TokenEditDialog token={editingToken} onClose={handleCloseEditDialog} />
      )}
    </div>
  );
}
