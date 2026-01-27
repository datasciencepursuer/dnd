import { useState, useEffect } from "react";
import type { PermissionLevel } from "~/.server/db/schema";
import { type PlayerPermissions, DEFAULT_PERMISSIONS } from "../../types";

interface Share {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  permission: PermissionLevel;
  customPermissions: PlayerPermissions | null;
  createdAt: string;
}

interface Invitation {
  id: string;
  email: string;
  permission: PermissionLevel;
  expiresAt: string;
  createdAt: string;
}

interface ShareDialogProps {
  mapId: string;
  onClose: () => void;
}

export function ShareDialog({ mapId, onClose }: ShareDialogProps) {
  const [shares, setShares] = useState<Share[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState<"view" | "edit">("view");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  // Transfer ownership state
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferUserId, setTransferUserId] = useState("");
  const [keepAccess, setKeepAccess] = useState(true);
  const [isTransferring, setIsTransferring] = useState(false);

  // Permission editing state
  const [editingShare, setEditingShare] = useState<Share | null>(null);
  const [editingPermissions, setEditingPermissions] = useState<PlayerPermissions | null>(null);
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);

  const loadShares = async () => {
    try {
      const response = await fetch(`/api/maps/${mapId}/share`);
      if (!response.ok) throw new Error("Failed to load shares");
      const data = await response.json();
      setShares(data.shares);
      setInvitations(data.invitations);
    } catch (e) {
      setError("Failed to load sharing information");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadShares();
  }, [mapId]);

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsSubmitting(true);
    setError(null);
    setInviteLink(null);

    try {
      const response = await fetch(`/api/maps/${mapId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), permission }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Failed to share map");
      }

      const data = await response.json();

      if (data.type === "invitation" && data.token) {
        const link = `${window.location.origin}/invite/${data.token}`;
        setInviteLink(link);
      }

      setEmail("");
      await loadShares();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to share map");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveShare = async (shareId: string) => {
    if (!confirm("Remove this user's access?")) return;

    try {
      const response = await fetch(`/api/maps/${mapId}/share`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareId }),
      });

      if (!response.ok) throw new Error("Failed to remove share");
      await loadShares();
    } catch (e) {
      setError("Failed to remove share");
    }
  };

  const handleRemoveInvitation = async (invitationId: string) => {
    if (!confirm("Cancel this invitation?")) return;

    try {
      const response = await fetch(`/api/maps/${mapId}/share`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId }),
      });

      if (!response.ok) throw new Error("Failed to remove invitation");
      await loadShares();
    } catch (e) {
      setError("Failed to remove invitation");
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferUserId) return;

    if (
      !confirm(
        "Are you sure you want to transfer ownership? This action cannot be undone."
      )
    ) {
      return;
    }

    setIsTransferring(true);
    setError(null);

    try {
      const response = await fetch(`/api/maps/${mapId}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newOwnerId: transferUserId,
          keepAccess,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Failed to transfer ownership");
      }

      // Redirect to maps page since user is no longer owner
      window.location.href = "/maps";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to transfer ownership");
    } finally {
      setIsTransferring(false);
    }
  };

  const copyInviteLink = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
    }
  };

  const openPermissionEditor = (share: Share) => {
    setEditingShare(share);
    // Use custom permissions if set, otherwise use defaults for the permission level
    const perms = share.customPermissions || DEFAULT_PERMISSIONS[share.permission as "view" | "edit"];
    setEditingPermissions({ ...perms });
  };

  const closePermissionEditor = () => {
    setEditingShare(null);
    setEditingPermissions(null);
  };

  const handlePermissionToggle = (key: keyof PlayerPermissions) => {
    if (!editingPermissions) return;
    setEditingPermissions((prev) => prev ? { ...prev, [key]: !prev[key] } : null);
  };

  const handleSavePermissions = async () => {
    if (!editingShare || !editingPermissions) return;

    setIsSavingPermissions(true);
    setError(null);

    try {
      const response = await fetch(`/api/maps/${mapId}/share`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shareId: editingShare.id,
          customPermissions: editingPermissions,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save permissions");
      }

      await loadShares();
      closePermissionEditor();
    } catch (e) {
      setError("Failed to save permissions");
    } finally {
      setIsSavingPermissions(false);
    }
  };

  const handleResetToDefaults = () => {
    if (!editingShare) return;
    const defaults = DEFAULT_PERMISSIONS[editingShare.permission as "view" | "edit"];
    setEditingPermissions({ ...defaults });
  };

  const handleChangeBasePermission = async (shareId: string, newPermission: "view" | "edit") => {
    try {
      const response = await fetch(`/api/maps/${mapId}/share`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shareId,
          permission: newPermission,
          customPermissions: null, // Reset custom permissions when changing base level
        }),
      });

      if (!response.ok) throw new Error("Failed to update permission");
      await loadShares();
    } catch (e) {
      setError("Failed to update permission");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Share Map
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 cursor-pointer"
            >
              <span className="text-2xl">&times;</span>
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded">
              {error}
            </div>
          )}

          {/* Share by email form */}
          <form onSubmit={handleShare} className="mb-6">
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter email address"
                className="flex-1 px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                disabled={isSubmitting}
              />
              <select
                value={permission}
                onChange={(e) =>
                  setPermission(e.target.value as "view" | "edit")
                }
                className="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                disabled={isSubmitting}
              >
                <option value="view">Can view</option>
                <option value="edit">Can edit</option>
              </select>
              <button
                type="submit"
                disabled={isSubmitting || !email.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? "..." : "Share"}
              </button>
            </div>
          </form>

          {/* Invite link display */}
          {inviteLink && (
            <div className="mb-6 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded">
              <p className="text-sm text-green-700 dark:text-green-300 mb-2">
                User doesn't have an account yet. Share this invite link:
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inviteLink}
                  readOnly
                  className="flex-1 px-3 py-1 text-sm rounded border border-green-300 dark:border-green-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <button
                  onClick={copyInviteLink}
                  className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 cursor-pointer"
                >
                  Copy
                </button>
              </div>
            </div>
          )}

          {/* Current shares */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              People with access
            </h3>
            {isLoading ? (
              <p className="text-gray-500 dark:text-gray-400">Loading...</p>
            ) : shares.length === 0 && invitations.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">
                No one else has access to this map.
              </p>
            ) : (
              <div className="space-y-2">
                {shares.map((share) => (
                  <div
                    key={share.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded"
                  >
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {share.userName}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {share.userEmail}
                      </p>
                      {share.customPermissions && (
                        <p className="text-xs text-purple-600 dark:text-purple-400">
                          Custom permissions
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={share.permission}
                        onChange={(e) =>
                          handleChangeBasePermission(share.id, e.target.value as "view" | "edit")
                        }
                        className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      >
                        <option value="view">Can view</option>
                        <option value="edit">Can edit</option>
                      </select>
                      <button
                        onClick={() => openPermissionEditor(share)}
                        className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded hover:bg-purple-200 dark:hover:bg-purple-800 cursor-pointer"
                      >
                        Configure
                      </button>
                      <button
                        onClick={() => handleRemoveShare(share.id)}
                        className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}

                {invitations.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded"
                  >
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {invite.email}
                      </p>
                      <p className="text-sm text-yellow-600 dark:text-yellow-400">
                        Pending invitation (expires{" "}
                        {new Date(invite.expiresAt).toLocaleDateString()})
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          invite.permission === "edit"
                            ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
                            : "bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300"
                        }`}
                      >
                        {invite.permission}
                      </span>
                      <button
                        onClick={() => handleRemoveInvitation(invite.id)}
                        className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Transfer ownership section */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <button
              onClick={() => setShowTransfer(!showTransfer)}
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white cursor-pointer"
            >
              {showTransfer ? "▼" : "▶"} Transfer ownership
            </button>

            {showTransfer && (
              <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Transfer ownership of this map to another user. You can
                  optionally keep edit access.
                </p>
                {shares.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Share this map with someone first before transferring
                    ownership.
                  </p>
                ) : (
                  <form onSubmit={handleTransfer} className="space-y-3">
                    <select
                      value={transferUserId}
                      onChange={(e) => setTransferUserId(e.target.value)}
                      className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      disabled={isTransferring}
                    >
                      <option value="">Select new owner...</option>
                      {shares.map((share) => (
                        <option key={share.userId} value={share.userId}>
                          {share.userName} ({share.userEmail})
                        </option>
                      ))}
                    </select>

                    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <input
                        type="checkbox"
                        checked={keepAccess}
                        onChange={(e) => setKeepAccess(e.target.checked)}
                        disabled={isTransferring}
                        className="rounded"
                      />
                      Keep edit access after transfer
                    </label>

                    <button
                      type="submit"
                      disabled={isTransferring || !transferUserId}
                      className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 cursor-pointer"
                    >
                      {isTransferring ? "Transferring..." : "Transfer Ownership"}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Permission Editor Modal */}
      {editingShare && editingPermissions && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-60">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Permissions for {editingShare.userName}
                </h3>
                <button
                  onClick={closePermissionEditor}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 cursor-pointer"
                >
                  <span className="text-xl">&times;</span>
                </button>
              </div>

              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Base role: <span className="font-medium">{editingShare.permission}</span>
              </p>

              <div className="space-y-4">
                {/* Token Permissions */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Token Permissions
                  </h4>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <input
                        type="checkbox"
                        checked={editingPermissions.canCreateTokens}
                        onChange={() => handlePermissionToggle("canCreateTokens")}
                        className="rounded"
                      />
                      Can create tokens
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <input
                        type="checkbox"
                        checked={editingPermissions.canEditOwnTokens}
                        onChange={() => handlePermissionToggle("canEditOwnTokens")}
                        className="rounded"
                      />
                      Can edit own tokens
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <input
                        type="checkbox"
                        checked={editingPermissions.canEditAllTokens}
                        onChange={() => handlePermissionToggle("canEditAllTokens")}
                        className="rounded"
                      />
                      Can edit all tokens
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <input
                        type="checkbox"
                        checked={editingPermissions.canMoveOwnTokens}
                        onChange={() => handlePermissionToggle("canMoveOwnTokens")}
                        className="rounded"
                      />
                      Can move own tokens
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <input
                        type="checkbox"
                        checked={editingPermissions.canMoveAllTokens}
                        onChange={() => handlePermissionToggle("canMoveAllTokens")}
                        className="rounded"
                      />
                      Can move all tokens
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <input
                        type="checkbox"
                        checked={editingPermissions.canDeleteOwnTokens}
                        onChange={() => handlePermissionToggle("canDeleteOwnTokens")}
                        className="rounded"
                      />
                      Can delete own tokens
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <input
                        type="checkbox"
                        checked={editingPermissions.canDeleteAllTokens}
                        onChange={() => handlePermissionToggle("canDeleteAllTokens")}
                        className="rounded"
                      />
                      Can delete all tokens
                    </label>
                  </div>
                </div>

                {/* Map Permissions */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Map Permissions
                  </h4>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <input
                        type="checkbox"
                        checked={editingPermissions.canViewMap}
                        onChange={() => handlePermissionToggle("canViewMap")}
                        className="rounded"
                      />
                      Can view map
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <input
                        type="checkbox"
                        checked={editingPermissions.canEditMap}
                        onChange={() => handlePermissionToggle("canEditMap")}
                        className="rounded"
                      />
                      Can edit map (grid, background, etc.)
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <input
                        type="checkbox"
                        checked={editingPermissions.canManagePlayers}
                        onChange={() => handlePermissionToggle("canManagePlayers")}
                        className="rounded"
                      />
                      Can manage players
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  onClick={handleResetToDefaults}
                  className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 cursor-pointer"
                >
                  Reset to Defaults
                </button>
                <button
                  onClick={handleSavePermissions}
                  disabled={isSavingPermissions}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                >
                  {isSavingPermissions ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
