import type { Route } from "./+types/maps";
import { useState, useEffect } from "react";
import { Link, Form, useNavigate } from "react-router";
import { requireAuth } from "~/.server/auth/session";
import {
  getMapIndex,
  deleteMap,
  saveMap,
  createNewMap,
  DEFAULT_GRID,
  type MapIndexEntry,
} from "~/features/map-editor";

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
  const navigate = useNavigate();
  const [maps, setMaps] = useState<MapIndexEntry[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newMapName, setNewMapName] = useState("Untitled Map");
  const [gridWidth, setGridWidth] = useState(DEFAULT_GRID.width);
  const [gridHeight, setGridHeight] = useState(DEFAULT_GRID.height);

  useEffect(() => {
    setMaps(getMapIndex());
  }, []);

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Delete "${name}"?`)) {
      deleteMap(id);
      setMaps(getMapIndex());
    }
  };

  const handleCreateMap = () => {
    const width = Math.max(5, Math.min(100, gridWidth));
    const height = Math.max(5, Math.min(100, gridHeight));
    const map = createNewMap({
      name: newMapName.trim() || "Untitled Map",
      gridWidth: width,
      gridHeight: height,
    });
    saveMap(map);
    navigate(`/playground/${map.id}`);
  };

  const handleOpenModal = () => {
    setNewMapName("Untitled Map");
    setGridWidth(DEFAULT_GRID.width);
    setGridHeight(DEFAULT_GRID.height);
    setShowCreateModal(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            My Maps
          </h1>
          <div className="flex gap-4">
            <button
              onClick={handleOpenModal}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
            >
              + New Map
            </button>
            <Form method="post" action="/logout">
              <button
                type="submit"
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-600 cursor-pointer"
              >
                Logout
              </button>
            </Form>
          </div>
        </div>

        {/* Create Map Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Create New Map
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Map Name
                  </label>
                  <input
                    type="text"
                    value={newMapName}
                    onChange={(e) => setNewMapName(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Grid Size
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                        Width (cells)
                      </label>
                      <input
                        type="number"
                        value={gridWidth}
                        onChange={(e) =>
                          setGridWidth(parseInt(e.target.value) || 5)
                        }
                        min={5}
                        max={100}
                        className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                        Height (cells)
                      </label>
                      <input
                        type="number"
                        value={gridHeight}
                        onChange={(e) =>
                          setGridHeight(parseInt(e.target.value) || 5)
                        }
                        min={5}
                        max={100}
                        className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Min: 5, Max: 100. You can change this later.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateMap}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
                >
                  Create Map
                </button>
              </div>
            </div>
          </div>
        )}

        {maps.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              No maps yet. Create your first map!
            </p>
            <button
              onClick={handleOpenModal}
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
            >
              Create Map
            </button>
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
                      className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded text-center hover:bg-blue-700 cursor-pointer"
                    >
                      Enter
                    </Link>
                    <button
                      onClick={() => handleDelete(map.id, map.name)}
                      className="px-3 py-1.5 bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 text-sm rounded hover:bg-red-200 dark:hover:bg-red-800 cursor-pointer"
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
