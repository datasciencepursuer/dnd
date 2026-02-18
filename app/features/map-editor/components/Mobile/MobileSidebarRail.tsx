import { useState } from "react";
import { BackgroundPanel } from "../Sidebar/BackgroundPanel";
import { TokenPanel } from "../Sidebar/TokenPanel";
import { SceneSelector } from "../Sidebar/SceneSelector";
import { PresenceList } from "../Sidebar/PresenceList";
import { CombatPanel } from "../Sidebar/CombatPanel";
import { ChatPanel } from "../ChatPanel";
import { useEditorStore, useChatStore } from "../../store";
import type { Token, InitiativeEntry } from "../../types";
import type { ChatMessageData } from "../../store/chat-store";
import type { TierLimits } from "~/lib/tier-limits";

type PanelId = "units" | "create" | "editMap" | "players" | "scenes";

interface MobileSidebarRailProps {
  mapId?: string;
  onEditToken?: (token: Token) => void;
  onTokenDelete?: (tokenId: string) => void;
  onTokenCreate?: (token: Token) => void;
  onMapChanged?: () => void;
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
  userName?: string | null;
  userId?: string | null;
  onSendChatMessage?: (chatMessage: ChatMessageData) => void;
  onClearChat?: () => void;
  isDM?: boolean;
  mapOwnerId?: string;
  aiLoading?: boolean;
  onAiPrompt?: (prompt: string) => void;
  // AI Battle Engine props
  aiBattleEngine?: boolean;
  onAiBattleEngineChange?: (enabled: boolean) => void;
  // Scene props (DM only)
  onSwitchScene?: (sceneId: string) => void;
  onCreateScene?: (name: string) => void;
  onDeleteScene?: (sceneId: string) => void;
  onRenameScene?: (sceneId: string, newName: string) => void;
  onDuplicateScene?: (sceneId: string) => void;
  tierLimits?: TierLimits;
}

// Ordered by frequency of use: most accessed → least accessed
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
    id: "scenes",
    label: "Scenes",
    condition: "canEditMap",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
        <path d="M2 4.25A2.25 2.25 0 014.25 2h6.5A2.25 2.25 0 0113 4.25v2a.75.75 0 01-1.5 0v-2a.75.75 0 00-.75-.75h-6.5a.75.75 0 00-.75.75v11.5c0 .414.336.75.75.75h6.5a.75.75 0 00.75-.75v-2a.75.75 0 011.5 0v2A2.25 2.25 0 0110.75 18h-6.5A2.25 2.25 0 012 15.75V4.25z" />
        <path d="M7.25 2A2.25 2.25 0 019.5 4.25v11.5A2.25 2.25 0 017.25 18h2.5A2.25 2.25 0 0012 15.75V4.25A2.25 2.25 0 009.75 2h-2.5z" />
        <path d="M12.25 2A2.25 2.25 0 0114.5 4.25v11.5A2.25 2.25 0 0112.25 18h3.5A2.25 2.25 0 0018 15.75V4.25A2.25 2.25 0 0015.75 2h-3.5z" />
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
    id: "players",
    label: "Players",
    condition: "hasMapId",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
        <path d="M7 8a3 3 0 100-6 3 3 0 000 6zM14.5 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM1.615 16.428a1.224 1.224 0 01-.569-1.175 6.002 6.002 0 0111.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 017 18a9.953 9.953 0 01-5.385-1.572zM14.5 16h-.106c.07-.297.088-.611.048-.933a7.47 7.47 0 00-1.588-3.755 4.502 4.502 0 015.874 2.636.818.818 0 01-.36.98A7.465 7.465 0 0114.5 16z" />
      </svg>
    ),
  },
];

export function MobileSidebarRail({
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
  userName,
  userId,
  onSendChatMessage,
  onClearChat,
  isDM = false,
  mapOwnerId,
  aiLoading = false,
  onAiPrompt,
  aiBattleEngine = false,
  onAiBattleEngineChange,
  onSwitchScene,
  onCreateScene,
  onDeleteScene,
  onRenameScene,
  onDuplicateScene,
  tierLimits,
}: MobileSidebarRailProps) {
  const [activePanel, setActivePanel] = useState<PanelId | null>(null);
  const [chatOpen, setChatOverlay] = useState(false);
  const canEditMap = useEditorStore((s) => s.canEditMap);
  const canCreateToken = useEditorStore((s) => s.canCreateToken);
  const isDungeonMaster = useEditorStore((s) => s.isDungeonMaster);
  const isPlayingLocally = useEditorStore((s) => s.isPlayingLocally);
  const setBuildMode = useEditorStore((s) => s.setBuildMode);
  const setTool = useEditorStore((s) => s.setTool);
  const unreadCount = useChatStore((s) => s.unreadCount);
  const setChatOpen = useChatStore((s) => s.setOpen);

  const dismissAll = () => {
    setActivePanel(null);
    setChatOverlay(false);
    setChatOpen(false);
  };

  const togglePanel = (id: PanelId) => {
    setChatOverlay(false);
    setChatOpen(false);
    setActivePanel(activePanel === id ? null : id);
  };

  const handleSetupEnvironment = () => {
    setChatOverlay(false);
    setChatOpen(false);
    setActivePanel("editMap");
    setBuildMode(true);
    setTool("wall");
  };

  const toggleChat = () => {
    const next = !chatOpen;
    setChatOverlay(next);
    setChatOpen(next);
    if (next) setActivePanel(null);
  };

  const visibleButtons = railButtons.filter((btn) => {
    if (btn.condition === "canCreateToken") return canCreateToken();
    if (btn.condition === "canEditMap") return canEditMap();
    if (btn.condition === "hasMapId") return !!mapId;
    // Hide scenes button in local play mode
    if (btn.id === "scenes" && isPlayingLocally) return false;
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
            {/* Red dot for active combat on units button */}
            {btn.id === "units" && isInCombat && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Dismiss backdrop - tap canvas area to close everything */}
      {(activePanel || chatOpen) && (
        <div
          className="fixed inset-0 z-10"
          onClick={dismissAll}
          onTouchStart={dismissAll}
        />
      )}

      {/* Rail Overlay Panel */}
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
          <div className="flex-1 overflow-hidden">
            {activePanel === "units" && (
              <div className="h-full overflow-y-auto">
                {/* Combat controls inline at top */}
                <CombatPanel
                  isInCombat={isInCombat}
                  onCombatRequest={onCombatRequest}
                  onStartCombat={onStartCombat}
                  onEndCombat={onEndCombat}
                  isDM={isDungeonMaster()}
                  pendingRequest={pendingCombatRequest}
                  currentUserName={currentUserName}
                  aiLoading={aiLoading}
                  onAiPrompt={onAiPrompt}
                  aiBattleEngine={aiBattleEngine}
                  onAiBattleEngineChange={onAiBattleEngineChange}
                  onSetupEnvironment={handleSetupEnvironment}
                  tierLimits={tierLimits}
                />
                {/* Token list (sorted by initiative when in combat) */}
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
                />
              </div>
            )}
            {activePanel === "create" && canCreateToken() && (
              <div className="h-full overflow-y-auto">
                <TokenPanel
                  onEditToken={onEditToken}
                  mode="create"
                  mapId={mapId}
                  onTokenDelete={onTokenDelete}
                  onTokenCreate={onTokenCreate}
                  onMapChanged={onMapChanged}
                  onSelectAndCenter={onSelectAndCenter}
                />
              </div>
            )}
            {activePanel === "scenes" && canEditMap() && !isPlayingLocally && onSwitchScene && onCreateScene && onDeleteScene && onRenameScene && onDuplicateScene && (
              <div className="h-full overflow-y-auto">
                <SceneSelector
                  onSwitchScene={onSwitchScene}
                  onCreateScene={onCreateScene}
                  onDeleteScene={onDeleteScene}
                  onRenameScene={onRenameScene}
                  onDuplicateScene={onDuplicateScene}
                  maxScenes={tierLimits?.maxScenesPerMap}
                />
              </div>
            )}
            {activePanel === "editMap" && canEditMap() && (
              <div className="h-full overflow-y-auto">
                <BackgroundPanel mapId={mapId} onBackgroundChange={onBackgroundChange} />
              </div>
            )}
            {activePanel === "players" && mapId && (
              <div className="h-full overflow-y-auto">
                <PresenceList mapId={mapId} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Chat Button - bottom right (hidden when chat is open) */}
      {mapId && onSendChatMessage && !chatOpen && (
        <button
          onClick={toggleChat}
          className="fixed bottom-4 right-4 z-40 w-14 h-14 rounded-full shadow-lg flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white transition-all cursor-pointer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6">
            <path fillRule="evenodd" d="M3.43 2.524A41.29 41.29 0 0110 2c2.236 0 4.43.18 6.57.524 1.437.231 2.43 1.49 2.43 2.902v5.148c0 1.413-.993 2.67-2.43 2.902a41.202 41.202 0 01-5.183.501.78.78 0 00-.528.224l-3.579 3.58A.75.75 0 016 17.25v-3.443a41.033 41.033 0 01-2.57-.33C2.993 13.244 2 11.986 2 10.574V5.426c0-1.413.993-2.67 2.43-2.902z" clipRule="evenodd" />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Chat Overlay - slides up from bottom */}
      {chatOpen && mapId && onSendChatMessage && (
        <div className="fixed inset-x-0 bottom-0 z-30 h-[40vh] bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-2xl rounded-t-2xl flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Chat</span>
            <button
              onClick={toggleChat}
              className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <ChatPanel
              mapId={mapId}
              userId={userId || ""}
              userName={userName || "Anonymous"}
              isDM={isDM}
              onSendMessage={onSendChatMessage}
              onClearChat={onClearChat}
              variant="panel"
              mapOwnerId={mapOwnerId || userId || ""}
              aiLoading={aiLoading}
              onAiPrompt={onAiPrompt}
              aiBattleEngine={aiBattleEngine}
            />
          </div>
        </div>
      )}
    </div>
  );
}
