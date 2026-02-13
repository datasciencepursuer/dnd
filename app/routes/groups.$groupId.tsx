import type { Route } from "./+types/groups.$groupId";
import { useState } from "react";
import { Link, useLoaderData, useNavigate } from "react-router";
import type { GroupRole } from "~/types/group";

interface GroupMember {
  id: string;
  userId: string;
  role: GroupRole;
  joinedAt: string;
  userName: string;
  userEmail: string;
  userImage: string | null;
}

interface GroupInvitation {
  id: string;
  email: string;
  token: string;
  expiresAt: string;
  createdAt: string;
  invitedBy: string;
  invitedByName: string;
}

interface GroupData {
  id: string;
  name: string;
  description: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  mapCount: number;
  pendingInvitations: number;
}

interface LoaderData {
  group: GroupData;
  members: GroupMember[];
  userRole: GroupRole;
  canEdit: boolean;
  canDelete: boolean;
}

export function meta({ data }: Route.MetaArgs) {
  const loaderData = data as LoaderData | undefined;
  return [
    { title: loaderData?.group?.name ? `${loaderData.group.name} - DnD` : "Group - DnD" },
    { name: "description", content: "Group details" },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { eq, sql } = await import("drizzle-orm");
  const { db } = await import("~/.server/db");
  const { groups, maps, groupInvitations } = await import("~/.server/db/schema");
  const { requireAuth } = await import("~/.server/auth/session");
  const { requireGroupPermission, getGroupMembers } = await import(
    "~/.server/permissions/group-permissions"
  );

  const session = await requireAuth(request);
  const userId = session.user.id;
  const { groupId } = params;

  // Require at least view permission
  let access;
  try {
    access = await requireGroupPermission(groupId, userId, "view");
  } catch (e) {
    if (e instanceof Response && e.status === 403) {
      throw new Response("You don't have access to this group", { status: 403 });
    }
    throw e;
  }

  // Get group details
  const groupData = await db
    .select()
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);

  if (groupData.length === 0) {
    throw new Response("Group not found", { status: 404 });
  }

  const group = groupData[0];

  // Get members, map count, and pending invitations count
  const [members, mapCount, invitationCount] = await Promise.all([
    getGroupMembers(groupId),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(maps)
      .where(eq(maps.groupId, groupId)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(groupInvitations)
      .where(eq(groupInvitations.groupId, groupId)),
  ]);

  return {
    group: {
      id: group.id,
      name: group.name,
      description: group.description,
      createdBy: group.createdBy,
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString(),
      memberCount: members.length,
      mapCount: mapCount[0]?.count ?? 0,
      pendingInvitations: invitationCount[0]?.count ?? 0,
    },
    members: members.map((m) => ({
      ...m,
      joinedAt: m.joinedAt.toISOString(),
    })),
    userRole: access.role,
    canEdit: ["owner", "admin"].includes(access.role!),
    canDelete: access.role === "owner",
  };
}

export default function GroupDetail() {
  const { group, members, userRole, canEdit, canDelete } = useLoaderData<LoaderData>();
  const navigate = useNavigate();

  const [showEditModal, setShowEditModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [editName, setEditName] = useState(group.name);
  const [editDescription, setEditDescription] = useState(group.description || "");
  const [inviteEmail, setInviteEmail] = useState("");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<{ email: string; url: string } | null>(null);

  const handleEditGroup = async () => {
    if (!editName.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/groups/${group.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim() || null,
        }),
      });

      if (response.ok) {
        window.location.reload();
      } else {
        const result = await response.json();
        setError(result.error || "Failed to update group");
        setIsSubmitting(false);
      }
    } catch {
      setError("Failed to update group");
      setIsSubmitting(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;

    setIsSubmitting(true);
    setError(null);
    setInviteSuccess(null);

    try {
      const response = await fetch(`/api/groups/${group.id}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });

      const result = await response.json();

      if (response.ok) {
        setInviteSuccess({
          email: result.email,
          url: `${window.location.origin}${result.inviteUrl}`,
        });
        setInviteEmail("");
      } else {
        setError(result.error || "Failed to send invitation");
      }
    } catch {
      setError("Failed to send invitation");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLeave = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/groups/${group.id}/leave`, {
        method: "POST",
      });

      if (response.ok) {
        navigate("/groups");
      } else {
        const result = await response.json();
        setError(result.error || "Failed to leave group");
        setIsSubmitting(false);
      }
    } catch {
      setError("Failed to leave group");
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirmText !== group.name) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/groups/${group.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        navigate("/groups");
      } else {
        const result = await response.json();
        setError(result.error || "Failed to delete group");
        setIsSubmitting(false);
      }
    } catch {
      setError("Failed to delete group");
      setIsSubmitting(false);
    }
  };

  const handleRemoveMember = async (memberId: string, memberUserId: string) => {
    if (!confirm("Remove this member from the group?")) return;

    try {
      const response = await fetch(`/api/groups/${group.id}/members/${memberUserId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        window.location.reload();
      } else {
        const result = await response.json();
        alert(result.error || "Failed to remove member");
      }
    } catch {
      alert("Failed to remove member");
    }
  };

  const handleUpdateRole = async (memberUserId: string, newRole: string) => {
    try {
      const response = await fetch(`/api/groups/${group.id}/members/${memberUserId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      if (response.ok) {
        window.location.reload();
      } else {
        const result = await response.json();
        alert(result.error || "Failed to update role");
      }
    } catch {
      alert("Failed to update role");
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
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {group.name}
              </h1>
              {getRoleBadge(userRole)}
            </div>
            {group.description && (
              <p className="text-gray-500 dark:text-gray-400">{group.description}</p>
            )}
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
              <span>{group.memberCount} members</span>
              <span>{group.mapCount} maps</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              to="/groups"
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Back
            </Link>
            {canEdit && (
              <button
                onClick={() => setShowEditModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
              >
                Edit
              </button>
            )}
          </div>
        </div>

        {/* Members Section */}
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <h2 className="font-semibold text-gray-900 dark:text-white">Members</h2>
            {canEdit && (
              <button
                onClick={() => {
                  setShowInviteModal(true);
                  setInviteSuccess(null);
                  setError(null);
                }}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 cursor-pointer"
              >
                + Invite
              </button>
            )}
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {members.map((member) => (
              <div key={member.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                    {member.userImage ? (
                      <img
                        src={member.userImage}
                        alt={member.userName}
                        className="w-10 h-10 rounded-full"
                      />
                    ) : (
                      <span className="text-gray-500 dark:text-gray-400 font-semibold">
                        {member.userName.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {member.userName}
                      </span>
                      {getRoleBadge(member.role)}
                    </div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {member.userEmail}
                    </span>
                  </div>
                </div>
                {canEdit && member.role !== "owner" && (
                  <div className="flex items-center gap-2">
                    {userRole === "owner" && (
                      <select
                        value={member.role}
                        onChange={(e) => handleUpdateRole(member.userId, e.target.value)}
                        className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                    )}
                    <button
                      onClick={() => handleRemoveMember(member.id, member.userId)}
                      className="px-2 py-1 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Actions Section */}
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Actions</h2>
          <div className="flex flex-wrap gap-3">
            <Link
              to={`/g/${group.id}`}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              View Maps
            </Link>
            {userRole !== "owner" && (
              <button
                onClick={() => setShowLeaveModal(true)}
                className="px-4 py-2 text-red-600 border border-red-300 dark:border-red-800 rounded hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer"
              >
                Leave Group
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => setShowDeleteModal(true)}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 cursor-pointer"
              >
                Delete Group
              </button>
            )}
          </div>
        </section>

        {/* Edit Modal */}
        {showEditModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Edit Group
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
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    maxLength={100}
                    className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setError(null);
                  }}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditGroup}
                  disabled={isSubmitting || !editName.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Invite Modal */}
        {showInviteModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Invite to Group
              </h2>

              {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-300 text-sm">
                  {error}
                </div>
              )}

              {inviteSuccess && (
                <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded">
                  <p className="text-green-700 dark:text-green-300 text-sm mb-2">
                    Invitation created for {inviteSuccess.email}
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={inviteSuccess.url}
                      readOnly
                      className="flex-1 px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <button
                      onClick={() => navigator.clipboard.writeText(inviteSuccess.url)}
                      className="px-2 py-1 text-sm bg-gray-200 dark:bg-gray-600 rounded hover:bg-gray-300 dark:hover:bg-gray-500 cursor-pointer"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="friend@example.com"
                  className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  They'll receive a link to join this group.
                </p>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowInviteModal(false);
                    setInviteEmail("");
                    setError(null);
                    setInviteSuccess(null);
                  }}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer disabled:opacity-50"
                >
                  Close
                </button>
                <button
                  onClick={handleInvite}
                  disabled={isSubmitting || !inviteEmail.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? "Sending..." : "Send Invite"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Leave Modal */}
        {showLeaveModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Leave Group
              </h2>

              {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-300 text-sm">
                  {error}
                </div>
              )}

              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Are you sure you want to leave <strong>{group.name}</strong>? You will lose access to all maps in this group unless you have separate permissions.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowLeaveModal(false);
                    setError(null);
                  }}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLeave}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? "Leaving..." : "Leave Group"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center flex-shrink-0">
                  <svg className="h-5 w-5 text-red-600 dark:text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    Delete Group
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    This action cannot be undone
                  </p>
                </div>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-300 text-sm">
                  {error}
                </div>
              )}

              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
                <p className="text-sm text-red-800 dark:text-red-200">
                  You are about to permanently delete <strong>"{group.name}"</strong>. All members will be removed.
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Type <span className="font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{group.name}</span> to confirm
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Enter group name"
                  className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeleteConfirmText("");
                    setError(null);
                  }}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isSubmitting || deleteConfirmText !== group.name}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Deleting..." : "Delete Group"}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
