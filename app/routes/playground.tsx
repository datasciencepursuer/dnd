import type { Route } from "./+types/playground";
import { useEffect } from "react";
import { useLoaderData } from "react-router";
import { requireAuth } from "~/.server/auth/session";
import { getUserTier } from "~/.server/subscription";
import { MapEditor, useEditorStore, useViewportHeight } from "~/features/map-editor";
import { useHydrated } from "~/lib/use-hydrated";
import { getTierLimits, type AccountTier, type TierLimits } from "~/lib/tier-limits";

interface LoaderData {
  userId: string;
  userName: string;
  accountTier: AccountTier;
  tierLimits: TierLimits;
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Virtual Table Top - DnD" },
    { name: "description", content: "Create and edit DnD maps" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const session = await requireAuth(request);
  const accountTier = await getUserTier(session.user.id);
  return {
    userId: session.user.id,
    userName: session.user.name,
    accountTier,
    tierLimits: getTierLimits(accountTier),
  };
}

export default function Playground() {
  const data = useLoaderData<LoaderData>();
  const hydrated = useHydrated();
  const appHeight = useViewportHeight();

  // Hydrate AI image usage stats once on mount
  const fetchAiImageUsage = useEditorStore((s) => s.fetchAiImageUsage);
  useEffect(() => {
    fetchAiImageUsage();
  }, [fetchAiImageUsage]);

  return (
    <div
      className="h-[100dvh] flex flex-col bg-gray-50 dark:bg-gray-900"
      style={{ height: appHeight }}
    >
      {hydrated ? (
        <MapEditor userId={data.userId} userName={data.userName} accountTier={data.accountTier} tierLimits={data.tierLimits} />
      ) : null}
    </div>
  );
}
