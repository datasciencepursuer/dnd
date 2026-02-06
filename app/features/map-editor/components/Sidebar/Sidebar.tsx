import { useState } from "react";
import { BackgroundPanel } from "./BackgroundPanel";
import { TokenPanel } from "./TokenPanel";
import { PresenceList } from "./PresenceList";
import { CombatPanel } from "./CombatPanel";
import { useEditorStore } from "../../store";
import type { Token, InitiativeEntry } from "../../types";

type ActivePanel = "none" | "editMap" | "createUnit";

interface SidebarProps {
  mapId?: string;
  onEditToken?: (token: Token) => void;
  onTokenDelete?: (tokenId: string) => void;
  onTokenCreate?: (token: Token) => void;
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
}

export function Sidebar({
  mapId,
  onEditToken,
  onTokenDelete,
  onTokenCreate,
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
}: SidebarProps) {
  const [activePanel, setActivePanel] = useState<ActivePanel>("none");
  const canEditMap = useEditorStore((s) => s.canEditMap);
  const canCreateToken = useEditorStore((s) => s.canCreateToken);
  const isDungeonMaster = useEditorStore((s) => s.isDungeonMaster);

  const togglePanel = (panel: ActivePanel) => {
    setActivePanel(activePanel === panel ? "none" : panel);
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
        {canEditMap() && activePanel === "editMap" && <BackgroundPanel mapId={mapId} onBackgroundChange={onBackgroundChange} />}
        {canCreateToken() && activePanel === "createUnit" && (
          <TokenPanel
            onEditToken={onEditToken}
            mode="create"
            mapId={mapId}
            onTokenDelete={onTokenDelete}
            onTokenCreate={onTokenCreate}
            onSelectAndCenter={onSelectAndCenter}
            isInCombat={isInCombat}
            initiativeOrder={initiativeOrder}
            currentTurnIndex={currentTurnIndex}
            onNextTurn={onNextTurn}
            onPrevTurn={onPrevTurn}
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
      />

      {/* Players Online */}
      <PresenceList mapId={mapId} />
    </div>
  );
}
