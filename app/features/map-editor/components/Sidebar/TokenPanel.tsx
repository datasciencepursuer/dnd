import { useState, useRef, useEffect, useMemo } from "react";
import { useMapStore, useEditorStore } from "../../store";
import { TOKEN_COLORS } from "../../constants";
import { useUploadThing } from "~/utils/uploadthing";
import { ImageLibraryPicker } from "../ImageLibraryPicker";
import { UPLOAD_LIMITS, parseUploadError } from "~/lib/upload-limits";
import { buildFogSet, isTokenUnderFog } from "../../utils/fog-utils";
import { MonsterCompendium } from "./MonsterCompendium";
import { ConfirmModal } from "../ConfirmModal";
import { UpgradePrompt } from "~/components/UpgradePrompt";
import type { Token, TokenLayer, MonsterGroup, InitiativeEntry } from "../../types";
import type { TierLimits } from "~/lib/tier-limits";

interface TokenPanelProps {
  onEditToken?: (token: Token) => void;
  mode?: "create" | "list";
  mapId?: string;
  onTokenDelete?: (tokenId: string) => void;
  onTokenCreate?: (token: Token) => void;
  onMapChanged?: () => void;
  onSelectAndCenter?: (token: Token) => void;
  // Combat props
  isInCombat?: boolean;
  initiativeOrder?: InitiativeEntry[] | null;
  currentTurnIndex?: number;
  onNextTurn?: () => void;
  onPrevTurn?: () => void;
  // AI Battle Engine props
  aiBattleEngine?: boolean;
  onAiBattleEngineChange?: (enabled: boolean) => void;
  tierLimits?: TierLimits;
}

export function TokenPanel({
  onEditToken,
  mode = "list",
  mapId,
  onTokenDelete,
  onTokenCreate,
  onMapChanged,
  onSelectAndCenter,
  isInCombat = false,
  initiativeOrder = null,
  currentTurnIndex = 0,
  onNextTurn,
  onPrevTurn,
  aiBattleEngine = false,
  onAiBattleEngineChange,
  tierLimits,
}: TokenPanelProps) {
  const [tokenName, setTokenName] = useState("");
  const [tokenColor, setTokenColor] = useState(TOKEN_COLORS[0]);
  const [tokenSize, setTokenSize] = useState(1);
  const [tokenLayer, setTokenLayer] = useState<TokenLayer>("character");
  const [tokenImageUrl, setTokenImageUrl] = useState<string | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [tokenMonsterGroupId, setTokenMonsterGroupId] = useState<string | null>(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dropPosition, setDropPosition] = useState<"above" | "below">("above");
  const [createMode, setCreateMode] = useState<"custom" | "compendium">("custom");
  const [deleteConfirm, setDeleteConfirm] = useState<Token | null>(null);
  const dragRef = useRef<{ index: number; startY: number } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const map = useMapStore((s) => s.map);
  const addToken = useMapStore((s) => s.addToken);
  const removeToken = useMapStore((s) => s.removeToken);
  const reorderTokens = useMapStore((s) => s.reorderTokens);
  const duplicateToken = useMapStore((s) => s.duplicateToken);
  const createMonsterGroup = useMapStore((s) => s.createMonsterGroup);
  const selectedIds = useEditorStore((s) => s.selectedElementIds);
  const userId = useEditorStore((s) => s.userId);
  const canCreateToken = useEditorStore((s) => s.canCreateToken);
  const canEditToken = useEditorStore((s) => s.canEditToken);
  const canDeleteToken = useEditorStore((s) => s.canDeleteToken);
  const isDungeonMaster = useEditorStore((s) => s.isDungeonMaster);
  const isPlayingLocally = useEditorStore((s) => s.isPlayingLocally);
  const isTokenOwner = useEditorStore((s) => s.isTokenOwner);
  const getViewportCenterCell = useEditorStore((s) => s.getViewportCenterCell);

  const { startUpload } = useUploadThing("tokenImageUploader", {
    onClientUploadComplete: (res) => {
      if (res?.[0]?.url) {
        setTokenImageUrl(res[0].url);
      }
      setIsUploading(false);
      setUploadError(null);
    },
    onUploadError: (error) => {
      setUploadError(parseUploadError(error.message, UPLOAD_LIMITS.TOKEN_MAX_SIZE));
      setIsUploading(false);
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);

    await startUpload([file]);

    // Reset input so the same file can be selected again
    e.target.value = "";
  };

  const handleRemoveImage = () => {
    setTokenImageUrl(null);
  };

  const handleLibrarySelect = (url: string) => {
    setTokenImageUrl(url);
    setShowLibrary(false);
  };

  // Monster groups from the map
  const monsterGroups: MonsterGroup[] = map?.monsterGroups || [];

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) return;
    const groupId = createMonsterGroup(newGroupName.trim(), []);
    setTokenMonsterGroupId(groupId);
    setNewGroupName("");
    setShowCreateGroup(false);
  };

  const handleGroupChange = (value: string) => {
    if (value === "none") {
      setTokenMonsterGroupId(null);
    } else if (value === "new") {
      setShowCreateGroup(true);
    } else {
      setTokenMonsterGroupId(value);
    }
  };

  const handleAddToken = () => {
    if (!tokenName.trim() || !map || !canCreateToken()) return;

    const center = getViewportCenterCell(map.viewport, map.grid.cellSize);
    const token: Token = {
      id: crypto.randomUUID(),
      name: tokenName.trim(),
      imageUrl: tokenImageUrl,
      color: tokenColor,
      size: tokenSize,
      position: center,
      rotation: 0,
      flipped: false,
      visible: true,
      layer: tokenLayer,
      ownerId: isDungeonMaster() ? null : userId, // DM's tokens have null ownerId, players get their userId
      characterSheet: null,
      characterId: null,
      monsterGroupId: tokenLayer === "monster" ? tokenMonsterGroupId : null,
    };

    addToken(token);
    // Sync to other clients via WebSocket + persist to DB
    onTokenCreate?.(token);
    setTokenName("");
    setTokenImageUrl(null);
  };

  const canCreate = canCreateToken();

  const handleDeleteToken = (e: React.MouseEvent, token: Token) => {
    e.stopPropagation(); // Prevent opening edit dialog
    setDeleteConfirm(token);
  };

  const handleDeleteConfirm = () => {
    if (!deleteConfirm) return;
    removeToken(deleteConfirm.id);
    onTokenDelete?.(deleteConfirm.id);
    setDeleteConfirm(null);
  };

  const handleDuplicateToken = (e: React.MouseEvent, tokenId: string) => {
    e.stopPropagation(); // Prevent opening edit dialog

    // Duplicate with same monster group
    const newToken = duplicateToken(tokenId, { sameGroup: true });

    // Sync the new token to server
    if (newToken) {
      onTokenCreate?.(newToken);
    }
  };

  // Mouse-based drag handlers for immediate response
  const handleMouseDown = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { index, startY: e.clientY };
    setDraggedIndex(index);
    document.body.style.cursor = "grabbing";
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (dragRef.current === null || !listRef.current || !map) return;

      const items = listRef.current.children;
      const fromIndex = dragRef.current.index;

      // Find which item we're hovering over based on mouse Y position
      for (let i = 0; i < items.length; i++) {
        const item = items[i] as HTMLElement;
        const rect = item.getBoundingClientRect();

        if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
          if (i === fromIndex) {
            setDragOverIndex(null);
            return;
          }

          // Determine if dropping above or below based on drag direction
          if (fromIndex < i) {
            // Dragging down - show indicator below target
            setDragOverIndex(i);
            setDropPosition("below");
          } else {
            // Dragging up - show indicator above target
            setDragOverIndex(i);
            setDropPosition("above");
          }
          return;
        }
      }

      // Mouse is outside list bounds - check if above or below
      if (items.length > 0) {
        const firstRect = (items[0] as HTMLElement).getBoundingClientRect();
        const lastRect = (items[items.length - 1] as HTMLElement).getBoundingClientRect();

        if (e.clientY < firstRect.top && fromIndex !== 0) {
          setDragOverIndex(0);
          setDropPosition("above");
        } else if (e.clientY > lastRect.bottom && fromIndex !== items.length - 1) {
          setDragOverIndex(items.length - 1);
          setDropPosition("below");
        }
      }
    };

    const handleMouseUp = () => {
      if (dragRef.current !== null && dragOverIndex !== null && draggedIndex !== null) {
        if (draggedIndex !== dragOverIndex) {
          reorderTokens(draggedIndex, dragOverIndex);
        }
      }
      dragRef.current = null;
      setDraggedIndex(null);
      setDragOverIndex(null);
      document.body.style.cursor = "";
    };

    if (draggedIndex !== null) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [draggedIndex, dragOverIndex, map, reorderTokens]);

  const fogSet = useMemo(() => buildFogSet(map?.fogOfWar?.paintedCells || []), [map?.fogOfWar?.paintedCells]);

  // Filter tokens - hidden tokens and tokens under fog only visible to DM or owner
  const visibleTokens = map?.tokens.filter((token) => {
    // DM sees all tokens
    if (isDungeonMaster()) return true;

    // Token owner can always see their own token
    if (isTokenOwner(token.ownerId)) return true;

    // Hidden tokens (visible=false) are not shown to non-owners
    if (!token.visible) return false;

    // Tokens under fog are not shown to non-owners
    if (isTokenUnderFog(token, fogSet)) return false;

    return true;
  }) ?? [];

  // Stable colors for monster groups (assigned in order of group creation)
  const GROUP_COLORS = ["#a855f7", "#f97316", "#06b6d4", "#ec4899", "#84cc16", "#eab308", "#6366f1", "#14b8a6"];
  const groupColorMap = useMemo(() => {
    const map = new Map<string, string>();
    (monsterGroups ?? []).forEach((g, i) => {
      map.set(g.id, GROUP_COLORS[i % GROUP_COLORS.length]);
    });
    return map;
  }, [monsterGroups]);

  // During combat, create a map of tokenId -> initiative entry for quick lookup
  const initiativeMap = new Map<string, InitiativeEntry>();
  if (isInCombat && initiativeOrder) {
    initiativeOrder.forEach((entry) => {
      // Map all token IDs in a group to the same entry
      if (entry.groupTokenIds) {
        entry.groupTokenIds.forEach((id) => initiativeMap.set(id, entry));
      } else {
        initiativeMap.set(entry.tokenId, entry);
      }
    });
  }

  // During combat, filter to only combatants and sort by initiative
  const displayTokens = isInCombat && initiativeOrder
    ? visibleTokens
        .filter((token) => initiativeMap.has(token.id))
        .sort((a, b) => {
          const aInit = initiativeMap.get(a.id)?.initiative ?? 0;
          const bInit = initiativeMap.get(b.id)?.initiative ?? 0;
          return bInit - aInit; // Highest first
        })
    : visibleTokens;

  // Get current turn token ID from initiative order
  const currentTurnTokenId = isInCombat && initiativeOrder && initiativeOrder[currentTurnIndex]
    ? initiativeOrder[currentTurnIndex].tokenId
    : null;

  // Check if a token is the current turn (handles groups)
  const isCurrentTurn = (tokenId: string): boolean => {
    if (!isInCombat || !initiativeOrder || currentTurnIndex >= initiativeOrder.length) return false;
    const currentEntry = initiativeOrder[currentTurnIndex];
    if (currentEntry.groupTokenIds) {
      return currentEntry.groupTokenIds.includes(tokenId);
    }
    return currentEntry.tokenId === tokenId;
  };

  // Token list component (reused in both modes)
  const TokenList = () => (
    <>
      {map && displayTokens.length > 0 && (
        <div className={mode === "create" ? "pt-4 border-t border-gray-200 dark:border-gray-700" : ""}>
          {/* Combat header with turn controls */}
          {isInCombat && initiativeOrder ? (
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-medium text-red-600 dark:text-red-400 flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6.92 5H5l5.5 5.5.71-.71L6.92 5zm12.08 0h-1.92l-4.29 4.29.71.71L19 5zM12 9.17L5.83 15.34 4.42 13.93 10.59 7.76l.71.71L5.83 13.93l1.41 1.41L12 10.59l4.76 4.75 1.41-1.41L12.71 8.46l.71-.71 5.46 5.46-1.41 1.42L12 9.17zM3 19v2h18v-2H3z"/>
                  </svg>
                  Turn Order
                </h4>
                {isDungeonMaster() && onAiBattleEngineChange && (
                  <label
                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold cursor-pointer select-none transition-colors ${
                      aiBattleEngine
                        ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500"
                    }`}
                    title="AI Battle Engine: auto-run AI on next turn"
                  >
                    <input
                      type="checkbox"
                      checked={aiBattleEngine}
                      onChange={(e) => onAiBattleEngineChange(e.target.checked)}
                      className="sr-only"
                    />
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M13 7H7v6h6V7z" />
                      <path fillRule="evenodd" d="M7 2a1 1 0 012 0v1h2V2a1 1 0 112 0v1h2a2 2 0 012 2v2h1a1 1 0 110 2h-1v2h1a1 1 0 110 2h-1v2a2 2 0 01-2 2h-2v1a1 1 0 11-2 0v-1H9v1a1 1 0 11-2 0v-1H5a2 2 0 01-2-2v-2H2a1 1 0 110-2h1V9H2a1 1 0 010-2h1V5a2 2 0 012-2h2V2zM5 5h10v10H5V5z" clipRule="evenodd" />
                    </svg>
                    AI
                  </label>
                )}
              </div>
              {isDungeonMaster() && onNextTurn && onPrevTurn && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={onPrevTurn}
                    disabled={currentTurnIndex <= 0}
                    className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    title="Previous turn"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <span className="text-xs text-gray-500 dark:text-gray-400 min-w-[3rem] text-center">
                    {currentTurnIndex + 1}/{initiativeOrder.length}
                  </span>
                  <button
                    onClick={onNextTurn}
                    disabled={!initiativeOrder.length}
                    className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    title={currentTurnIndex >= initiativeOrder.length - 1 ? "Restart round" : "Next turn"}
                  >
                    {currentTurnIndex >= initiativeOrder.length - 1 ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Units ({displayTokens.length})
            </h4>
          )}
          <div ref={listRef} className="space-y-1 max-h-60 overflow-y-auto">
            {displayTokens.map((token, index) => {
              const isOwnToken = isTokenOwner(token.ownerId);
              const canEdit = canEditToken(token.ownerId); // DM can edit all, players can edit their own
              const canDelete = canDeleteToken(token.ownerId); // DM or owner
              const isDragging = draggedIndex === index;
              const isDragOver = dragOverIndex === index && draggedIndex !== index;
              const showTopBorder = isDragOver && dropPosition === "above";
              const showBottomBorder = isDragOver && dropPosition === "below";
              const initEntry = initiativeMap.get(token.id);
              const isCurrent = isCurrentTurn(token.id);
              const groupColor = token.monsterGroupId ? groupColorMap.get(token.monsterGroupId) : undefined;
              const groupName = token.monsterGroupId ? monsterGroups.find(g => g.id === token.monsterGroupId)?.name : undefined;
              return (
                <div
                  key={token.id}
                  onClick={() => canEdit && onEditToken?.(token)}
                  className={`group flex items-center gap-2 p-2 rounded text-sm transition-all select-none ${
                    isCurrent
                      ? "bg-yellow-100 dark:bg-yellow-900/40 ring-2 ring-yellow-400 dark:ring-yellow-600"
                      : selectedIds.includes(token.id)
                        ? "bg-blue-100 dark:bg-blue-900"
                        : "bg-gray-50 dark:bg-gray-700"
                  } ${canEdit ? "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600" : ""} ${
                    isDragging ? "opacity-50" : ""
                  } ${showTopBorder ? "border-t-2 border-blue-500" : ""} ${showBottomBorder ? "border-b-2 border-blue-500" : ""}`}
                  style={groupColor ? { borderLeft: `3px solid ${groupColor}` } : undefined}
                  title={groupName ? `Group: ${groupName}` : undefined}
                >
                  {/* Initiative rank during combat */}
                  {isInCombat && initEntry && (
                    <span className={`text-xs font-bold w-5 text-center flex-shrink-0 ${
                      isCurrent ? "text-yellow-700 dark:text-yellow-300" : "text-gray-400 dark:text-gray-500"
                    }`}>
                      {initiativeOrder?.findIndex(e => e.tokenId === initEntry.tokenId) !== undefined
                        ? (initiativeOrder?.findIndex(e => e.tokenId === initEntry.tokenId) ?? 0) + 1
                        : ""}
                    </span>
                  )}
                  {/* Drag handle - DM only, not during combat */}
                  {isDungeonMaster() && !isInCombat && (
                    <div
                      onMouseDown={(e) => handleMouseDown(e, index)}
                      className="flex-shrink-0 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 p-1 -m-1"
                      title="Drag to reorder"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
                      </svg>
                    </div>
                  )}
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: token.color }}
                  />
                  {/* Select and center button - shown for all visible tokens */}
                  {onSelectAndCenter && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectAndCenter(token);
                      }}
                      className="flex-shrink-0 text-gray-400 hover:text-blue-500 dark:text-gray-500 dark:hover:text-blue-400 cursor-pointer p-0.5 -m-0.5"
                      title="Select and center on map"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                      </svg>
                    </button>
                  )}
                  <span className={`flex-1 truncate cursor-pointer ${
                    isCurrent ? "text-yellow-800 dark:text-yellow-200 font-medium" : "text-gray-900 dark:text-white"
                  }`}>
                    {token.name}
                  </span>
                  {/* Initiative score during combat */}
                  {isInCombat && initEntry && (
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                      isCurrent
                        ? "bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200"
                        : "bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300"
                    }`}>
                      {initEntry.initiative}
                    </span>
                  )}
                  {!isInCombat && canEdit && onEditToken && (
                    <span className="text-xs text-blue-500 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      Edit
                    </span>
                  )}
                  {/* Duplicate button - DM only, for monster tokens, not during combat */}
                  {!isInCombat && isDungeonMaster() && token.layer === "monster" && (
                    <button
                      onClick={(e) => handleDuplicateToken(e, token.id)}
                      className="text-xs font-bold text-gray-400 hover:text-purple-500 dark:text-gray-500 dark:hover:text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer px-1"
                      title="Add another monster (keeps same group)"
                    >
                      +1
                    </button>
                  )}
                  {!isInCombat && canDelete && (
                    <button
                      onClick={(e) => handleDeleteToken(e, token)}
                      className="text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer p-1 -m-1"
                      title="Delete unit"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  )}
                  {!isInCombat && !isOwnToken && !isDungeonMaster() && (
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      (locked)
                    </span>
                  )}
                  {!isInCombat && isDungeonMaster() && !isPlayingLocally && !token.visible && (
                    <span className="text-xs text-yellow-500 dark:text-yellow-400" title="Token is set to hidden - not visible to players">
                      (hidden)
                    </span>
                  )}
                  {!isInCombat && isDungeonMaster() && !isPlayingLocally && token.visible && isTokenUnderFog(token, fogSet) && (
                    <span className="text-xs text-purple-500 dark:text-purple-400" title="Token is under fog of war - hidden from players">
                      (fogged)
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {map && displayTokens.length === 0 && mode === "list" && (
        <div className="text-center text-gray-500 dark:text-gray-400 py-8">
          <p className="text-sm">{isInCombat ? "No combatants" : "No units on the map"}</p>
        </div>
      )}

      <ConfirmModal
        isOpen={deleteConfirm !== null}
        title="Delete Unit"
        message={`Are you sure you want to delete "${deleteConfirm?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmVariant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirm(null)}
      />
    </>
  );

  // List-only mode
  if (mode === "list") {
    return (
      <div className="p-4 space-y-4">
        <TokenList />
      </div>
    );
  }

  // Create mode
  return (
    <div className="p-4 space-y-4">
      {canCreate && (
        <>
          <h3 className="font-semibold text-gray-900 dark:text-white">Create Unit</h3>

          {/* Custom / Monster Templates toggle - DM only */}
          {isDungeonMaster() && (
            <div className="grid grid-cols-2 gap-1">
              <button
                onClick={() => setCreateMode("custom")}
                className={`px-2 py-1.5 text-xs rounded border cursor-pointer ${
                  createMode === "custom"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600"
                }`}
              >
                Custom
              </button>
              <button
                onClick={() => {
                  if (tierLimits && !tierLimits.monsterCompendium) return;
                  setCreateMode("compendium");
                }}
                disabled={tierLimits ? !tierLimits.monsterCompendium : false}
                className={`px-2 py-1.5 text-xs rounded border ${
                  tierLimits && !tierLimits.monsterCompendium
                    ? "opacity-50 cursor-not-allowed bg-white dark:bg-gray-700 text-gray-400 dark:text-gray-500 border-gray-300 dark:border-gray-600"
                    : createMode === "compendium"
                      ? "bg-blue-600 text-white border-blue-600 cursor-pointer"
                      : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 cursor-pointer"
                }`}
                title={tierLimits && !tierLimits.monsterCompendium ? "Monster Templates requires Adventurer plan" : undefined}
              >
                Monster Templates
              </button>
            </div>
          )}
          {isDungeonMaster() && tierLimits && !tierLimits.monsterCompendium && (
            <UpgradePrompt feature="Monster Templates" requiredTier="Adventurer" variant="inline" />
          )}

          {/* Compendium mode */}
          {createMode === "compendium" && isDungeonMaster() ? (
            <MonsterCompendium onTokenCreate={onTokenCreate} onMapChanged={onMapChanged} />
          ) : (
          <div className="space-y-3">
            <input
              type="text"
              value={tokenName}
              onChange={(e) => setTokenName(e.target.value)}
              placeholder="Unit name"
              className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />

            {/* Image */}
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                Image
                <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">
                  (max {UPLOAD_LIMITS.TOKEN_MAX_SIZE})
                </span>
              </label>

              {/* Current image preview */}
              {tokenImageUrl && (
                <div className="relative inline-block mb-2">
                  <img
                    src={tokenImageUrl}
                    alt="Token"
                    className="w-12 h-12 object-cover rounded border border-gray-300 dark:border-gray-600"
                  />
                  <button
                    onClick={handleRemoveImage}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600 cursor-pointer"
                    title="Remove image"
                  >
                    &times;
                  </button>
                </div>
              )}

              {/* Upload */}
              <div className="space-y-2">
                <label className="block">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    disabled={isUploading}
                    className="block w-full text-sm text-gray-500 dark:text-gray-400
                      file:mr-4 file:py-1.5 file:px-3
                      file:rounded file:border-0
                      file:text-sm file:font-semibold
                      file:bg-blue-50 file:text-blue-700
                      dark:file:bg-blue-900 dark:file:text-blue-300
                      hover:file:bg-blue-100 dark:hover:file:bg-blue-800
                      file:cursor-pointer cursor-pointer
                      disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </label>
                {isUploading && (
                  <p className="text-xs text-blue-600 dark:text-blue-400">Uploading...</p>
                )}
                {uploadError && (
                  <p className="text-xs text-red-600 dark:text-red-400">{uploadError}</p>
                )}
              </div>

              {/* Library toggle */}
              <button
                onClick={() => setShowLibrary(!showLibrary)}
                className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                {showLibrary ? "Hide library" : "Choose from my uploads"}
              </button>

              {/* Image library picker */}
              {showLibrary && (
                <div className="mt-2 p-2 border border-gray-200 dark:border-gray-700 rounded">
                  <ImageLibraryPicker
                    type="token"
                    onSelect={handleLibrarySelect}
                    selectedUrl={tokenImageUrl}
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                Color
                {tokenImageUrl && (
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                    (used for travel lines)
                  </span>
                )}
              </label>
              <div className="flex flex-wrap gap-1">
                {TOKEN_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setTokenColor(color)}
                    className={`w-6 h-6 rounded-full border-2 cursor-pointer ${
                      tokenColor === color
                        ? "border-blue-500"
                        : "border-transparent"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                Size
              </label>
              <div className="grid grid-cols-4 gap-1">
                {[1, 2, 3, 4].map((size) => (
                  <button
                    key={size}
                    onClick={() => setTokenSize(size)}
                    className={`px-2 py-1 text-xs rounded border cursor-pointer ${
                      tokenSize === size
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600"
                    }`}
                  >
                    {size * size} cell{size > 1 ? "s" : ""}
                  </button>
                ))}
              </div>
            </div>

            {/* Layer / Type */}
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                Type
              </label>
              <div className="grid grid-cols-3 gap-1">
                {(["character", "monster", "object"] as TokenLayer[]).map((l) => (
                  <button
                    key={l}
                    onClick={() => {
                      setTokenLayer(l);
                      if (l !== "monster") {
                        setTokenMonsterGroupId(null);
                        setShowCreateGroup(false);
                      }
                    }}
                    className={`px-2 py-1 text-xs rounded border cursor-pointer capitalize ${
                      tokenLayer === l
                        ? l === "character"
                          ? "bg-blue-600 text-white border-blue-600"
                          : l === "monster"
                            ? "bg-red-600 text-white border-red-600"
                            : "bg-gray-600 text-white border-gray-600"
                        : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Monster Group - shown when layer is monster and user is DM */}
            {tokenLayer === "monster" && isDungeonMaster() && (
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Monster Group
                  <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">
                    (share initiative)
                  </span>
                </label>
                {showCreateGroup ? (
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      placeholder="Group name"
                      className="flex-1 px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleCreateGroup();
                        if (e.key === "Escape") setShowCreateGroup(false);
                      }}
                    />
                    <button
                      onClick={handleCreateGroup}
                      disabled={!newGroupName.trim()}
                      className="px-2 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 cursor-pointer text-xs"
                    >
                      Create
                    </button>
                    <button
                      onClick={() => setShowCreateGroup(false)}
                      className="px-2 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 cursor-pointer text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <select
                    value={tokenMonsterGroupId || "none"}
                    onChange={(e) => handleGroupChange(e.target.value)}
                    className="w-full px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  >
                    <option value="none">No group (individual initiative)</option>
                    {monsterGroups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                    <option value="new">+ Create new group...</option>
                  </select>
                )}
              </div>
            )}

            <button
              onClick={handleAddToken}
              disabled={!tokenName.trim()}
              className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Add Unit
            </button>
          </div>
          )}
        </>
      )}

      {!canCreate && (
        <div className="p-4 text-center text-gray-500 dark:text-gray-400">
          <p className="text-sm">View only - cannot create units</p>
        </div>
      )}

      <TokenList />
    </div>
  );
}
