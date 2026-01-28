import { useState, useEffect } from "react";
import { useMapStore } from "../store";
import { TOKEN_COLORS } from "../constants";
import type { Token, TokenLayer } from "../types";

interface GroupMemberInfo {
  id: string;
  name: string;
}

interface TokenEditDialogProps {
  token: Token;
  onClose: () => void;
  groupMembers?: GroupMemberInfo[];
  canAssignOwner?: boolean;
  onSave?: () => void;
}

export function TokenEditDialog({
  token,
  onClose,
  groupMembers = [],
  canAssignOwner = false,
  onSave,
}: TokenEditDialogProps) {
  const updateToken = useMapStore((s) => s.updateToken);

  const [name, setName] = useState(token.name);
  const [color, setColor] = useState(token.color);
  const [size, setSize] = useState(token.size);
  const [layer, setLayer] = useState<TokenLayer>(token.layer);
  const [visible, setVisible] = useState(token.visible);
  const [ownerId, setOwnerId] = useState<string | null>(token.ownerId);

  // Update local state if token changes
  useEffect(() => {
    setName(token.name);
    setColor(token.color);
    setSize(token.size);
    setLayer(token.layer);
    setVisible(token.visible);
    setOwnerId(token.ownerId);
  }, [token]);

  const handleSave = () => {
    updateToken(token.id, {
      name: name.trim() || "Unnamed Token",
      color,
      size,
      layer,
      visible,
      ownerId,
    });
    // Trigger immediate sync for real-time updates
    onSave?.();
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4"
        onKeyDown={handleKeyDown}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Edit Token
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 cursor-pointer"
          >
            <span className="text-2xl">&times;</span>
          </button>
        </div>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              autoFocus
            />
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Color
              {token.imageUrl && (
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                  (used for travel lines & drawing)
                </span>
              )}
            </label>
            <div className="flex flex-wrap gap-1">
              {TOKEN_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full border-2 cursor-pointer ${
                    color === c ? "border-blue-500" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Size */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Size
            </label>
            <div className="grid grid-cols-4 gap-1">
              {[1, 2, 3, 4].map((s) => (
                <button
                  key={s}
                  onClick={() => setSize(s)}
                  className={`px-2 py-1.5 text-sm rounded border cursor-pointer ${
                    size === s
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600"
                  }`}
                >
                  {s}x{s}
                </button>
              ))}
            </div>
          </div>

          {/* Layer */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Layer
            </label>
            <div className="grid grid-cols-3 gap-1">
              {(["character", "monster", "object"] as TokenLayer[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLayer(l)}
                  className={`px-2 py-1.5 text-sm rounded border cursor-pointer capitalize ${
                    layer === l
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Visibility */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="visible"
              checked={visible}
              onChange={(e) => setVisible(e.target.checked)}
              className="rounded"
            />
            <label
              htmlFor="visible"
              className="text-sm text-gray-700 dark:text-gray-300"
            >
              Visible on map
            </label>
          </div>

          {/* Owner - only shown if canAssignOwner and there are group members */}
          {canAssignOwner && groupMembers.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Owner
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                  (can move this token)
                </span>
              </label>
              <select
                value={ownerId || ""}
                onChange={(e) => setOwnerId(e.target.value || null)}
                className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">No owner (DM only)</option>
                {groupMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
