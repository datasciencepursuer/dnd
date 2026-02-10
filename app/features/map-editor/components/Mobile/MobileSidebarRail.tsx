import { useState } from "react";
import { BackgroundPanel } from "../Sidebar/BackgroundPanel";
import { TokenPanel } from "../Sidebar/TokenPanel";
import { PresenceList } from "../Sidebar/PresenceList";
import { CombatPanel } from "../Sidebar/CombatPanel";
import { DiceHistoryBar } from "../DiceHistoryBar";
import { useEditorStore } from "../../store";
import type { Token, InitiativeEntry, RollResult } from "../../types";

type PanelId = "units" | "create" | "editMap" | "combat" | "players" | "dice";

interface MobileSidebarRailProps {
  mapId?: string;
  onEditToken?: (token: Token) => void;
  onTokenDelete?: (tokenId: string) => void;
  onTokenCreate?: (token: Token) => void;
  onBackgroundChange?: () => void;
  onSelectAndCenter?: (token: Token) => void;
  onCombatRequest?: () => void;
  onStartCombat?: () => void;
  onEndCombat?: () => void;
  isInCombat?: boolean;
  initiativeOrder?: InitiativeEntry[] | null;
  pendingCombatRequest?: { requesterId: string; requesterName: string } | null;
  currentUserName?: string | null;
  currentTurnIndex?: number;
  onNextTurn?: () => void;
  onPrevTurn?: () => void;
  // Dice props
  onDiceRoll?: (roll: RollResult) => void;
  userName?: string | null;
  userId?: string | null;
}

const railButtons: { id: PanelId; label: string; icon: React.ReactNode; condition?: "canCreateToken" | "canEditMap" | "hasMapId" }[] = [
  {
    id: "units",
    label: "Units",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
        <path fillRule="evenodd" d="M6 4.75A.75.75 0 016.75 4h10.5a.75.75 0 010 1.5H6.75A.75.75 0 016 4.75zM6 10a.75.75 0 01.75-.75h10.5a.75.75 0 010 1.5H6.75A.75.75 0 016 10zm0 5.25a.75.75 0 01.75-.75h10.5a.75.75 0 010 1.5H6.75a.75.75 0 01-.75-.75zM1.99 4.75a1 1 0 011-1h.01a1 1 0 010 2h-.01a1 1 0 01-1-1zm0 5.25a1 1 0 011-1h.01a1 1 0 010 2h-.01a1 1 0 01-1-1zm1 4.25a1 1 0 100 2h.01a1 1 0 100-2h-.01z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    id: "create",
    label: "Create",
    condition: "canCreateToken",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
        <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
      </svg>
    ),
  },
  {
    id: "editMap",
    label: "Edit Map",
    condition: "canEditMap",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
        <path fillRule="evenodd" d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.331 1.652a6.993 6.993 0 011.929 1.115l1.598-.54a1 1 0 011.186.447l1.18 2.044a1 1 0 01-.205 1.251l-1.267 1.113a7.047 7.047 0 010 2.228l1.267 1.113a1 1 0 01.206 1.25l-1.18 2.045a1 1 0 01-1.187.447l-1.598-.54a6.993 6.993 0 01-1.929 1.115l-.33 1.652a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.331-1.652a6.993 6.993 0 01-1.929-1.115l-1.598.54a1 1 0 01-1.186-.447l-1.18-2.044a1 1 0 01.205-1.251l1.267-1.114a7.05 7.05 0 010-2.227L1.821 7.773a1 1 0 01-.206-1.25l1.18-2.045a1 1 0 011.187-.447l1.598.54A6.992 6.992 0 017.51 3.456l.33-1.652zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    id: "combat",
    label: "Combat",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
        <path d="M6.92 5H5l5.5 5.5.71-.71L6.92 5zm12.08 0h-1.92l-4.29 4.29.71.71L19 5zM12 9.17L5.83 15.34 4.42 13.93 10.59 7.76l.71.71L5.83 13.93l1.41 1.41L12 10.59l4.76 4.75 1.41-1.41L12.71 8.46l.71-.71 5.46 5.46-1.41 1.42L12 9.17zM3 19v2h18v-2H3z" />
      </svg>
    ),
  },
  {
    id: "players",
    label: "Players",
    condition: "hasMapId",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
        <path d="M7 8a3 3 0 100-6 3 3 0 000 6zM14.5 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM1.615 16.428a1.224 1.224 0 01-.569-1.175 6.002 6.002 0 0111.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 017 18a9.953 9.953 0 01-5.385-1.572zM14.5 16h-.106c.07-.297.088-.611.048-.933a7.47 7.47 0 00-1.588-3.755 4.502 4.502 0 015.874 2.636.818.818 0 01-.36.98A7.465 7.465 0 0114.5 16z" />
      </svg>
    ),
  },
  {
    id: "dice",
    label: "Dice",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M12.378 1.602a.75.75 0 00-.756 0L3 6.632l9 5.25 9-5.25-8.622-5.03zM21.75 7.93l-9 5.25v9l8.628-5.032a.75.75 0 00.372-.648V7.93zm-10.5 14.25v-9l-9-5.25v8.57a.75.75 0 00.372.648l8.628 5.033z" />
      </svg>
    ),
  },
];

export function MobileSidebarRail({
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
  onDiceRoll,
  userName,
  userId,
}: MobileSidebarRailProps) {
  const [activePanel, setActivePanel] = useState<PanelId | null>(null);
  const canEditMap = useEditorStore((s) => s.canEditMap);
  const canCreateToken = useEditorStore((s) => s.canCreateToken);
  const isDungeonMaster = useEditorStore((s) => s.isDungeonMaster);

  const togglePanel = (id: PanelId) => {
    setActivePanel(activePanel === id ? null : id);
  };

  const visibleButtons = railButtons.filter((btn) => {
    if (btn.condition === "canCreateToken") return canCreateToken();
    if (btn.condition === "canEditMap") return canEditMap();
    if (btn.condition === "hasMapId") return !!mapId;
    return true;
  });

  return (
    <div className="relative flex h-full">
      {/* Icon Rail */}
      <div className="w-12 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col items-center pt-2 gap-1 z-30">
        {visibleButtons.map((btn) => (
          <button
            key={btn.id}
            onClick={() => togglePanel(btn.id)}
            className={`relative w-10 h-10 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
              activePanel === btn.id
                ? "bg-blue-600 text-white"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
            title={btn.label}
          >
            {btn.icon}
            {/* Red dot for active combat */}
            {btn.id === "combat" && isInCombat && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Overlay Panel */}
      {activePanel && (
        <div className="absolute left-12 top-0 bottom-0 w-[280px] z-20 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-lg flex flex-col transition-all duration-200">
          {/* Panel Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {railButtons.find((b) => b.id === activePanel)?.label}
            </span>
            <button
              onClick={() => setActivePanel(null)}
              className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          </div>

          {/* Panel Content */}
          <div className="flex-1 overflow-y-auto">
            {activePanel === "units" && (
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
            {activePanel === "create" && canCreateToken() && (
              <TokenPanel
                onEditToken={onEditToken}
                mode="create"
                mapId={mapId}
                onTokenDelete={onTokenDelete}
                onTokenCreate={onTokenCreate}
                onSelectAndCenter={onSelectAndCenter}
              />
            )}
            {activePanel === "editMap" && canEditMap() && (
              <BackgroundPanel mapId={mapId} onBackgroundChange={onBackgroundChange} />
            )}
            {activePanel === "combat" && (
              <>
                <CombatPanel
                  isInCombat={isInCombat}
                  onCombatRequest={onCombatRequest}
                  onStartCombat={onStartCombat}
                  onEndCombat={onEndCombat}
                  isDM={isDungeonMaster()}
                  pendingRequest={pendingCombatRequest}
                  currentUserName={currentUserName}
                />
                {isInCombat && initiativeOrder && (
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
              </>
            )}
            {activePanel === "players" && mapId && (
              <PresenceList mapId={mapId} />
            )}
            {activePanel === "dice" && (
              <DiceHistoryBar onRoll={onDiceRoll} userName={userName} userId={userId} variant="panel" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
