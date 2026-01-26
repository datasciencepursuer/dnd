import { useEffect, lazy, Suspense } from "react";
import { Toolbar } from "./Toolbar/Toolbar";
import { Sidebar } from "./Sidebar/Sidebar";
import { useMapStore } from "../store";
import { saveMap } from "../utils/storage-utils";

const MapCanvas = lazy(() =>
  import("./Canvas/MapCanvas").then((mod) => ({ default: mod.MapCanvas }))
);

interface MapEditorProps {
  mapId?: string;
}

export function MapEditor({ mapId }: MapEditorProps) {
  const map = useMapStore((s) => s.map);
  const newMap = useMapStore((s) => s.newMap);

  // Auto-save on map changes
  useEffect(() => {
    if (map) {
      const timeout = setTimeout(() => {
        saveMap(map);
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [map]);

  // Create new map if none loaded
  useEffect(() => {
    if (!map && !mapId) {
      newMap("Untitled Map");
    }
  }, [map, mapId, newMap]);

  if (!map) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Toolbar />
      <div className="flex flex-1 overflow-hidden">
        <Suspense
          fallback={
            <div className="flex-1 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
              <p className="text-gray-500">Loading canvas...</p>
            </div>
          }
        >
          <MapCanvas />
        </Suspense>
        <Sidebar />
      </div>
    </div>
  );
}
