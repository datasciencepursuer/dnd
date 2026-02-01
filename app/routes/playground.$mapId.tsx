import type { Route } from "./+types/playground.$mapId";
import { useEffect } from "react";
import { useLoaderData, useParams } from "react-router";
import { requireAuth } from "~/.server/auth/session";
import { MapEditor, useMapStore } from "~/features/map-editor";
import type { PermissionLevel } from "~/.server/db/schema";
import type { DnDMap, PlayerPermissions } from "~/features/map-editor";

interface GroupMemberInfo {
  id: string;
  name: string;
}

interface LoaderData {
  id: string;
  name: string;
  data: DnDMap;
  permission: PermissionLevel;
  customPermissions: PlayerPermissions;
  userId: string;
  userName: string;
  groupMembers: GroupMemberInfo[];
  groupId: string | null;
}

export function meta({ data }: Route.MetaArgs) {
  const mapName = data?.name || "Map";
  return [
    { title: `${mapName} - DnD` },
    { name: "description", content: `Edit ${mapName}` },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const session = await requireAuth(request);
  const { mapId } = params;

  if (!mapId) {
    throw new Response("Map ID required", { status: 400 });
  }

  // Fetch map from the API
  const apiUrl = new URL(`/api/maps/${mapId}`, request.url);
  const response = await fetch(apiUrl, {
    headers: request.headers,
  });

  if (response.status === 403) {
    throw new Response("You don't have access to this map", { status: 403 });
  }

  if (response.status === 404) {
    throw new Response("Map not found", { status: 404 });
  }

  if (!response.ok) {
    throw new Response("Failed to load map", { status: response.status });
  }

  const mapData = await response.json();

  return {
    ...mapData,
    userId: session.user.id,
    userName: session.user.name,
  };
}

export default function PlaygroundWithMap() {
  const { mapId } = useParams();
  const data = useLoaderData<LoaderData>();
  const loadMapStore = useMapStore((s) => s.loadMap);

  useEffect(() => {
    if (data?.data) {
      loadMapStore(data.data);
    }
  }, [data, loadMapStore]);

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <MapEditor
        mapId={mapId}
        permission={data.permission}
        customPermissions={data.customPermissions}
        userId={data.userId}
        userName={data.userName}
        groupMembers={data.groupMembers}
        groupId={data.groupId}
      />
    </div>
  );
}
