import type { Route } from "./+types/maps";
import { useState, useEffect } from "react";
import { Link, Form, useNavigate, useLoaderData } from "react-router";
import { requireAuth } from "~/.server/auth/session";
import {
  createNewMap,
  DEFAULT_GRID,
  getMapIndex,
  type MapIndexEntry,
} from "~/features/map-editor";
import { MigrationPrompt } from "~/features/map-editor/components/MigrationPrompt";
import type { PermissionLevel } from "~/.server/db/schema";

interface MapListItem {
  id: string;
  name: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  permission: PermissionLevel;
}

interface LoaderData {
  owned: MapListItem[];
  shared: MapListItem[];
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "My Maps - DnD" },
    { name: "description", content: "View and manage your DnD maps" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);

  // Fetch maps from the API
  const apiUrl = new URL("/api/maps", request.url);
  const response = await fetch(apiUrl, {
    headers: request.headers,
  });

  if (!response.ok) {
    throw new Response("Failed to load maps", { status: response.status });
  }

  return response.json();
}

export default function Maps() {
  const navigate = useNavigate();
  const { owned, shared } = useLoaderData<LoaderData>();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newMapName, setNewMapName] = useState("Untitled Map");
  const [gridWidth, setGridWidth] = useState(DEFAULT_GRID.width);
  const [gridHeight, setGridHeight] = useState(DEFAULT_GRID.height);
  const [isCreating, setIsCreating] = useState(false);
  const [localMaps, setLocalMaps] = useState<MapIndexEntry[]>([]);
  const [migrationDismissed, setMigrationDismissed] = useState(false);

  // Delete modal state
  const [deleteModal, setDeleteModal] = useState<{ id: string; name: string } | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Check for localStorage maps on mount
  useEffect(() => {
    const maps = getMapIndex();
    setLocalMaps(maps);
  }, []);

  const openDeleteModal = (id: string, name: string) => {
    setDeleteModal({ id, name });
    setDeleteConfirmText("");
  };

  const closeDeleteModal = () => {
    setDeleteModal(null);
    setDeleteConfirmText("");
    setIsDeleting(false);
  };

  const handleDelete = async () => {
    if (!deleteModal || deleteConfirmText !== deleteModal.name) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/maps/${deleteModal.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        closeDeleteModal();
        window.location.reload();
      } else {
        alert("Failed to delete map");
        setIsDeleting(false);
      }
    } catch {
      alert("Failed to delete map");
      setIsDeleting(false);
    }
  };

  const handleCreateMap = async () => {
    setIsCreating(true);
    const width = Math.max(5, Math.min(100, gridWidth));
    const height = Math.max(5, Math.min(100, gridHeight));
    const map = createNewMap({
      name: newMapName.trim() || "Untitled Map",
      gridWidth: width,
      gridHeight: height,
    });

    try {
      const response = await fetch("/api/maps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: map.name, data: map }),
      });

      if (response.ok) {
        const result = await response.json();
        navigate(`/playground/${result.id}`);
      } else {
        alert("Failed to create map");
      }
    } catch {
      alert("Failed to create map");
    } finally {
      setIsCreating(false);
    }
  };

  const handleOpenModal = () => {
    setNewMapName("Untitled Map");
    setGridWidth(DEFAULT_GRID.width);
    setGridHeight(DEFAULT_GRID.height);
    setShowCreateModal(true);
  };

  const renderMapCard = (map: MapListItem, canDelete: boolean) => (
    <div
      key={map.id}
      className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden"
    >
      <div className="h-32 bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
        <span className="text-4xl">🗺️</span>
      </div>
      <div className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            {map.name}
          </h3>
          {map.permission !== "owner" && (
            <span
              className={`text-xs px-2 py-0.5 rounded ${
                map.permission === "edit"
                  ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
                  : "bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300"
              }`}
            >
              {map.permission}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          Updated {new Date(map.updatedAt).toLocaleDateString()}
        </p>
        <div className="flex gap-2">
          <Link
            to={`/playground/${map.id}`}
            className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded text-center hover:bg-blue-700 cursor-pointer"
          >
            {map.permission === "view" ? "View" : "Play"}
          </Link>
          {canDelete && (
            <button
              onClick={() => openDeleteModal(map.id, map.name)}
              className="px-3 py-1.5 bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 text-sm rounded hover:bg-red-200 dark:hover:bg-red-800 cursor-pointer"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );

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

        {/* Migration Prompt */}
        {localMaps.length > 0 && !migrationDismissed && (
          <MigrationPrompt
            localMaps={localMaps}
            onMigrationComplete={() => {
              setLocalMaps([]);
              window.location.reload();
            }}
            onDismiss={() => setMigrationDismissed(true)}
          />
        )}

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
                  disabled={isCreating}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateMap}
                  disabled={isCreating}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer disabled:opacity-50"
                >
                  {isCreating ? "Creating..." : "Create Map"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Map Modal */}
        {deleteModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600 dark:text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    Delete Map
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    This action cannot be undone
                  </p>
                </div>
              </div>

              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
                <p className="text-sm text-red-800 dark:text-red-200">
                  You are about to permanently delete <strong>"{deleteModal.name}"</strong> and all its data including tokens, drawings, and shared access.
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Type <span className="font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{deleteModal.name}</span> to confirm
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Enter map name"
                  className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  autoFocus
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={closeDeleteModal}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting || deleteConfirmText !== deleteModal.name}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeleting ? "Deleting..." : "Delete Map"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* My Maps Section */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
            My Maps
          </h2>
          {owned.length === 0 ? (
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
              {owned.map((map) => renderMapCard(map, true))}
            </div>
          )}
        </section>

        {/* Shared with Me Section */}
        {shared.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
              Shared with Me
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {shared.map((map) => renderMapCard(map, false))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
