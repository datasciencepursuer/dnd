import type { Route } from "./+types/maps";
import { useState, useEffect } from "react";
import { Link, Form } from "react-router";
import { requireAuth } from "~/.server/auth/session";
import { getMapIndex, deleteMap, type MapIndexEntry } from "~/features/map-editor";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "My Maps - DnD" },
    { name: "description", content: "View and manage your DnD maps" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  return null;
}

export default function Maps() {
  const [maps, setMaps] = useState<MapIndexEntry[]>([]);

  useEffect(() => {
    setMaps(getMapIndex());
  }, []);

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Delete "${name}"?`)) {
      deleteMap(id);
      setMaps(getMapIndex());
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            My Maps
          </h1>
          <div className="flex gap-4">
            <Link
              to="/playground"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              + New Map
            </Link>
            <Form method="post" action="/logout">
              <button
                type="submit"
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Logout
              </button>
            </Form>
          </div>
        </div>

        {maps.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              No maps yet. Create your first map!
            </p>
            <Link
              to="/playground"
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Create Map
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {maps.map((map) => (
              <div
                key={map.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden"
              >
                <div className="h-32 bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                  <span className="text-4xl">🗺️</span>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                    {map.name}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                    Updated {new Date(map.updatedAt).toLocaleDateString()}
                  </p>
                  <div className="flex gap-2">
                    <Link
                      to={`/playground/${map.id}`}
                      className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded text-center hover:bg-blue-700"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => handleDelete(map.id, map.name)}
                      className="px-3 py-1.5 bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 text-sm rounded hover:bg-red-200 dark:hover:bg-red-800"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
