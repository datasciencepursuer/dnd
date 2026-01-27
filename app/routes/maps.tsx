import type { Route } from "./+types/maps";
import { useState, useEffect, useMemo } from "react";
import { Link, Form, useNavigate, useLoaderData, useSearchParams } from "react-router";
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
  groupId: string | null;
  groupName: string | null;
  createdAt: string;
  updatedAt: string;
  permission: PermissionLevel;
}

interface GroupInfo {
  id: string;
  name: string;
}

interface LoaderData {
  owned: MapListItem[];
  group: MapListItem[];
  groups: GroupInfo[];
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "My Maps - DnD" },
    { name: "description", content: "View and manage your DnD maps" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { eq, desc, inArray, and, ne } = await import("drizzle-orm");
  const { db } = await import("~/.server/db");
  const { maps, groups, groupMembers } = await import("~/.server/db/schema");
  const { requireAuth } = await import("~/.server/auth/session");

  const session = await requireAuth(request);
  const userId = session.user.id;

  // Get user's group IDs
  const userGroups = await db
    .select({ groupId: groupMembers.groupId })
    .from(groupMembers)
    .where(eq(groupMembers.userId, userId));

  const groupIds = userGroups.map((g) => g.groupId);

  // Get maps where user is owner (including maps not in a group for backwards compatibility)
  const ownedMaps = await db
    .select({
      id: maps.id,
      name: maps.name,
      userId: maps.userId,
      groupId: maps.groupId,
      createdAt: maps.createdAt,
      updatedAt: maps.updatedAt,
    })
    .from(maps)
    .where(eq(maps.userId, userId))
    .orderBy(desc(maps.updatedAt));

  // Get maps from user's groups (where user is not the owner)
  let groupMapsData: typeof ownedMaps = [];
  if (groupIds.length > 0) {
    groupMapsData = await db
      .select({
        id: maps.id,
        name: maps.name,
        userId: maps.userId,
        groupId: maps.groupId,
        createdAt: maps.createdAt,
        updatedAt: maps.updatedAt,
      })
      .from(maps)
      .where(
        and(
          inArray(maps.groupId, groupIds),
          ne(maps.userId, userId)
        )
      )
      .orderBy(desc(maps.updatedAt));
  }

  // Get groups info for the response
  const groupsData =
    groupIds.length > 0
      ? await db
          .select({
            id: groups.id,
            name: groups.name,
          })
          .from(groups)
          .where(inArray(groups.id, groupIds))
      : [];

  // Build a map of group id to name
  const groupNameMap = Object.fromEntries(
    groupsData.map((g) => [g.id, g.name])
  );

  return {
    owned: ownedMaps.map((m) => ({
      ...m,
      permission: "owner" as const,
      groupName: m.groupId ? groupNameMap[m.groupId] : null,
    })),
    group: groupMapsData.map((m) => ({
      ...m,
      permission: "view" as const,
      groupName: m.groupId ? groupNameMap[m.groupId] : null,
    })),
    groups: groupsData,
  };
}

export default function Maps() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { owned, group: groupMaps, groups } = useLoaderData<LoaderData>();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newMapName, setNewMapName] = useState("Untitled Map");
  const [gridWidth, setGridWidth] = useState(DEFAULT_GRID.width);
  const [gridHeight, setGridHeight] = useState(DEFAULT_GRID.height);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);
  const [localMaps, setLocalMaps] = useState<MapIndexEntry[]>([]);
  const [migrationDismissed, setMigrationDismissed] = useState(false);

  // Filter state
  const activeFilter = searchParams.get("group") || "all";

  // Delete modal state
  const [deleteModal, setDeleteModal] = useState<{ id: string; name: string } | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Check for localStorage maps on mount
  useEffect(() => {
    const maps = getMapIndex();
    setLocalMaps(maps);
  }, []);

  // Filter maps based on active tab
  const filteredOwned = useMemo(() => {
    if (activeFilter === "all") return owned;
    if (activeFilter === "personal") return owned.filter((m) => !m.groupId);
    return owned.filter((m) => m.groupId === activeFilter);
  }, [owned, activeFilter]);

  const filteredGroupMaps = useMemo(() => {
    if (activeFilter === "all") return groupMaps;
    if (activeFilter === "personal") return [];
    return groupMaps.filter((m) => m.groupId === activeFilter);
  }, [groupMaps, activeFilter]);

  const handleFilterChange = (filter: string) => {
    if (filter === "all") {
      setSearchParams({});
    } else {
      setSearchParams({ group: filter });
    }
  };

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
        body: JSON.stringify({
          name: map.name,
          data: map,
          groupId: selectedGroupId || null,
        }),
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
    // Pre-select the active filter group if it's a specific group
    setSelectedGroupId(activeFilter !== "all" && activeFilter !== "personal" ? activeFilter : "");
    setShowCreateModal(true);
  };

  const renderMapCard = (map: MapListItem, canDelete: boolean) => (
    <div
      key={map.id}
      className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden"
    >
      <div className="h-32 bg-gray-200 dark:bg-gray-700 flex items-center justify-center relative">
        <span className="text-4xl">🗺️</span>
        {map.groupName && (
          <span className="absolute top-2 right-2 text-xs px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300">
            {map.groupName}
          </span>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold text-gray-900 dark:text-white truncate">
            {map.name}
          </h3>
          {map.permission !== "owner" && (
            <span
              className={`text-xs px-2 py-0.5 rounded flex-shrink-0 ${
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
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            My Maps
          </h1>
          <div className="flex gap-4">
            <Link
              to="/groups"
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Manage Groups
            </Link>
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

        {/* Group Filter Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => handleFilterChange("all")}
            className={`px-4 py-2 rounded text-sm font-medium cursor-pointer ${
              activeFilter === "all"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
            }`}
          >
            All
          </button>
          <button
            onClick={() => handleFilterChange("personal")}
            className={`px-4 py-2 rounded text-sm font-medium cursor-pointer ${
              activeFilter === "personal"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
            }`}
          >
            Personal
          </button>
          {groups.map((group) => (
            <button
              key={group.id}
              onClick={() => handleFilterChange(group.id)}
              className={`px-4 py-2 rounded text-sm font-medium cursor-pointer ${
                activeFilter === group.id
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
              }`}
            >
              {group.name}
            </button>
          ))}
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

                {groups.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Group (optional)
                    </label>
                    <select
                      value={selectedGroupId}
                      onChange={(e) => setSelectedGroupId(e.target.value)}
                      className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">Personal (no group)</option>
                      {groups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Group members can view maps in the group.
                    </p>
                  </div>
                )}

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
                  You are about to permanently delete <strong>"{deleteModal.name}"</strong> and all its data including tokens and drawings.
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
          {filteredOwned.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                {activeFilter === "all"
                  ? "No maps yet. Create your first map!"
                  : "No maps in this category."}
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
              {filteredOwned.map((map) => renderMapCard(map, true))}
            </div>
          )}
        </section>

        {/* Group Maps Section (maps from groups where user is not the owner) */}
        {filteredGroupMaps.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
              Group Maps
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredGroupMaps.map((map) => renderMapCard(map, false))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
