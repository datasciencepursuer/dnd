import { useState, useRef, useEffect } from "react";
import { useMapStore, useEditorStore } from "../../store";
import { TOKEN_COLORS, TOKEN_PRESETS } from "../../constants";
import type { Token } from "../../types";

interface TokenPanelProps {
  onEditToken?: (token: Token) => void;
  mode?: "create" | "list";
  readOnly?: boolean;
  mapId?: string;
  onTokenDelete?: (tokenId: string) => void;
}

export function TokenPanel({ onEditToken, mode = "list", readOnly = false, mapId, onTokenDelete }: TokenPanelProps) {
  const [tokenName, setTokenName] = useState("");
  const [tokenColor, setTokenColor] = useState(TOKEN_COLORS[0]);
  const [tokenSize, setTokenSize] = useState(1);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dropPosition, setDropPosition] = useState<"above" | "below">("above");
  const dragRef = useRef<{ index: number; startY: number } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const map = useMapStore((s) => s.map);
  const addToken = useMapStore((s) => s.addToken);
  const removeToken = useMapStore((s) => s.removeToken);
  const reorderTokens = useMapStore((s) => s.reorderTokens);
  const selectedIds = useEditorStore((s) => s.selectedElementIds);
  const userId = useEditorStore((s) => s.userId);
  const canCreateToken = useEditorStore((s) => s.canCreateToken);
  const canEditToken = useEditorStore((s) => s.canEditToken);
  const canMoveToken = useEditorStore((s) => s.canMoveToken);
  const isOwner = useEditorStore((s) => s.isOwner);

  const handleAddToken = () => {
    if (!tokenName.trim() || !map || !canCreateToken()) return;

    const token: Token = {
      id: crypto.randomUUID(),
      name: tokenName.trim(),
      imageUrl: null,
      color: tokenColor,
      size: tokenSize,
      position: {
        col: Math.floor(map.grid.width / 2),
        row: Math.floor(map.grid.height / 2),
      },
      rotation: 0,
      flipped: false,
      visible: true,
      layer: "character",
      ownerId: isOwner() ? null : userId, // Owner's tokens have null ownerId
    };

    addToken(token);
    setTokenName("");
  };


  const handleAddPreset = (preset: { name: string; imageUrl: string }) => {
    if (!map || !canCreateToken()) return;

    const token: Token = {
      id: crypto.randomUUID(),
      name: preset.name,
      imageUrl: preset.imageUrl,
      color: tokenColor,
      size: tokenSize,
      position: {
        col: Math.floor(map.grid.width / 2),
        row: Math.floor(map.grid.height / 2),
      },
      rotation: 0,
      flipped: false,
      visible: true,
      layer: "character",
      ownerId: isOwner() ? null : userId,
    };

    addToken(token);
  };

  const presets = TOKEN_PRESETS;

  const canCreate = canCreateToken();
  const canDeleteToken = useEditorStore((s) => s.canDeleteToken);

  const handleDeleteToken = (e: React.MouseEvent, tokenId: string) => {
    e.stopPropagation(); // Prevent opening edit dialog

    // Delete locally first for responsive UI
    removeToken(tokenId);

    // Then sync to server via callback
    onTokenDelete?.(tokenId);
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

  // Token list component (reused in both modes)
  const TokenList = () => (
    <>
      {map && map.tokens.length > 0 && (
        <div className={mode === "create" ? "pt-4 border-t border-gray-200 dark:border-gray-700" : ""}>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Units ({map.tokens.length})
          </h4>
          <div ref={listRef} className="space-y-1 max-h-60 overflow-y-auto">
            {map.tokens.map((token, index) => {
              const isOwnToken = canMoveToken(token.ownerId);
              const canEdit = canEditToken(token.ownerId);
              const canDelete = canDeleteToken(token.ownerId);
              const isDragging = draggedIndex === index;
              const isDragOver = dragOverIndex === index && draggedIndex !== index;
              const showTopBorder = isDragOver && dropPosition === "above";
              const showBottomBorder = isDragOver && dropPosition === "below";
              return (
                <div
                  key={token.id}
                  onClick={() => canEdit && onEditToken?.(token)}
                  className={`group flex items-center gap-2 p-2 rounded text-sm transition-all select-none ${
                    selectedIds.includes(token.id)
                      ? "bg-blue-100 dark:bg-blue-900"
                      : "bg-gray-50 dark:bg-gray-700"
                  } ${canEdit ? "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600" : ""} ${
                    isDragging ? "opacity-50" : ""
                  } ${showTopBorder ? "border-t-2 border-blue-500" : ""} ${showBottomBorder ? "border-b-2 border-blue-500" : ""}`}
                >
                  {/* Drag handle */}
                  {isOwner() && (
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
                  <span className="text-gray-900 dark:text-white flex-1 truncate cursor-pointer">
                    {token.name}
                  </span>
                  {canEdit && onEditToken && (
                    <span className="text-xs text-blue-500 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      Edit
                    </span>
                  )}
                  {canDelete && (
                    <button
                      onClick={(e) => handleDeleteToken(e, token.id)}
                      className="text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer p-1 -m-1"
                      title="Delete unit"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  )}
                  {!isOwnToken && (
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      (locked)
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {map && map.tokens.length === 0 && mode === "list" && (
        <div className="text-center text-gray-500 dark:text-gray-400 py-8">
          <p className="text-sm">No units on the map</p>
        </div>
      )}
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
          <h3 className="font-semibold text-gray-900 dark:text-white">Presets</h3>
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => (
              <button
                key={preset.name}
                onClick={() => handleAddPreset(preset)}
                className="flex flex-col items-center gap-1 p-2 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                title={`Add ${preset.name}`}
              >
                <img
                  src={preset.imageUrl}
                  alt={preset.name}
                  className="w-10 h-10 object-contain"
                />
                <span className="text-xs text-gray-700 dark:text-gray-300">
                  {preset.name}
                </span>
              </button>
            ))}
          </div>

          <h3 className="font-semibold text-gray-900 dark:text-white pt-2">Custom Unit</h3>

          <div className="space-y-3">
            <input
              type="text"
              value={tokenName}
              onChange={(e) => setTokenName(e.target.value)}
              placeholder="Unit name"
              className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />

            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                Color
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

            <button
              onClick={handleAddToken}
              disabled={!tokenName.trim()}
              className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Add Unit
            </button>
          </div>
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
