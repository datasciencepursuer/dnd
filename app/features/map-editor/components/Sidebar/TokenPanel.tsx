import { useState } from "react";
import { useMapStore, useEditorStore } from "../../store";
import { TOKEN_COLORS } from "../../constants";
import type { Token } from "../../types";

export function TokenPanel() {
  const [tokenName, setTokenName] = useState("");
  const [tokenColor, setTokenColor] = useState(TOKEN_COLORS[0]);
  const [tokenSize, setTokenSize] = useState(1);

  const map = useMapStore((s) => s.map);
  const addToken = useMapStore((s) => s.addToken);
  const removeToken = useMapStore((s) => s.removeToken);
  const selectedIds = useEditorStore((s) => s.selectedElementIds);

  const handleAddToken = () => {
    if (!tokenName.trim() || !map) return;

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
      visible: true,
      layer: "character",
    };

    addToken(token);
    setTokenName("");
  };

  const handleDeleteSelected = () => {
    selectedIds.forEach((id) => removeToken(id));
  };

  return (
    <div className="p-4 space-y-4">
      <h3 className="font-semibold text-gray-900 dark:text-white">Add Token</h3>

      <div className="space-y-3">
        <input
          type="text"
          value={tokenName}
          onChange={(e) => setTokenName(e.target.value)}
          placeholder="Token name"
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
                className={`w-6 h-6 rounded-full border-2 ${
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
                className={`px-2 py-1 text-xs rounded border ${
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
          className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Add Token
        </button>
      </div>

      {selectedIds.length > 0 && (
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleDeleteSelected}
            className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Delete Selected ({selectedIds.length})
          </button>
        </div>
      )}

      {map && map.tokens.length > 0 && (
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Tokens ({map.tokens.length})
          </h4>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {map.tokens.map((token) => (
              <div
                key={token.id}
                className={`flex items-center gap-2 p-2 rounded text-sm ${
                  selectedIds.includes(token.id)
                    ? "bg-blue-100 dark:bg-blue-900"
                    : "bg-gray-50 dark:bg-gray-700"
                }`}
              >
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: token.color }}
                />
                <span className="text-gray-900 dark:text-white">
                  {token.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
