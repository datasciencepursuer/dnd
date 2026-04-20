import { useState, useRef, useEffect, useCallback } from "react";
import { useMapStore } from "../../store";
import { getAllScenes } from "../../utils/scene-utils";
import { MAX_SCENES } from "../../constants";
import type { SceneInfo } from "../../utils/scene-utils";
import type { Token, MonsterGroup } from "../../types";

interface SceneSelectorProps {
  onSwitchScene: (sceneId: string, importTokens?: Token[], importGroups?: MonsterGroup[]) => void;
  onCreateScene: (name: string) => void;
  onDeleteScene: (sceneId: string) => void;
  onRenameScene: (sceneId: string, newName: string) => void;
  onDuplicateScene: (sceneId: string) => void;
  maxScenes?: number;
}

export function SceneSelector({
  onSwitchScene,
  onCreateScene,
  onDeleteScene,
  onRenameScene,
  onDuplicateScene,
  maxScenes,
}: SceneSelectorProps) {
  const map = useMapStore((s) => s.map);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Inline token selection state
  const [selectedTokenIds, setSelectedTokenIds] = useState<Set<string>>(new Set());

  const scenes: SceneInfo[] = map ? getAllScenes(map) : [];
  const totalScenes = scenes.length;
  const effectiveMax = maxScenes ?? MAX_SCENES;
  const atLimit = totalScenes >= effectiveMax;

  const tokens = map?.tokens ?? [];
  const monsterGroups = map?.monsterGroups ?? [];

  // Reset token selection when active scene changes
  const activeSceneId = map?.activeSceneId;
  useEffect(() => {
    setSelectedTokenIds(new Set());
  }, [activeSceneId]);

  // Focus rename input when starting rename
  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  const handleCreate = () => {
    if (atLimit) return;
    onCreateScene(`Scene ${totalScenes + 1}`);
  };

  const handleStartRename = (scene: SceneInfo) => {
    setRenamingId(scene.id);
    setRenameValue(scene.name);
  };

  const handleCommitRename = () => {
    if (renamingId && renameValue.trim()) {
      onRenameScene(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  };

  const toggleToken = useCallback((id: string) => {
    setSelectedTokenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedTokenIds(new Set(tokens.map((t) => t.id)));
  }, [tokens]);

  const clearAll = useCallback(() => {
    setSelectedTokenIds(new Set());
  }, []);

  const handleSceneClick = useCallback((sceneId: string) => {
    if (selectedTokenIds.size === 0) {
      onSwitchScene(sceneId);
      return;
    }

    // Clone selected tokens with new IDs (same logic as SceneTokenImportModal)
    const groupIdMap = new Map<string, string>();
    const newMonsterGroups: MonsterGroup[] = [];

    for (const token of tokens) {
      if (!selectedTokenIds.has(token.id)) continue;
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

    const clonedTokens: Token[] = tokens
      .filter((t) => selectedTokenIds.has(t.id))
      .map((t) => ({
        ...t,
        id: crypto.randomUUID(),
        visible: true,
        position: { col: 0, row: 0 },
        monsterGroupId: t.monsterGroupId
          ? groupIdMap.get(t.monsterGroupId) ?? null
          : null,
      }));

    onSwitchScene(sceneId, clonedTokens, newMonsterGroups);
  }, [selectedTokenIds, tokens, monsterGroups, onSwitchScene]);

  return (
    <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Scenes</h3>
        <button
          onClick={handleCreate}
          disabled={atLimit}
          className="w-6 h-6 flex items-center justify-center rounded text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
          title={atLimit ? `Max ${effectiveMax} scenes` : "Add scene"}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
          </svg>
        </button>
      </div>

      <div ref={containerRef} className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {scenes.map((scene) => (
          <div key={scene.id} className="relative flex-shrink-0 group">
            {/* Scene card */}
            <button
              onClick={() => {
                if (renamingId) return;
                if (!scene.isActive) handleSceneClick(scene.id);
              }}
              className={`w-20 rounded-lg overflow-hidden border-2 transition-colors cursor-pointer ${
                scene.isActive
                  ? "border-blue-500 dark:border-blue-400"
                  : "border-gray-200 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-400"
              }`}
            >
              {/* Thumbnail */}
              <div className="w-full h-12 bg-gray-100 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
                {scene.backgroundUrl ? (
                  <img
                    src={scene.backgroundUrl}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-gray-300 dark:text-gray-500">
                    <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              {/* Label */}
              <div className="px-1 py-0.5">
                {renamingId === scene.id ? (
                  <input
                    ref={renameInputRef}
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={handleCommitRename}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCommitRename();
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                    className="w-full text-[10px] px-0.5 py-0 bg-white dark:bg-gray-700 border border-blue-400 rounded text-gray-800 dark:text-gray-200 outline-none"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="block text-[10px] text-gray-700 dark:text-gray-300 truncate text-center leading-tight">
                    {scene.name}
                  </span>
                )}
                <span className="block text-[9px] text-gray-400 dark:text-gray-500 text-center">
                  {scene.tokenCount} token{scene.tokenCount !== 1 ? "s" : ""}
                </span>
              </div>
            </button>

            {/* Action icons overlaid on scene card — always visible on touch, hover-reveal on desktop */}
            {renamingId !== scene.id && (
              <div className="absolute top-0.5 right-0.5 left-0.5 flex items-center justify-end gap-0.5 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity pointer-events-none">
                <button
                  onClick={(e) => { e.stopPropagation(); handleStartRename(scene); }}
                  className="pointer-events-auto w-5 h-5 flex items-center justify-center rounded bg-black/60 text-white hover:bg-black/80 cursor-pointer"
                  title="Rename scene"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                    <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
                  </svg>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); if (!atLimit) onDuplicateScene(scene.id); }}
                  disabled={atLimit}
                  className="pointer-events-auto w-5 h-5 flex items-center justify-center rounded bg-black/60 text-white hover:bg-black/80 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  title={atLimit ? `Max ${effectiveMax} scenes` : "Duplicate scene"}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                    <path d="M7 3a1 1 0 011-1h8a1 1 0 011 1v10a1 1 0 01-1 1h-2v-6a3 3 0 00-3-3H7V3z" />
                    <path d="M3 7a1 1 0 011-1h8a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V7z" />
                  </svg>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); if (totalScenes > 1) onDeleteScene(scene.id); }}
                  disabled={totalScenes <= 1}
                  className="pointer-events-auto w-5 h-5 flex items-center justify-center rounded bg-red-600/80 text-white hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  title={totalScenes <= 1 ? "Cannot delete last scene" : "Delete scene"}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                    <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Carry Tokens — inline token selection for scene switching */}
      {tokens.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700/50">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Carry Tokens
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={selectAll}
                className="text-[10px] font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                All
              </button>
              <span className="text-[10px] text-gray-400">/</span>
              <button
                type="button"
                onClick={clearAll}
                className="text-[10px] font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                None
              </button>
              {selectedTokenIds.size > 0 && (
                <span className="text-[10px] text-gray-500 dark:text-gray-400 ml-1">
                  {selectedTokenIds.size}/{tokens.length}
                </span>
              )}
            </div>
          </div>
          <div className="max-h-32 overflow-y-auto -mx-1 px-1">
            {tokens.map((token) => (
              <label
                key={token.id}
                className="flex items-center gap-2 py-1 px-1 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedTokenIds.has(token.id)}
                  onChange={() => toggleToken(token.id)}
                  className="w-3.5 h-3.5 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 cursor-pointer flex-shrink-0"
                />
                {token.imageUrl ? (
                  <img
                    src={token.imageUrl}
                    alt={token.name}
                    className="w-5 h-5 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div
                    className="w-5 h-5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: token.color }}
                  />
                )}
                <span className="text-[11px] text-gray-800 dark:text-gray-200 truncate flex-1">
                  {token.name}
                </span>
                <span className="text-[9px] text-gray-400 dark:text-gray-500 capitalize flex-shrink-0">
                  {token.layer}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
