import { useState } from "react";
import { BackgroundPanel } from "./BackgroundPanel";
import { TokenPanel } from "./TokenPanel";
import { PresenceList } from "./PresenceList";
import { CombatPanel } from "./CombatPanel";
import { useEditorStore } from "../../store";
import type { Token } from "../../types";

type ActivePanel = "none" | "editMap" | "createUnit";

interface InitiativeEntry {
  tokenId: string;
  tokenName: string;
  tokenColor: string;
  initiative: number;
}

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
}: SidebarProps) {
  const [activePanel, setActivePanel] = useState<ActivePanel>("none");
  const canEditMap = useEditorStore((s) => s.canEditMap);
  const canCreateToken = useEditorStore((s) => s.canCreateToken);
  const isDungeonMaster = useEditorStore((s) => s.isDungeonMaster);

  const togglePanel = (panel: ActivePanel) => {
    setActivePanel(activePanel === panel ? "none" : panel);
  };

  return (
    <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full">
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
        {canCreateToken() && activePanel === "createUnit" && <TokenPanel onEditToken={onEditToken} mode="create" mapId={mapId} onTokenDelete={onTokenDelete} onTokenCreate={onTokenCreate} onSelectAndCenter={onSelectAndCenter} />}

        {/* Token List - Always visible when no panel is open */}
        {activePanel === "none" && (
          <TokenPanel onEditToken={onEditToken} mode="list" mapId={mapId} onTokenDelete={onTokenDelete} onTokenCreate={onTokenCreate} onSelectAndCenter={onSelectAndCenter} />
        )}
      </div>

      {/* Combat Panel */}
      <CombatPanel
        isInCombat={isInCombat}
        initiativeOrder={initiativeOrder}
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
