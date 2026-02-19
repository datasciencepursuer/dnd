import { useState } from "react";
import { BackgroundPanel } from "./BackgroundPanel";
import { TokenPanel } from "./TokenPanel";
import { WallAreaPanel } from "./WallAreaPanel";
import { SceneSelector } from "./SceneSelector";
import { PresenceList } from "./PresenceList";
import { CombatPanel } from "./CombatPanel";
import { useEditorStore, useMapStore } from "../../store";
import type { Token, MonsterGroup, InitiativeEntry, WallSegment, AreaShape, EditorTool, WallType, TerrainType } from "../../types";
import type { ChatMessageData } from "../../store/chat-store";
import type { TierLimits } from "~/lib/tier-limits";

const mapEditTools: { id: EditorTool; label: string; icon: string; shortcut: string; hint?: string }[] = [
  { id: "fog", label: "Fog", icon: "🌫", shortcut: "4", hint: "Drag to paint fog" },
  { id: "wall", label: "Wall", icon: "🧱", shortcut: "5", hint: "Click to place wall points, double-click to finish" },
  { id: "area", label: "Area", icon: "🗺", shortcut: "6", hint: "Click and drag to create terrain area" },
];

const WALL_TYPE_OPTIONS: { value: WallType; label: string }[] = [
  { value: "wall", label: "Wall" },
  { value: "half-wall", label: "Half Wall" },
  { value: "window", label: "Window" },
  { value: "arrow-slit", label: "Arrow Slit" },
  { value: "door-closed", label: "Door (Closed)" },
  { value: "door-open", label: "Door (Open)" },
  { value: "door-locked", label: "Door (Locked)" },
  { value: "pillar", label: "Pillar" },
  { value: "fence", label: "Fence" },
];

const TERRAIN_TYPE_OPTIONS: { value: TerrainType; label: string }[] = [
  { value: "difficult", label: "Difficult" },
  { value: "water-shallow", label: "Shallow Water" },
  { value: "water-deep", label: "Deep Water" },
  { value: "ice", label: "Ice" },
  { value: "lava", label: "Lava" },
  { value: "pit", label: "Pit" },
  { value: "chasm", label: "Chasm" },
  { value: "elevated", label: "Elevated" },
  { value: "vegetation", label: "Vegetation" },
  { value: "darkness", label: "Darkness" },
  { value: "trap", label: "Trap" },
  { value: "normal", label: "Normal" },
];

type ActivePanel = "none" | "editMap" | "createUnit";

interface SidebarProps {
  mapId?: string;
  onEditToken?: (token: Token) => void;
  onTokenDelete?: (tokenId: string) => void;
  onTokenCreate?: (token: Token) => void;
  onMapChanged?: () => void;
  onBackgroundChange?: () => void;
  onSelectAndCenter?: (token: Token) => void;
  // Combat props
  onCombatRequest?: () => void;
  onStartCombat?: () => void;
  onEndCombat?: () => void;
  isInCombat?: boolean;
  initiativeOrder?: InitiativeEntry[] | null;
  pendingCombatRequest?: { requesterId: string; requesterName: string } | null;
  currentUserName?: string | null;
  // Turn tracking props
  currentTurnIndex?: number;
  onNextTurn?: () => void;
  onPrevTurn?: () => void;
  // AI DM props
  aiLoading?: boolean;
  onAiPrompt?: (prompt: string) => void;
  // AI Battle Engine props
  aiBattleEngine?: boolean;
  onAiBattleEngineChange?: (enabled: boolean) => void;
  userId?: string | null;
  onSendMessage?: (chatMessage: ChatMessageData) => void;
  // Wall/area selection props
  selectedWallId?: string | null;
  selectedAreaId?: string | null;
  onUpdateWall?: (id: string, updates: Partial<WallSegment>) => void;
  onDeleteWall?: (id: string) => void;
  onUpdateArea?: (id: string, updates: Partial<AreaShape>) => void;
  onDeleteArea?: (id: string) => void;
  // Scene props (DM only)
  onSwitchScene?: (sceneId: string, importTokens?: Token[], importGroups?: MonsterGroup[]) => void;
  onCreateScene?: (name: string) => void;
  onDeleteScene?: (sceneId: string) => void;
  onRenameScene?: (sceneId: string, newName: string) => void;
  onDuplicateScene?: (sceneId: string) => void;
  tierLimits?: TierLimits;
}

export function Sidebar({
  mapId,
  onEditToken,
  onTokenDelete,
  onTokenCreate,
  onMapChanged,
  onBackgroundChange,
  onSelectAndCenter,
  onCombatRequest,
  onStartCombat,
  onEndCombat,
  isInCombat = false,
  initiativeOrder = null,
  pendingCombatRequest = null,
  currentUserName = null,
  currentTurnIndex = 0,
  onNextTurn,
  onPrevTurn,
  aiLoading = false,
  onAiPrompt,
  aiBattleEngine = false,
  onAiBattleEngineChange,
  userId = null,
  onSendMessage,
  selectedWallId = null,
  selectedAreaId = null,
  onUpdateWall,
  onDeleteWall,
  onUpdateArea,
  onDeleteArea,
  onSwitchScene,
  onCreateScene,
  onDeleteScene,
  onRenameScene,
  onDuplicateScene,
  tierLimits,
}: SidebarProps) {
  const [activePanel, setActivePanel] = useState<ActivePanel>("none");
  const canEditMap = useEditorStore((s) => s.canEditMap);
  const canCreateToken = useEditorStore((s) => s.canCreateToken);
  const isDungeonMaster = useEditorStore((s) => s.isDungeonMaster);
  const isPlayingLocally = useEditorStore((s) => s.isPlayingLocally);
  const setBuildMode = useEditorStore((s) => s.setBuildMode);
  const selectedTool = useEditorStore((s) => s.selectedTool);
  const setTool = useEditorStore((s) => s.setTool);
  const currentWallType = useEditorStore((s) => s.currentWallType);
  const setWallType = useEditorStore((s) => s.setWallType);
  const currentTerrainType = useEditorStore((s) => s.currentTerrainType);
  const setTerrainType = useEditorStore((s) => s.setTerrainType);

  // Lookup selected wall/area from map store
  const walls = useMapStore((s) => s.map?.walls ?? []);
  const areas = useMapStore((s) => s.map?.areas ?? []);
  const selectedWall = selectedWallId ? walls.find((w) => w.id === selectedWallId) ?? null : null;
  const selectedArea = selectedAreaId ? areas.find((a) => a.id === selectedAreaId) ?? null : null;

  const togglePanel = (panel: ActivePanel) => {
    const newPanel = activePanel === panel ? "none" : panel;
    setActivePanel(newPanel);
    setBuildMode(newPanel === "editMap");
  };

  const handleSetupEnvironment = () => {
    setActivePanel("editMap");
    setBuildMode(true);
    setTool("wall");
  };

  const [isCollapsed, setIsCollapsed] = useState(false);

  if (isCollapsed) {
    return (
      <div className="relative w-0">
        <button
          onClick={() => setIsCollapsed(false)}
          className="absolute top-3 left-0 z-10 flex items-center justify-center w-6 h-12 bg-white dark:bg-gray-800 border border-l-0 border-gray-300 dark:border-gray-600 rounded-r-lg shadow-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer"
          title="Expand sidebar"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-56 lg:w-64 xl:w-72 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full">
      {/* Collapse tab on right edge */}
      <button
        onClick={() => setIsCollapsed(true)}
        className="absolute top-3 -right-6 z-10 flex items-center justify-center w-6 h-12 bg-white dark:bg-gray-800 border border-l-0 border-gray-300 dark:border-gray-600 rounded-r-lg shadow-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer"
        title="Collapse sidebar"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
        </svg>
      </button>
      {/* Scene Selector - DM only, hidden in local play */}
      {isDungeonMaster() && !isPlayingLocally && onSwitchScene && onCreateScene && onDeleteScene && onRenameScene && onDuplicateScene && (
        <SceneSelector
          onSwitchScene={onSwitchScene}
          onCreateScene={onCreateScene}
          onDeleteScene={onDeleteScene}
          onRenameScene={onRenameScene}
          onDuplicateScene={onDuplicateScene}
          maxScenes={tierLimits?.maxScenesPerMap}
        />
      )}
      {/* Action Buttons */}
      <div className="p-3 space-y-2 border-b border-gray-200 dark:border-gray-700">
        {/* Edit Map - DM only */}
        {canEditMap() && (
          <button
            onClick={() => togglePanel("editMap")}
            className={`w-full px-4 py-2 rounded font-medium cursor-pointer transition-colors ${
              activePanel === "editMap"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            }`}
          >
            Edit Map
          </button>
        )}
        {/* Create Unit - everyone */}
        {canCreateToken() && (
          <button
            onClick={() => togglePanel("createUnit")}
            className={`w-full px-4 py-2 rounded font-medium cursor-pointer transition-colors ${
              activePanel === "createUnit"
                ? "bg-green-600 text-white"
                : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            }`}
          >
            Create Unit
          </button>
        )}
      </div>

      {/* Collapsible Panels / Units List */}
      <div className="flex-1 overflow-y-auto">
        {canEditMap() && activePanel === "editMap" && (
          <>
            <BackgroundPanel mapId={mapId} onBackgroundChange={onBackgroundChange} />
            {/* DM Tools: Fog, Wall, Area */}
            <div className="px-3 py-2 space-y-2 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Tools</h3>
              <div className="grid grid-cols-3 gap-1.5">
                {mapEditTools.map((tool) => {
                  const isLocked = (tool.id === "wall" || tool.id === "area") && tierLimits && !tierLimits.wallsAndTerrain;
                  return (
                    <button
                      key={tool.id}
                      onClick={() => !isLocked && setTool(tool.id)}
                      disabled={!!isLocked}
                      className={`flex flex-col items-center gap-0.5 px-2 py-2 rounded text-xs font-medium transition-colors ${
                        isLocked
                          ? "opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500"
                          : selectedTool === tool.id
                            ? "bg-blue-600 text-white cursor-pointer"
                            : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer"
                      }`}
                      title={isLocked ? `${tool.label} requires Hero plan` : tool.hint || `${tool.label} (${tool.shortcut})`}
                    >
                      <span className="text-base">{tool.icon}</span>
                      <span>{tool.label}</span>
                    </button>
                  );
                })}
              </div>
              {/* Wall type selector */}
              {selectedTool === "wall" && (
                <div className="pt-1">
                  <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Wall Type</label>
                  <select
                    value={currentWallType}
                    onChange={(e) => setWallType(e.target.value as WallType)}
                    className="w-full text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                  >
                    {WALL_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              )}
              {/* Terrain type selector */}
              {selectedTool === "area" && (
                <div className="pt-1">
                  <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Terrain Type</label>
                  <select
                    value={currentTerrainType}
                    onChange={(e) => setTerrainType(e.target.value as TerrainType)}
                    className="w-full text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                  >
                    {TERRAIN_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </>
        )}
        {canCreateToken() && activePanel === "createUnit" && (
          <TokenPanel
            onEditToken={onEditToken}
            mode="create"
            mapId={mapId}
            onTokenDelete={onTokenDelete}
            onTokenCreate={onTokenCreate}
            onMapChanged={onMapChanged}
            onSelectAndCenter={onSelectAndCenter}
            isInCombat={isInCombat}
            initiativeOrder={initiativeOrder}
            currentTurnIndex={currentTurnIndex}
            onNextTurn={onNextTurn}
            onPrevTurn={onPrevTurn}
            aiBattleEngine={aiBattleEngine}
            onAiBattleEngineChange={onAiBattleEngineChange}
            tierLimits={tierLimits}
          />
        )}

        {/* Wall/Area Properties Panel */}
        {(selectedWall || selectedArea) && (
          <WallAreaPanel
            selectedWall={selectedWall}
            selectedArea={selectedArea}
            onUpdateWall={onUpdateWall}
            onDeleteWall={onDeleteWall}
            onUpdateArea={onUpdateArea}
            onDeleteArea={onDeleteArea}
          />
        )}

        {/* Token List - Always visible when no panel is open */}
        {activePanel === "none" && (
          <TokenPanel
            onEditToken={onEditToken}
            mode="list"
            mapId={mapId}
            onTokenDelete={onTokenDelete}
            onTokenCreate={onTokenCreate}
            onSelectAndCenter={onSelectAndCenter}
            isInCombat={isInCombat}
            initiativeOrder={initiativeOrder}
            currentTurnIndex={currentTurnIndex}
            onNextTurn={onNextTurn}
            onPrevTurn={onPrevTurn}
            aiBattleEngine={aiBattleEngine}
            onAiBattleEngineChange={onAiBattleEngineChange}
            tierLimits={tierLimits}
          />
        )}
      </div>

      {/* Combat Panel */}
      <CombatPanel
        isInCombat={isInCombat}
        onCombatRequest={onCombatRequest}
        onStartCombat={onStartCombat}
        onEndCombat={onEndCombat}
        isDM={isDungeonMaster()}
        pendingRequest={pendingCombatRequest}
        currentUserName={currentUserName}
        aiLoading={aiLoading}
        aiBattleEngine={aiBattleEngine}
        onAiBattleEngineChange={onAiBattleEngineChange}
        onAiPrompt={onAiPrompt}
        onSetupEnvironment={handleSetupEnvironment}
        tierLimits={tierLimits}
      />

      {/* Players Online */}
      <PresenceList mapId={mapId} />
    </div>
  );
}
