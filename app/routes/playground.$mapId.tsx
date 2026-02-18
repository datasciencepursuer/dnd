import type { Route } from "./+types/playground.$mapId";
import { useEffect } from "react";
import { useLoaderData, useParams } from "react-router";
import { requireAuth } from "~/.server/auth/session";
import { getUserTier } from "~/.server/subscription";
import { MapEditor, useMapStore, useViewportHeight } from "~/features/map-editor";
import { useHydrated } from "~/lib/use-hydrated";
import type { PermissionLevel } from "~/.server/db/schema";
import type { DnDMap, PlayerPermissions } from "~/features/map-editor";
import { getTierLimits, type AccountTier, type TierLimits } from "~/lib/tier-limits";

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
  mapOwnerId: string;
  accountTier: AccountTier;
  tierLimits: TierLimits;
  realtimeSyncEnabled: boolean;
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

  // Get current user's tier for UI gating
  const accountTier = await getUserTier(session.user.id);
  const tierLimits = getTierLimits(accountTier);

  // Real-time sync enabled if the map owner has the feature
  const ownerTier = mapData.userId === session.user.id
    ? accountTier
    : await getUserTier(mapData.userId);
  const ownerLimits = getTierLimits(ownerTier);
  const realtimeSyncEnabled = ownerLimits.realtimeSync;

  return {
    ...mapData,
    mapOwnerId: mapData.userId,
    userId: session.user.id,
    userName: session.user.name,
    accountTier,
    tierLimits,
    realtimeSyncEnabled,
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

  const hydrated = useHydrated();
  const appHeight = useViewportHeight();

  return (
    <div
      className="h-[100dvh] flex flex-col bg-gray-50 dark:bg-gray-900"
      style={{ height: appHeight }}
    >
      {hydrated ? (
        <MapEditor
          mapId={mapId}
          permission={data.permission}
          customPermissions={data.customPermissions}
          userId={data.userId}
          userName={data.userName}
          groupMembers={data.groupMembers}
          groupId={data.groupId}
          mapOwnerId={data.mapOwnerId}
          accountTier={data.accountTier}
          tierLimits={data.tierLimits}
          realtimeSyncEnabled={data.realtimeSyncEnabled}
        />
      ) : null}
    </div>
  );
}
