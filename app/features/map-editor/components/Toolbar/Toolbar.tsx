import { useState, useEffect } from "react";
import { Link } from "react-router";
import { useEditorStore, useMapStore } from "../../store";
import type { EditorTool } from "../../types";

const tools: { id: EditorTool; label: string; icon: string }[] = [
  { id: "select", label: "Select", icon: "↖" },
  { id: "pan", label: "Pan", icon: "✋" },
  { id: "token", label: "Token", icon: "●" },
];

export function Toolbar() {
  const selectedTool = useEditorStore((s) => s.selectedTool);
  const setTool = useEditorStore((s) => s.setTool);

  const map = useMapStore((s) => s.map);
  const updateGrid = useMapStore((s) => s.updateGrid);
  const updateMapName = useMapStore((s) => s.updateMapName);

  const [mapName, setMapName] = useState(map?.name ?? "");
  const [width, setWidth] = useState(map?.grid.width ?? 30);
  const [height, setHeight] = useState(map?.grid.height ?? 20);

  // Sync local state when map changes
  useEffect(() => {
    if (map) {
      setMapName(map.name);
      setWidth(map.grid.width);
      setHeight(map.grid.height);
    }
  }, [map?.id, map?.name, map?.grid.width, map?.grid.height]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setMapName(newName);
    updateMapName(newName || "Untitled Map");
  };

  const handleApply = () => {
    const newWidth = Math.max(5, Math.min(100, width));
    const newHeight = Math.max(5, Math.min(100, height));
    setWidth(newWidth);
    setHeight(newHeight);
    updateGrid({ width: newWidth, height: newHeight });
  };

  const hasChanges =
    map && (width !== map.grid.width || height !== map.grid.height);

  return (
    <div className="flex items-center justify-between gap-2 p-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-3">
        <Link
          to="/maps"
          className="px-3 py-2 rounded text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors cursor-pointer"
        >
          ← Maps
        </Link>
        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" />
        <input
          type="text"
          value={mapName}
          onChange={handleNameChange}
          placeholder="Map name"
          className="px-3 py-1.5 text-sm font-medium rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-w-[150px]"
        />
        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" />
        <div className="flex gap-1">
          {tools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => setTool(tool.id)}
              className={`px-3 py-2 rounded text-sm font-medium transition-colors cursor-pointer ${
                selectedTool === tool.id
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
              title={tool.label}
            >
              <span className="mr-1">{tool.icon}</span>
              {tool.label}
            </button>
          ))}
        </div>
      </div>

      {map && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600 dark:text-gray-400">Grid:</span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={width}
              onChange={(e) => setWidth(parseInt(e.target.value) || 5)}
              min={5}
              max={100}
              className="w-16 px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              title="Grid width (cells)"
            />
            <span className="text-gray-500 dark:text-gray-400">x</span>
            <input
              type="number"
              value={height}
              onChange={(e) => setHeight(parseInt(e.target.value) || 5)}
              min={5}
              max={100}
              className="w-16 px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              title="Grid height (cells)"
            />
          </div>
          {hasChanges && (
            <button
              onClick={handleApply}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
            >
              Apply
            </button>
          )}
        </div>
      )}
    </div>
  );
}
