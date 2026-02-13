import type { Route } from "./+types/groups";
import { useState } from "react";
import { Link, useLoaderData, useNavigate } from "react-router";
import type { GroupRole } from "~/types/group";

interface GroupListItem {
  id: string;
  name: string;
  description: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  role: GroupRole;
  joinedAt: string;
  memberCount: number;
  mapCount: number;
}

interface LoaderData {
  groups: GroupListItem[];
  groupCount: number;
  maxGroups: number;
  canCreateGroup: boolean;
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "My Groups - DnD" },
    { name: "description", content: "Manage your groups" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { eq, sql } = await import("drizzle-orm");
  const { db } = await import("~/.server/db");
  const { groupMembers, maps } = await import("~/.server/db/schema");
  const { requireAuth } = await import("~/.server/auth/session");
  const { getUserGroups, getUserGroupCount, MAX_GROUPS_PER_USER } = await import(
    "~/.server/permissions/group-permissions"
  );

  const session = await requireAuth(request);
  const userId = session.user.id;

  // Get user's groups with member and map counts
  const userGroups = await getUserGroups(userId);

  // Get member counts and map counts for each group
  const groupsWithCounts = await Promise.all(
    userGroups.map(async (group) => {
      const [memberCount, mapCount] = await Promise.all([
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(groupMembers)
          .where(eq(groupMembers.groupId, group.id)),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(maps)
          .where(eq(maps.groupId, group.id)),
      ]);

      return {
        ...group,
        memberCount: memberCount[0]?.count ?? 0,
        mapCount: mapCount[0]?.count ?? 0,
      };
    })
  );

  const groupCount = await getUserGroupCount(userId);

  return {
    groups: groupsWithCounts,
    groupCount,
    maxGroups: MAX_GROUPS_PER_USER,
    canCreateGroup: groupCount < MAX_GROUPS_PER_USER,
  };
}

export default function Groups() {
  const { groups, groupCount, maxGroups, canCreateGroup } = useLoaderData<LoaderData>();
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateGroup = async () => {
    if (!groupName.trim()) return;

    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: groupName.trim(),
          description: groupDescription.trim() || null,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        navigate(`/groups/${result.id}`);
      } else {
        setError(result.error || "Failed to create group");
        setIsCreating(false);
      }
    } catch {
      setError("Failed to create group");
      setIsCreating(false);
    }
  };

  const getRoleBadge = (role: GroupRole) => {
    const colors = {
      owner: "bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300",
      admin: "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300",
      member: "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300",
    };
    return (
      <span className={`text-xs px-2 py-0.5 rounded ${colors[role]}`}>
        {role}
      </span>
    );
  };

  return (
    <div className="min-h-screen max-lg:h-full max-lg:overflow-auto bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              My Groups
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {groupCount} of {maxGroups} groups
            </p>
          </div>
          <div className="flex gap-4">
            <Link
              to="/"
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Back to Maps
            </Link>
            <button
              onClick={() => setShowCreateModal(true)}
              disabled={!canCreateGroup}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title={!canCreateGroup ? `You can only be in ${maxGroups} groups` : undefined}
            >
              + New Group
            </button>
          </div>
        </div>

        {/* Create Group Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Create New Group
              </h2>

              {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-300 text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Group Name
                  </label>
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="e.g., Dragon Slayers"
                    maxLength={100}
                    className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description (optional)
                  </label>
                  <textarea
                    value={groupDescription}
                    onChange={(e) => setGroupDescription(e.target.value)}
                    placeholder="A brief description of your group..."
                    rows={3}
                    className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setGroupName("");
                    setGroupDescription("");
                    setError(null);
                  }}
                  disabled={isCreating}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateGroup}
                  disabled={isCreating || !groupName.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer disabled:opacity-50"
                >
                  {isCreating ? "Creating..." : "Create Group"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Groups List */}
        {groups.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No groups yet
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Create a group to share maps with your friends or party members.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
            >
              Create Your First Group
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {groups.map((group) => (
              <Link
                key={group.id}
                to={`/groups/${group.id}`}
                className="block bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white text-lg">
                      {group.name}
                    </h3>
                    {getRoleBadge(group.role)}
                  </div>
                  {group.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">
                      {group.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                      </svg>
                      {group.memberCount} {group.memberCount === 1 ? "member" : "members"}
                    </span>
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                      {group.mapCount} {group.mapCount === 1 ? "map" : "maps"}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
