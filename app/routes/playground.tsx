import type { Route } from "./+types/playground";
import { useLoaderData } from "react-router";
import { requireAuth } from "~/.server/auth/session";
import { MapEditor } from "~/features/map-editor";
import { useHydrated } from "~/lib/use-hydrated";

interface LoaderData {
  userId: string;
  userName: string;
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Map Editor - DnD" },
    { name: "description", content: "Create and edit DnD maps" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const session = await requireAuth(request);
  return {
    userId: session.user.id,
    userName: session.user.name,
  };
}

export default function Playground() {
  const data = useLoaderData<LoaderData>();
  const hydrated = useHydrated();

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {hydrated ? (
        <MapEditor userId={data.userId} userName={data.userName} />
      ) : null}
    </div>
  );
}
