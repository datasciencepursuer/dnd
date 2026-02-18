import type { Route } from "./+types/g.$groupId";
import { useState, useEffect, useMemo } from "react";
import { Link, Form, useNavigate, useLoaderData } from "react-router";
import { redirect } from "react-router";
import {
  createNewMap,
  DEFAULT_GRID,
  getMapIndex,
  type MapIndexEntry,
} from "~/features/map-editor";
import type { CharacterSheet, Token } from "~/features/map-editor/types";
import { MigrationPrompt } from "~/features/map-editor/components/MigrationPrompt";
import { PatchNotesPanel } from "~/components/PatchNotesPanel";
import { GroupSwitcher } from "~/components/GroupSwitcher";
import { tierDisplayName, type AccountTier } from "~/lib/tier-limits";

interface MapListItem {
  id: string;
  name: string;
  userId: string;
  groupId: string | null;
  groupName: string | null;
  createdAt: string;
  updatedAt: string;
  permission: "dm" | "player";
  gridWidth: number;
  gridHeight: number;
  thumbnailUrl: string | null;
}

interface GroupInfo {
  id: string;
  name: string;
}

interface ImportableToken {
  id: string;
  name: string;
  imageUrl: string | null;
  color: string;
  size: number;
  layer: "character" | "monster" | "object";
  characterSheet: CharacterSheet | null;
  characterId: string | null;
  source: "library" | "map";
  sourceMapId?: string;
  sourceMapName?: string;
}

interface LoaderData {
  groupId: string;
  groupName: string;
  groupMaps: MapListItem[];
  personalMaps: MapListItem[];
  userGroups: GroupInfo[];
  userName: string;
  userRole: string;
  currentTier: AccountTier;
}

export function meta({ data }: Route.MetaArgs) {
  const loaderData = data as LoaderData | undefined;
  return [
    { title: loaderData?.groupName ? `${loaderData.groupName} - DnD` : "Maps - DnD" },
    { name: "description", content: "Group maps" },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { eq, desc, inArray, and, ne, isNull } = await import("drizzle-orm");
  const { db } = await import("~/.server/db");
  const { maps, groups, groupMembers, user } = await import("~/.server/db/schema");
  const { requireAuth } = await import("~/.server/auth/session");

  const session = await requireAuth(request);
  const userId = session.user.id;
  const { groupId } = params;

  // Verify user is a member of this group
  const membership = await db
    .select({ id: groupMembers.id, role: groupMembers.role })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .limit(1);

  if (membership.length === 0) {
    throw redirect("/maps");
  }

  const userRole = membership[0].role;

  // Get group info
  const groupData = await db
    .select({ id: groups.id, name: groups.name })
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);

  if (groupData.length === 0) {
    throw redirect("/maps");
  }

  // Update lastGroupId as side effect
  await db.update(user).set({ lastGroupId: groupId }).where(eq(user.id, userId));

  // Get all user's groups for switcher
  const userGroupMemberships = await db
    .select({ groupId: groupMembers.groupId })
    .from(groupMembers)
    .where(eq(groupMembers.userId, userId));

  const allGroupIds = userGroupMemberships.map((g) => g.groupId);

  const userGroups = allGroupIds.length > 0
    ? await db
        .select({ id: groups.id, name: groups.name })
        .from(groups)
        .where(inArray(groups.id, allGroupIds))
    : [];

  // Get maps for this group (all maps in the group)
  const groupMapsData = await db
    .select({
      id: maps.id,
      name: maps.name,
      userId: maps.userId,
      groupId: maps.groupId,
      createdAt: maps.createdAt,
      updatedAt: maps.updatedAt,
      data: maps.data,
    })
    .from(maps)
    .where(eq(maps.groupId, groupId))
    .orderBy(desc(maps.updatedAt));

  // Get user's personal maps (no group)
  const personalMapsData = await db
    .select({
      id: maps.id,
      name: maps.name,
      userId: maps.userId,
      groupId: maps.groupId,
      createdAt: maps.createdAt,
      updatedAt: maps.updatedAt,
      data: maps.data,
    })
    .from(maps)
    .where(and(eq(maps.userId, userId), isNull(maps.groupId)))
    .orderBy(desc(maps.updatedAt));

  const getMapPreviewData = (data: unknown) => {
    const mapData = data as {
      grid?: { width?: number; height?: number };
      background?: { imageUrl?: string } | null;
    } | null;
    return {
      gridWidth: mapData?.grid?.width ?? 20,
      gridHeight: mapData?.grid?.height ?? 15,
      thumbnailUrl: mapData?.background?.imageUrl ?? null,
    };
  };

  return {
    groupId,
    groupName: groupData[0].name,
    groupMaps: groupMapsData.map((m) => {
      const { gridWidth, gridHeight, thumbnailUrl } = getMapPreviewData(m.data);
      return {
        id: m.id,
        name: m.name,
        userId: m.userId,
        groupId: m.groupId,
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
        permission: (m.userId === userId ? "dm" : "player") as "dm" | "player",
        groupName: groupData[0].name,
        gridWidth,
        gridHeight,
        thumbnailUrl,
      };
    }),
    personalMaps: personalMapsData.map((m) => {
      const { gridWidth, gridHeight, thumbnailUrl } = getMapPreviewData(m.data);
      return {
        id: m.id,
        name: m.name,
        userId: m.userId,
        groupId: m.groupId,
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
        permission: "dm" as const,
        groupName: null,
        gridWidth,
        gridHeight,
        thumbnailUrl,
      };
    }),
    userGroups,
    userName: session.user.name,
    userRole,
    currentTier: await (await import("~/.server/subscription")).getUserTier(userId),
  };
}

export default function GroupMaps() {
  const navigate = useNavigate();
  const { groupId, groupName, groupMaps, personalMaps, userGroups, userName, userRole, currentTier } =
    useLoaderData<LoaderData>();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newMapName, setNewMapName] = useState("Untitled Map");
  const [gridWidth, setGridWidth] = useState(DEFAULT_GRID.width);
  const [gridHeight, setGridHeight] = useState(DEFAULT_GRID.height);
  const [isCreating, setIsCreating] = useState(false);
  const [localMaps, setLocalMaps] = useState<MapIndexEntry[]>([]);
  const [migrationDismissed, setMigrationDismissed] = useState(false);

  // Token import state
  const [availableTokens, setAvailableTokens] = useState<ImportableToken[]>([]);
  const [selectedTokenIds, setSelectedTokenIds] = useState<Set<string>>(new Set());
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [showAllLayers, setShowAllLayers] = useState(false);

  // Delete modal state
  const [deleteModal, setDeleteModal] = useState<{ id: string; name: string } | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [revealedThumbnails, setRevealedThumbnails] = useState<Set<string>>(new Set());

  // Check for localStorage maps on mount
  useEffect(() => {
    const maps = getMapIndex();
    setLocalMaps(maps);
  }, []);

  // Fetch available tokens for this group
  useEffect(() => {
    const fetchTokens = async () => {
      setIsLoadingTokens(true);
      try {
        const url = showAllLayers
          ? `/api/groups/${groupId}/tokens?all=true`
          : `/api/groups/${groupId}/tokens`;
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          setAvailableTokens(data.tokens || []);
        }
      } catch (error) {
        console.error("Failed to fetch tokens:", error);
      } finally {
        setIsLoadingTokens(false);
      }
    };

    fetchTokens();
  }, [groupId, showAllLayers]);

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

    // Add imported tokens with new positions
    if (selectedTokenIds.size > 0) {
      const tokensToImport = availableTokens.filter((t) => selectedTokenIds.has(t.id));
      let col = 1;
      let row = 1;
      const maxCol = Math.floor(width / 2);

      map.tokens = tokensToImport.map((t): Token => {
        const token: Token = {
          id: crypto.randomUUID(),
          name: t.name,
          imageUrl: t.imageUrl,
          color: t.color,
          size: t.size,
          position: { col, row },
          rotation: 0,
          flipped: false,
          visible: true,
          layer: t.layer,
          ownerId: null,
          characterSheet: t.characterSheet,
          characterId: t.characterId || null,
          monsterGroupId: null,
        };

        col += t.size + 1;
        if (col > maxCol) {
          col = 1;
          row += 2;
        }

        return token;
      });
    }

    try {
      const response = await fetch("/api/maps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: map.name,
          data: map,
          groupId: groupId,
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
    setSelectedTokenIds(new Set());
    setShowAllLayers(false);
    setShowCreateModal(true);
  };

  const toggleTokenSelection = (tokenId: string) => {
    setSelectedTokenIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(tokenId)) {
        newSet.delete(tokenId);
      } else {
        newSet.add(tokenId);
      }
      return newSet;
    });
  };

  const selectAllTokens = () => {
    setSelectedTokenIds(new Set(availableTokens.map((t) => t.id)));
  };

  const deselectAllTokens = () => {
    setSelectedTokenIds(new Set());
  };

  const renderMapCard = (map: MapListItem, canDelete: boolean) => (
    <div
      key={map.id}
      className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden"
    >
      <div className="h-32 bg-gray-200 dark:bg-gray-700 flex items-center justify-center relative overflow-hidden">
        {map.thumbnailUrl ? (
          <div
            className="w-full h-full cursor-pointer"
            onClick={() => setRevealedThumbnails((prev) => {
              const next = new Set(prev);
              if (next.has(map.id)) next.delete(map.id);
              else next.add(map.id);
              return next;
            })}
          >
            <img src={map.thumbnailUrl} alt={map.name} className={`w-full h-full object-cover transition-all duration-300 ${revealedThumbnails.has(map.id) ? "" : "blur-sm"}`} />
            {!revealedThumbnails.has(map.id) && (
              <span className="absolute inset-0 flex items-center justify-center text-white text-sm font-medium opacity-0 hover:opacity-100 transition-opacity bg-black/30">
                Spoilers! Click to reveal
              </span>
            )}
          </div>
        ) : (
          <span className="text-4xl">🗺️</span>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold text-gray-900 dark:text-white truncate">
            {map.name}
          </h3>
          <span
            className={`text-xs px-2 py-0.5 rounded flex-shrink-0 ${
              map.permission === "dm"
                ? "bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300"
                : "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
            }`}
          >
            {map.permission === "dm" ? "DM" : "Player"}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-3">
          <span>{map.gridWidth}x{map.gridHeight}</span>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <span suppressHydrationWarning>Updated {new Date(map.updatedAt).toLocaleDateString()}</span>
        </div>
        <div className="flex gap-2">
          <Link
            to={`/playground/${map.id}`}
            className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded text-center hover:bg-blue-700 cursor-pointer"
          >
            Play
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
    <div className="min-h-screen max-lg:h-full max-lg:overflow-auto bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              Hello, {userName}
              <Link
                to="/pricing"
                className={`text-xs px-2 py-0.5 rounded font-medium ${
                  currentTier === "free"
                    ? "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                    : currentTier === "adventurer"
                      ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
                      : "bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300"
                }`}
              >
                {tierDisplayName(currentTier)}
              </Link>
            </h1>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-4">
            <GroupSwitcher
              currentGroupId={groupId}
              groups={userGroups}
            />
            <Link
              to="/characters"
              className="px-3 py-1.5 sm:px-4 sm:py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              My Characters
            </Link>
            <Link
              to="/groups"
              className="px-3 py-1.5 sm:px-4 sm:py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Manage Groups
            </Link>
            <Link
              to="/settings"
              className="px-3 py-1.5 sm:px-4 sm:py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Settings
            </Link>
            <Form method="post" action="/logout">
              <button
                type="submit"
                className="px-3 py-1.5 sm:px-4 sm:py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-600 cursor-pointer"
              >
                Logout
              </button>
            </Form>
          </div>
        </div>

        {/* Patch Notes */}
        <PatchNotesPanel />

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

                {/* Group is locked to current group */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Group
                  </label>
                  <div className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-white">
                    {groupName}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Map will be created in this group. Use <Link to="/maps" className="text-blue-600 dark:text-blue-400 hover:underline">Personal Maps</Link> for ungrouped maps.
                  </p>
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

                {/* Token Import Section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Import Units from Group
                    </label>
                    <label className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showAllLayers}
                        onChange={(e) => setShowAllLayers(e.target.checked)}
                        className="rounded border-gray-300 dark:border-gray-600"
                      />
                      Show all types
                    </label>
                  </div>

                  {isLoadingTokens ? (
                    <div className="text-sm text-gray-500 dark:text-gray-400 py-2">
                      Loading units...
                    </div>
                  ) : availableTokens.length === 0 ? (
                    <div className="text-sm text-gray-500 dark:text-gray-400 py-2">
                      No {showAllLayers ? "units" : "characters"} found in group maps.
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-2 mb-2">
                        <button
                          type="button"
                          onClick={selectAllTokens}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                        >
                          Select all
                        </button>
                        <button
                          type="button"
                          onClick={deselectAllTokens}
                          className="text-xs text-gray-500 dark:text-gray-400 hover:underline cursor-pointer"
                        >
                          Clear
                        </button>
                        {selectedTokenIds.size > 0 && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
                            {selectedTokenIds.size} selected
                          </span>
                        )}
                      </div>
                      <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded">
                        {availableTokens.map((token) => (
                          <label
                            key={token.id}
                            className={`flex items-center gap-2 p-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${
                              selectedTokenIds.has(token.id)
                                ? "bg-blue-50 dark:bg-blue-900/20"
                                : ""
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedTokenIds.has(token.id)}
                              onChange={() => toggleTokenSelection(token.id)}
                              className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
                            />
                            {token.imageUrl ? (
                              <img
                                src={token.imageUrl}
                                alt=""
                                className="w-6 h-6 rounded-full object-cover"
                              />
                            ) : (
                              <div
                                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                                style={{ backgroundColor: token.color }}
                              >
                                {token.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <span className="text-sm text-gray-900 dark:text-white flex-1 truncate">
                              {token.name}
                            </span>
                            {token.source === "library" && (
                              <span className="text-xs px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded">
                                Shared
                              </span>
                            )}
                            {token.characterSheet && (
                              <span className="text-xs px-1.5 py-0.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded">
                                Sheet
                              </span>
                            )}
                          </label>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Selected units will be imported with their stats.
                      </p>
                    </>
                  )}
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

        {/* Group Maps Section */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
              <span className="text-gray-400 dark:text-gray-500">Groups</span>
              <span className="text-gray-300 dark:text-gray-600 mx-1.5">/</span>
              {groupName} Maps
            </h2>
            <span className={`text-xs px-2 py-0.5 rounded ${
              userRole === "owner"
                ? "bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300"
                : userRole === "admin"
                  ? "bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
            }`}>
              {userRole}
            </span>
            <div className="ml-auto flex gap-2">
              <Link
                to={`/g/${groupId}/schedule`}
                className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Schedule
              </Link>
              <button
                onClick={handleOpenModal}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
              >
                + New Map
              </button>
            </div>
          </div>
          {groupMaps.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                No maps in this group yet. Create your first map!
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
              {groupMaps.map((map) => renderMapCard(map, map.permission === "dm"))}
            </div>
          )}
        </section>

        {/* Personal Maps Section */}
        {personalMaps.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                Personal Maps
              </h2>
              <Link
                to="/maps"
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                View all
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {personalMaps.slice(0, 3).map((map) => renderMapCard(map, true))}
            </div>
            {personalMaps.length > 3 && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                +{personalMaps.length - 3} more personal maps.{" "}
                <Link to="/maps" className="text-blue-600 dark:text-blue-400 hover:underline">
                  View all
                </Link>
              </p>
            )}
          </section>
        )}

        <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-8">
          Found a bug?{" "}
          <a
            href="mailto:will.gao@gtechnology.ca"
            className="text-blue-500 dark:text-blue-400 hover:underline"
          >
            will.gao@gtechnology.ca
          </a>
        </p>
      </div>
    </div>
  );
}
