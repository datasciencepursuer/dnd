import type { Route } from "./+types/playground.$mapId";
import { useEffect } from "react";
import { useParams } from "react-router";
import { requireAuth } from "~/.server/auth/session";
import { MapEditor, useMapStore, loadMap } from "~/features/map-editor";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Edit Map - DnD" },
    { name: "description", content: "Edit your DnD map" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  return null;
}

export default function PlaygroundWithMap() {
  const { mapId } = useParams();
  const loadMapStore = useMapStore((s) => s.loadMap);

  useEffect(() => {
    if (mapId) {
      const map = loadMap(mapId);
      if (map) {
        loadMapStore(map);
      }
    }
  }, [mapId, loadMapStore]);

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <MapEditor mapId={mapId} />
    </div>
  );
}
