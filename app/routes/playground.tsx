import type { Route } from "./+types/playground";
import { requireAuth } from "~/.server/auth/session";
import { MapEditor } from "~/features/map-editor";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Map Editor - DnD" },
    { name: "description", content: "Create and edit DnD maps" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  return null;
}

export default function Playground() {
  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <MapEditor />
    </div>
  );
}
