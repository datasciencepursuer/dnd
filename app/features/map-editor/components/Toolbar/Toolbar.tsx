import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useRevalidator } from "react-router";
import { useEditorStore, useMapStore } from "../../store";
import type { EditorTool } from "../../types";

interface GroupMember {
  id: string;
  name: string;
}

const viewTools: { id: EditorTool; label: string; icon: string; shortcut: string; hint?: string }[] = [
  { id: "select", label: "Select", icon: "↖", shortcut: "1", hint: "Left click: select · Right click: pan" },
];

// Tools available to everyone (require selected token)
const drawTool: { id: EditorTool; label: string; icon: string; shortcut: string; hint?: string } =
  { id: "draw", label: "Draw", icon: "✏", shortcut: "2", hint: "Select a token then draw with its color" };

const pingTool: { id: EditorTool; label: string; icon: string; shortcut: string; hint?: string } =
  { id: "ping", label: "Ping", icon: "📍", shortcut: "P", hint: "Select a token then click to ping (4 per 10s)" };

// Erase tool - available to everyone
const eraseTool: { id: EditorTool; label: string; icon: string; shortcut: string; hint?: string } =
  { id: "erase", label: "Erase", icon: "⌫", shortcut: "3", hint: "Drag to erase fog and drawings" };

// Tools requiring map edit permission (DM only)
const mapEditTools: { id: EditorTool; label: string; icon: string; shortcut: string; hint?: string }[] = [
  { id: "fog", label: "Fog", icon: "🌫", shortcut: "4", hint: "Drag to paint fog" },
];

interface ToolbarProps {
  userName?: string | null;
  userId?: string | null;
  mapId?: string;
  groupMembers?: GroupMember[];
  onDmTransfer?: (newDmId: string) => void;
}

export function Toolbar({ userName, userId, mapId, groupMembers = [], onDmTransfer }: ToolbarProps) {
  const selectedTool = useEditorStore((s) => s.selectedTool);
  const setTool = useEditorStore((s) => s.setTool);
  const canEditMap = useEditorStore((s) => s.canEditMap);
  const isDungeonMaster = useEditorStore((s) => s.isDungeonMaster);
  const isPlayingLocally = useEditorStore((s) => s.isPlayingLocally);
  const togglePlayingLocally = useEditorStore((s) => s.togglePlayingLocally);

  const map = useMapStore((s) => s.map);
  const updateGrid = useMapStore((s) => s.updateGrid);
  const updateMapName = useMapStore((s) => s.updateMapName);

  const [mapName, setMapName] = useState(map?.name ?? "");
  const [width, setWidth] = useState<number | string>(map?.grid.width ?? 30);
  const [height, setHeight] = useState<number | string>(map?.grid.height ?? 20);
  const [showDmDropdown, setShowDmDropdown] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const dmDropdownRef = useRef<HTMLDivElement>(null);
  const revalidator = useRevalidator();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dmDropdownRef.current && !dmDropdownRef.current.contains(e.target as Node)) {
        setShowDmDropdown(false);
      }
    };
    if (showDmDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showDmDropdown]);

  // Handle DM transfer
  const handleTransferDm = async (newDmId: string) => {
    if (!mapId || isTransferring) return;

    setIsTransferring(true);
    try {
      const response = await fetch(`/api/maps/${mapId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newDmId }),
      });

      if (response.ok) {
        setShowDmDropdown(false);
        // Broadcast to all clients to trigger refresh
        onDmTransfer?.(newDmId);
        // Reload this client too
        window.location.reload();
      } else {
        const error = await response.text();
        console.error("Failed to transfer DM:", error);
      }
    } catch (error) {
      console.error("Failed to transfer DM:", error);
    } finally {
      setIsTransferring(false);
    }
  };

  // Filter out current user from transfer options
  const transferOptions = groupMembers.filter(m => m.id !== userId);

  // Sync local state when map changes
  useEffect(() => {
    if (map) {
      setMapName(map.name);
      setWidth(map.grid.width);
      setHeight(map.grid.height);
    }
  }, [map?.id, map?.name, map?.grid.width, map?.grid.height]);

  // Keyboard shortcuts for tools
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case "1":
          setTool("select");
          break;
        case "2":
          // Draw available to everyone (like ping)
          setTool("draw");
          break;
        case "3":
          // Erase available to everyone
          setTool("erase");
          break;
        case "4":
          // Fog only for DM
          if (canEditMap()) setTool("fog");
          break;
        case "p":
        case "P":
          setTool("ping");
          break;
      }
    },
    [setTool, canEditMap]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEditMap()) return;
    const newName = e.target.value;
    setMapName(newName);
    updateMapName(newName || "Untitled Map");
  };

  const handleApply = () => {
    if (!canEditMap()) return;
    // Parse and validate - use current map values as fallback if invalid
    const parsedWidth = typeof width === "string" ? parseInt(width) : width;
    const parsedHeight = typeof height === "string" ? parseInt(height) : height;
    const newWidth = Math.max(5, Math.min(100, isNaN(parsedWidth) ? map?.grid.width ?? 30 : parsedWidth));
    const newHeight = Math.max(5, Math.min(100, isNaN(parsedHeight) ? map?.grid.height ?? 20 : parsedHeight));
    setWidth(newWidth);
    setHeight(newHeight);
    updateGrid({ width: newWidth, height: newHeight });
  };

  // Check if values differ from map (handle both string and number)
  const currentWidth = typeof width === "string" ? parseInt(width) : width;
  const currentHeight = typeof height === "string" ? parseInt(height) : height;
  const hasChanges =
    map && (currentWidth !== map.grid.width || currentHeight !== map.grid.height || width === "" || height === "");

  return (
    <>
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
            disabled={!canEditMap()}
            className="px-3 py-1.5 text-sm font-medium rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-w-[150px] disabled:opacity-50"
          />
          {/* Role indicator - clickable for DM to transfer */}
          <div className="relative" ref={dmDropdownRef}>
            {isDungeonMaster() && transferOptions.length > 0 ? (
              <>
                <button
                  onClick={() => setShowDmDropdown(!showDmDropdown)}
                  className="text-xs px-2 py-1 rounded bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800 cursor-pointer flex items-center gap-1"
                  title="Click to transfer DM role"
                >
                  DM
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showDmDropdown && (
                  <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg z-50 min-w-[160px]">
                    <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                      Transfer DM to:
                    </div>
                    {transferOptions.map((member) => (
                      <button
                        key={member.id}
                        onClick={() => handleTransferDm(member.id)}
                        disabled={isTransferring}
                        className="w-full px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 cursor-pointer"
                      >
                        {member.name}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <span className={`text-xs px-2 py-1 rounded ${
                isDungeonMaster()
                  ? "bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300"
                  : "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
              }`}>
                {isDungeonMaster() ? "DM" : "Player"}
              </span>
            )}
          </div>
          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" />
          <div className="flex gap-1">
            {viewTools.map((tool) => (
              <button
                key={tool.id}
                onClick={() => setTool(tool.id)}
                className={`px-3 py-2 rounded text-sm font-medium transition-colors cursor-pointer ${
                  selectedTool === tool.id
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
                title={tool.hint || `${tool.label} (${tool.shortcut})`}
              >
                <span className="mr-1">{tool.icon}</span>
                {tool.label}
                <span className="ml-1 text-xs opacity-60">({tool.shortcut})</span>
              </button>
            ))}
            {/* Draw tool - available to everyone */}
            <button
              onClick={() => setTool(drawTool.id)}
              className={`px-3 py-2 rounded text-sm font-medium transition-colors cursor-pointer ${
                selectedTool === drawTool.id
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
              title={drawTool.hint || `${drawTool.label} (${drawTool.shortcut})`}
            >
              <span className="mr-1">{drawTool.icon}</span>
              {drawTool.label}
              <span className="ml-1 text-xs opacity-60">({drawTool.shortcut})</span>
            </button>
            {/* Erase tool - available to everyone */}
            <button
              onClick={() => setTool(eraseTool.id)}
              className={`px-3 py-2 rounded text-sm font-medium transition-colors cursor-pointer ${
                selectedTool === eraseTool.id
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
              title={eraseTool.hint || `${eraseTool.label} (${eraseTool.shortcut})`}
            >
              <span className="mr-1">{eraseTool.icon}</span>
              {eraseTool.label}
              <span className="ml-1 text-xs opacity-60">({eraseTool.shortcut})</span>
            </button>
            {/* Fog tool - DM only */}
            {canEditMap() && mapEditTools.map((tool) => (
              <button
                key={tool.id}
                onClick={() => setTool(tool.id)}
                className={`px-3 py-2 rounded text-sm font-medium transition-colors cursor-pointer ${
                  selectedTool === tool.id
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
                title={tool.hint || `${tool.label} (${tool.shortcut})`}
              >
                <span className="mr-1">{tool.icon}</span>
                {tool.label}
                <span className="ml-1 text-xs opacity-60">({tool.shortcut})</span>
              </button>
            ))}
            <button
              onClick={() => setTool(pingTool.id)}
              className={`px-3 py-2 rounded text-sm font-medium transition-colors cursor-pointer ${
                selectedTool === pingTool.id
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
              title={pingTool.hint || `${pingTool.label} (${pingTool.shortcut})`}
            >
              <span className="mr-1">{pingTool.icon}</span>
              {pingTool.label}
              <span className="ml-1 text-xs opacity-60">({pingTool.shortcut})</span>
            </button>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
            Right-click to pan
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Grid settings - DM only */}
          {map && canEditMap() && (
            <>
              <span className="text-sm text-gray-600 dark:text-gray-400">Grid:</span>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500 dark:text-gray-400">W</span>
                <input
                  type="number"
                  value={width}
                  onChange={(e) => setWidth(e.target.value === "" ? "" : parseInt(e.target.value))}
                  min={5}
                  max={100}
                  className="w-14 px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  title="Grid width (cells)"
                />
                <span className="text-gray-400 dark:text-gray-500">×</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">H</span>
                <input
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(e.target.value === "" ? "" : parseInt(e.target.value))}
                  min={5}
                  max={100}
                  className="w-14 px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
              <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" />
            </>
          )}
          {isDungeonMaster() && (
            <>
              <button
                onClick={togglePlayingLocally}
                className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded-md border cursor-pointer transition-colors ${
                  isPlayingLocally
                    ? "bg-amber-100 border-amber-400 text-amber-800 dark:bg-amber-900/40 dark:border-amber-600 dark:text-amber-300"
                    : "bg-gray-100 border-gray-300 text-gray-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-400"
                }`}
                title={isPlayingLocally ? "Local play: fog is opaque to you" : "Enable local play to see fog as players do"}
              >
                <span>{isPlayingLocally ? "🎲" : "👁"}</span>
                <span>{isPlayingLocally ? "Local Play" : "DM View"}</span>
              </button>
              <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" />
            </>
          )}
          {userName && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                <span className="text-sm font-medium text-white">
                  {userName.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {userName}
              </span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
