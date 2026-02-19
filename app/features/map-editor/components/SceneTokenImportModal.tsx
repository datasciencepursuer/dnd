import { useState, useCallback, useEffect, useRef } from "react";
import type { Token, MonsterGroup } from "../types";

interface SceneTokenImportModalProps {
  isOpen: boolean;
  tokens: Token[];
  monsterGroups: MonsterGroup[];
  sceneName: string;
  targetSceneName: string;
  onConfirm: (tokens: Token[], monsterGroups: MonsterGroup[]) => void;
  onSkip: () => void;
  onCancel: () => void;
}

export function SceneTokenImportModal({
  isOpen,
  tokens,
  monsterGroups,
  sceneName,
  targetSceneName,
  onConfirm,
  onSkip,
  onCancel,
}: SceneTokenImportModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  // Reset selection when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set());
    }
  }, [isOpen]);

  // Focus confirm button on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => confirmButtonRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Escape to cancel
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onCancel]);

  const toggleToken = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(tokens.map((t) => t.id)));
  }, [tokens]);

  const clearAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleConfirm = useCallback(() => {
    if (selectedIds.size === 0) return;

    // Build a mapping from old monsterGroupId -> new monsterGroupId
    const groupIdMap = new Map<string, string>();
    const newMonsterGroups: MonsterGroup[] = [];

    // Find which monster groups are needed for selected tokens
    for (const token of tokens) {
      if (!selectedIds.has(token.id)) continue;
      if (!token.monsterGroupId) continue;
      if (groupIdMap.has(token.monsterGroupId)) continue;

      const newGroupId = crypto.randomUUID();
      groupIdMap.set(token.monsterGroupId, newGroupId);

      const originalGroup = monsterGroups.find((g) => g.id === token.monsterGroupId);
      newMonsterGroups.push({
        id: newGroupId,
        name: originalGroup?.name ?? "Monster Group",
      });
    }

    // Clone selected tokens with new IDs
    const clonedTokens: Token[] = tokens
      .filter((t) => selectedIds.has(t.id))
      .map((t) => ({
        ...t,
        id: crypto.randomUUID(),
        visible: true,
        position: { col: 0, row: 0 },
        monsterGroupId: t.monsterGroupId
          ? groupIdMap.get(t.monsterGroupId) ?? null
          : null,
      }));

    onConfirm(clonedTokens, newMonsterGroups);
  }, [selectedIds, tokens, monsterGroups, onConfirm]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Import Tokens to {targetSceneName}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Select tokens from <span className="font-medium">{sceneName}</span> to carry over. They will be placed one-by-one on the canvas.
          </p>
        </div>

        {/* Select All / Clear All */}
        <div className="px-4 pt-3 pb-1 flex gap-2">
          <button
            type="button"
            onClick={selectAll}
            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
          >
            Select all
          </button>
          <span className="text-xs text-gray-400">|</span>
          <button
            type="button"
            onClick={clearAll}
            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
          >
            Clear all
          </button>
          <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
            {selectedIds.size} / {tokens.length} selected
          </span>
        </div>

        {/* Token list */}
        <div className="flex-1 overflow-y-auto px-4 py-2 min-h-0">
          {tokens.map((token) => (
            <label
              key={token.id}
              className="flex items-center gap-3 py-2 px-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedIds.has(token.id)}
                onChange={() => toggleToken(token.id)}
                className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              {/* Avatar */}
              {token.imageUrl ? (
                <img
                  src={token.imageUrl}
                  alt={token.name}
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div
                  className="w-8 h-8 rounded-full flex-shrink-0"
                  style={{ backgroundColor: token.color }}
                />
              )}
              {/* Name + badges */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {token.name}
                  </span>
                  {!token.visible && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300">
                      hidden
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                  {token.layer}
                  {token.characterId && " \u00b7 linked"}
                </span>
              </div>
            </label>
          ))}
          {tokens.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
              No tokens in this scene.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded font-medium cursor-pointer transition-colors bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="px-4 py-2 rounded font-medium cursor-pointer transition-colors bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            Skip
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            onClick={handleConfirm}
            disabled={selectedIds.size === 0}
            className="flex-1 px-4 py-2 rounded font-medium cursor-pointer transition-colors bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Import & Place ({selectedIds.size})
          </button>
        </div>
      </div>
    </div>
  );
}
