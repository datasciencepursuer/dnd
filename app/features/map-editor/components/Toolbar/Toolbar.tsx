import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useRevalidator } from "react-router";
import { useEditorStore, useMapStore } from "../../store";
import { MIN_ZOOM, MAX_ZOOM, ZOOM_STEP, ZOOM_REFERENCE } from "../../constants";
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
  onGridChange?: () => void;
}

export function Toolbar({ userName, userId, mapId, groupMembers = [], onDmTransfer, onGridChange }: ToolbarProps) {
  const selectedTool = useEditorStore((s) => s.selectedTool);
  const setTool = useEditorStore((s) => s.setTool);
  const canEditMap = useEditorStore((s) => s.canEditMap);
  const isDungeonMaster = useEditorStore((s) => s.isDungeonMaster);
  const isPlayingLocally = useEditorStore((s) => s.isPlayingLocally);
  const togglePlayingLocally = useEditorStore((s) => s.togglePlayingLocally);

  const getCanvasDimensions = useEditorStore((s) => s.getCanvasDimensions);

  const map = useMapStore((s) => s.map);
  const updateGrid = useMapStore((s) => s.updateGrid);
  const updateMapName = useMapStore((s) => s.updateMapName);
  const setViewport = useMapStore((s) => s.setViewport);

  const [mapName, setMapName] = useState(map?.name ?? "");
  const [width, setWidth] = useState<number | string>(map?.grid.width ?? 30);
  const [height, setHeight] = useState<number | string>(map?.grid.height ?? 20);
  const [showDmDropdown, setShowDmDropdown] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [zoomInputFocused, setZoomInputFocused] = useState(false);
  const [zoomInputValue, setZoomInputValue] = useState("");
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  const dmDropdownRef = useRef<HTMLDivElement>(null);
  const overflowMenuRef = useRef<HTMLDivElement>(null);
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

  // Close overflow menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (overflowMenuRef.current && !overflowMenuRef.current.contains(e.target as Node)) {
        setShowOverflowMenu(false);
      }
    };
    if (showOverflowMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showOverflowMenu]);

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
    onGridChange?.();
  };

  const handleZoom = (newScale: number) => {
    if (!map) return;
    const oldScale = map.viewport.scale;
    const { width: cw, height: ch } = getCanvasDimensions();
    // Zoom centered on the canvas
    const centerX = cw / 2;
    const centerY = ch / 2;
    const pointX = (centerX - map.viewport.x) / oldScale;
    const pointY = (centerY - map.viewport.y) / oldScale;
    const newX = centerX - pointX * newScale;
    const newY = centerY - pointY * newScale;
    setViewport(newX, newY, newScale);
  };

  // Hold-to-zoom with ramping speed
  const zoomHoldRef = useRef<{ interval: ReturnType<typeof setInterval> | null; ticks: number }>({
    interval: null,
    ticks: 0,
  });

  const stopZoomHold = useCallback(() => {
    if (zoomHoldRef.current.interval) {
      clearInterval(zoomHoldRef.current.interval);
      zoomHoldRef.current.interval = null;
    }
    zoomHoldRef.current.ticks = 0;
  }, []);

  useEffect(() => stopZoomHold, [stopZoomHold]);

  const startZoomHold = useCallback((direction: 1 | -1) => {
    stopZoomHold();

    const doStep = () => {
      const s = useMapStore.getState().map;
      if (!s) { stopZoomHold(); return; }

      const ticks = zoomHoldRef.current.ticks++;
      const oldScale = s.viewport.scale;
      const dims = getCanvasDimensions();
      const cx = dims.width / 2;
      const cy = dims.height / 2;
      const px = (cx - s.viewport.x) / oldScale;
      const py = (cy - s.viewport.y) / oldScale;

      // After long hold, jump straight to the limit
      if (ticks > 25) {
        const target = direction > 0 ? MAX_ZOOM : MIN_ZOOM;
        setViewport(cx - px * target, cy - py * target, target);
        stopZoomHold();
        return;
      }

      let multiplier = 1;
      if (ticks > 15) multiplier = 4;
      else if (ticks > 8) multiplier = 2;

      const newScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM,
        Math.round((oldScale + direction * ZOOM_STEP * multiplier) * 100) / 100
      ));
      if (newScale === oldScale) { stopZoomHold(); return; }
      setViewport(cx - px * newScale, cy - py * newScale, newScale);
    };

    doStep();
    zoomHoldRef.current.interval = setInterval(doStep, 80);
  }, [stopZoomHold, getCanvasDimensions, setViewport]);

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
            className="p-2 lg:px-3 lg:py-2 rounded text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors cursor-pointer"
          >
            ←<span className="hidden lg:inline"> Maps</span>
          </Link>
          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 hidden lg:block" />
          <input
            type="text"
            value={mapName}
            onChange={handleNameChange}
            placeholder="Map name"
            disabled={!canEditMap()}
            className="hidden lg:block px-3 py-1.5 text-sm font-medium rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-w-[150px] disabled:opacity-50"
          />
          {/* Role indicator - clickable for DM to transfer */}
          <div className="relative hidden lg:flex" ref={dmDropdownRef}>
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
                className={`p-2 lg:px-3 lg:py-2 rounded text-sm font-medium transition-colors cursor-pointer ${
                  selectedTool === tool.id
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
                title={tool.hint || `${tool.label} (${tool.shortcut})`}
              >
                <span className="lg:mr-1">{tool.icon}</span>
                <span className="hidden lg:inline">{tool.label}</span>
                <span className="hidden lg:inline ml-1 text-xs opacity-60">({tool.shortcut})</span>
              </button>
            ))}
            {/* Draw tool - available to everyone */}
            <button
              onClick={() => setTool(drawTool.id)}
              className={`p-2 lg:px-3 lg:py-2 rounded text-sm font-medium transition-colors cursor-pointer ${
                selectedTool === drawTool.id
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
              title={drawTool.hint || `${drawTool.label} (${drawTool.shortcut})`}
            >
              <span className="lg:mr-1">{drawTool.icon}</span>
              <span className="hidden lg:inline">{drawTool.label}</span>
              <span className="hidden lg:inline ml-1 text-xs opacity-60">({drawTool.shortcut})</span>
            </button>
            {/* Erase tool - available to everyone */}
            <button
              onClick={() => setTool(eraseTool.id)}
              className={`p-2 lg:px-3 lg:py-2 rounded text-sm font-medium transition-colors cursor-pointer ${
                selectedTool === eraseTool.id
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
              title={eraseTool.hint || `${eraseTool.label} (${eraseTool.shortcut})`}
            >
              <span className="lg:mr-1">{eraseTool.icon}</span>
              <span className="hidden lg:inline">{eraseTool.label}</span>
              <span className="hidden lg:inline ml-1 text-xs opacity-60">({eraseTool.shortcut})</span>
            </button>
            {/* Fog tool - DM only */}
            {canEditMap() && mapEditTools.map((tool) => (
              <button
                key={tool.id}
                onClick={() => setTool(tool.id)}
                className={`p-2 lg:px-3 lg:py-2 rounded text-sm font-medium transition-colors cursor-pointer ${
                  selectedTool === tool.id
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
                title={tool.hint || `${tool.label} (${tool.shortcut})`}
              >
                <span className="lg:mr-1">{tool.icon}</span>
                <span className="hidden lg:inline">{tool.label}</span>
                <span className="hidden lg:inline ml-1 text-xs opacity-60">({tool.shortcut})</span>
              </button>
            ))}
            <button
              onClick={() => setTool(pingTool.id)}
              className={`p-2 lg:px-3 lg:py-2 rounded text-sm font-medium transition-colors cursor-pointer ${
                selectedTool === pingTool.id
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
              title={pingTool.hint || `${pingTool.label} (${pingTool.shortcut})`}
            >
              <span className="lg:mr-1">{pingTool.icon}</span>
              <span className="hidden lg:inline">{pingTool.label}</span>
              <span className="hidden lg:inline ml-1 text-xs opacity-60">({pingTool.shortcut})</span>
            </button>
          </div>
          <span className="hidden lg:inline text-xs text-gray-500 dark:text-gray-400 ml-2">
            Right-click to pan
          </span>
          <span className="lg:hidden text-xs text-gray-500 dark:text-gray-400 ml-1">
            Two-finger drag to pan
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Zoom controls */}
          {map && (
            <>
              <div className="flex items-center gap-1">
                <button
                  onMouseDown={() => startZoomHold(-1)}
                  onMouseUp={stopZoomHold}
                  onMouseLeave={stopZoomHold}
                  onTouchStart={() => startZoomHold(-1)}
                  onTouchEnd={stopZoomHold}
                  onContextMenu={(e) => e.preventDefault()}
                  disabled={map.viewport.scale <= MIN_ZOOM}
                  className="w-9 h-9 flex items-center justify-center rounded-lg text-lg font-bold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 active:bg-gray-300 dark:active:bg-gray-500 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors select-none"
                  title="Zoom out (hold to ramp)"
                >
                  −
                </button>
                <input
                  type="range"
                  min={MIN_ZOOM}
                  max={MAX_ZOOM}
                  step={ZOOM_STEP}
                  value={map.viewport.scale}
                  onChange={(e) => handleZoom(parseFloat(e.target.value))}
                  className="hidden lg:block w-24 h-1.5 accent-blue-600 cursor-pointer"
                  title={`Zoom: ${Math.round(map.viewport.scale / ZOOM_REFERENCE * 100)}%`}
                />
                <button
                  onMouseDown={() => startZoomHold(1)}
                  onMouseUp={stopZoomHold}
                  onMouseLeave={stopZoomHold}
                  onTouchStart={() => startZoomHold(1)}
                  onTouchEnd={stopZoomHold}
                  onContextMenu={(e) => e.preventDefault()}
                  disabled={map.viewport.scale >= MAX_ZOOM}
                  className="w-9 h-9 flex items-center justify-center rounded-lg text-lg font-bold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 active:bg-gray-300 dark:active:bg-gray-500 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors select-none"
                  title="Zoom in (hold to ramp)"
                >
                  +
                </button>
                <input
                  type="text"
                  inputMode="numeric"
                  value={zoomInputFocused ? zoomInputValue : `${Math.round(map.viewport.scale / ZOOM_REFERENCE * 100)}%`}
                  onFocus={(e) => {
                    setZoomInputFocused(true);
                    setZoomInputValue(`${Math.round(map.viewport.scale / ZOOM_REFERENCE * 100)}`);
                    requestAnimationFrame(() => e.target.select());
                  }}
                  onChange={(e) => setZoomInputValue(e.target.value.replace(/[^0-9]/g, ""))}
                  onBlur={() => {
                    setZoomInputFocused(false);
                    const pct = parseInt(zoomInputValue, 10);
                    if (!isNaN(pct) && pct > 0) {
                      const newScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, (pct / 100) * ZOOM_REFERENCE));
                      handleZoom(newScale);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      (e.target as HTMLInputElement).blur();
                    } else if (e.key === "Escape") {
                      setZoomInputFocused(false);
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  className="hidden lg:block w-12 text-xs font-medium text-gray-600 dark:text-gray-400 text-center tabular-nums bg-transparent border border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none rounded py-0.5"
                />
              </div>
              <div className="hidden lg:block w-px h-6 bg-gray-300 dark:bg-gray-600" />
            </>
          )}
          {/* Grid settings - desktop only */}
          {map && (
            <div className="hidden lg:flex items-center gap-1">
              <span className="text-sm text-gray-600 dark:text-gray-400">Grid:</span>
              {canEditMap() ? (
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
                  <span className="text-gray-400 dark:text-gray-500">&times;</span>
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
              ) : (
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {map.grid.width} &times; {map.grid.height}
                </span>
              )}
              {canEditMap() && hasChanges && (
                <button
                  onClick={handleApply}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
                >
                  Apply
                </button>
              )}
              <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 ml-2" />
            </div>
          )}
          {/* Local play toggle - desktop only */}
          {isDungeonMaster() && (
            <div className="hidden lg:flex items-center gap-3">
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
            </div>
          )}
          {/* User avatar - desktop only */}
          {userName && (
            <div className="hidden lg:flex items-center gap-2">
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
          {/* Mobile overflow menu */}
          <div className="flex lg:hidden relative" ref={overflowMenuRef}>
            <button
              onClick={() => setShowOverflowMenu(!showOverflowMenu)}
              className="p-2 rounded text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors cursor-pointer"
              title="More options"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path d="M3 10a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zM8.5 10a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zM15.5 8.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" />
              </svg>
            </button>
            {showOverflowMenu && (
              <div className="absolute right-0 top-full mt-1 z-50 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 space-y-3">
                {/* Map name */}
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Map Name</label>
                  <input
                    type="text"
                    value={mapName}
                    onChange={handleNameChange}
                    placeholder="Map name"
                    disabled={!canEditMap()}
                    className="w-full px-3 py-1.5 text-sm font-medium rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                  />
                </div>
                {/* Role badge - with DM transfer on mobile */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Role:</span>
                  {isDungeonMaster() && transferOptions.length > 0 ? (
                    <div className="relative">
                      <button
                        onClick={() => setShowDmDropdown(!showDmDropdown)}
                        className="text-xs px-2 py-1 rounded bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800 cursor-pointer flex items-center gap-1"
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
                    </div>
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
                {/* Grid settings - DM only */}
                {map && canEditMap() && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Grid Size</label>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500 dark:text-gray-400">W</span>
                      <input
                        type="number"
                        value={width}
                        onChange={(e) => setWidth(e.target.value === "" ? "" : parseInt(e.target.value))}
                        min={5}
                        max={100}
                        className="w-14 px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                      <span className="text-gray-400 dark:text-gray-500">&times;</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">H</span>
                      <input
                        type="number"
                        value={height}
                        onChange={(e) => setHeight(e.target.value === "" ? "" : parseInt(e.target.value))}
                        min={5}
                        max={100}
                        className="w-14 px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                      {hasChanges && (
                        <button
                          onClick={handleApply}
                          className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
                        >
                          Apply
                        </button>
                      )}
                    </div>
                  </div>
                )}
                {/* Local play toggle - DM only */}
                {isDungeonMaster() && (
                  <button
                    onClick={togglePlayingLocally}
                    className={`w-full flex items-center gap-1.5 px-2 py-1.5 text-xs rounded-md border cursor-pointer transition-colors ${
                      isPlayingLocally
                        ? "bg-amber-100 border-amber-400 text-amber-800 dark:bg-amber-900/40 dark:border-amber-600 dark:text-amber-300"
                        : "bg-gray-100 border-gray-300 text-gray-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-400"
                    }`}
                  >
                    <span>{isPlayingLocally ? "🎲" : "👁"}</span>
                    <span>{isPlayingLocally ? "Local Play" : "DM View"}</span>
                  </button>
                )}
                {/* User info */}
                {userName && (
                  <div className="flex items-center gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center">
                      <span className="text-xs font-medium text-white">
                        {userName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {userName}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
