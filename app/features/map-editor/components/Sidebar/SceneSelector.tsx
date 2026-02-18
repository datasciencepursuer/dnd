import { useState, useRef, useEffect, useCallback } from "react";
import { useMapStore } from "../../store";
import { getAllScenes } from "../../utils/scene-utils";
import { MAX_SCENES } from "../../constants";
import type { SceneInfo } from "../../utils/scene-utils";

interface SceneSelectorProps {
  onSwitchScene: (sceneId: string) => void;
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
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<"left" | "right">("left");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const scenes: SceneInfo[] = map ? getAllScenes(map) : [];
  const totalScenes = scenes.length;
  const effectiveMax = maxScenes ?? MAX_SCENES;
  const atLimit = totalScenes >= effectiveMax;

  // Determine if the menu should open left or right based on available space
  const openMenu = useCallback((sceneId: string, triggerEl: HTMLElement) => {
    if (menuOpenId === sceneId) {
      setMenuOpenId(null);
      return;
    }

    // Check if there's enough room to the right (128px menu width)
    const containerRect = containerRef.current?.getBoundingClientRect();
    const triggerRect = triggerEl.getBoundingClientRect();
    const spaceRight = containerRect
      ? containerRect.right - triggerRect.right
      : window.innerWidth - triggerRect.right;

    setMenuPosition(spaceRight >= 128 ? "left" : "right");
    setMenuOpenId(sceneId);
  }, [menuOpenId]);

  // Close menu when clicking outside
  useEffect(() => {
    if (!menuOpenId) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpenId]);

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
    setMenuOpenId(null);
  };

  const handleCommitRename = () => {
    if (renamingId && renameValue.trim()) {
      onRenameScene(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  };

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
                if (!scene.isActive) onSwitchScene(scene.id);
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

            {/* Context menu trigger — always visible on touch, hover-reveal on desktop */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                openMenu(scene.id, e.currentTarget);
              }}
              className="absolute top-0.5 right-0.5 w-5 h-5 flex items-center justify-center rounded bg-black/30 text-white lg:opacity-0 lg:group-hover:opacity-100 transition-opacity cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                <path d="M8 2a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM8 6.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM9.5 12.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
              </svg>
            </button>

            {/* Context menu — positioned dynamically to stay in view */}
            {menuOpenId === scene.id && (
              <div
                ref={menuRef}
                className={`absolute top-6 z-50 w-32 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 ${
                  menuPosition === "right" ? "right-0" : "left-0"
                }`}
              >
                <button
                  onClick={() => handleStartRename(scene)}
                  className="w-full px-3 py-1.5 text-xs text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                >
                  Rename
                </button>
                <button
                  onClick={() => {
                    onDuplicateScene(scene.id);
                    setMenuOpenId(null);
                  }}
                  disabled={atLimit}
                  className="w-full px-3 py-1.5 text-xs text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 cursor-pointer"
                >
                  Duplicate
                </button>
                <button
                  onClick={() => {
                    onDeleteScene(scene.id);
                    setMenuOpenId(null);
                  }}
                  disabled={totalScenes <= 1}
                  className="w-full px-3 py-1.5 text-xs text-left text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 cursor-pointer"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
