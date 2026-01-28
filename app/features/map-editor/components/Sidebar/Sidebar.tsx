import { useState } from "react";
import { BackgroundPanel } from "./BackgroundPanel";
import { TokenPanel } from "./TokenPanel";
import { PresenceList } from "./PresenceList";
import type { Token } from "../../types";

type ActivePanel = "none" | "editMap" | "createUnit";

interface SidebarProps {
  mapId?: string;
  onEditToken?: (token: Token) => void;
  readOnly?: boolean;
  onTokenDelete?: (tokenId: string) => void;
}

export function Sidebar({ mapId, onEditToken, readOnly = false, onTokenDelete }: SidebarProps) {
  const [activePanel, setActivePanel] = useState<ActivePanel>("none");

  const togglePanel = (panel: ActivePanel) => {
    setActivePanel(activePanel === panel ? "none" : panel);
  };

  return (
    <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full">
      {/* Action Buttons - hidden for read-only users */}
      {!readOnly && (
        <div className="p-3 space-y-2 border-b border-gray-200 dark:border-gray-700">
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
        </div>
      )}

      {/* Collapsible Panels / Units List */}
      <div className="flex-1 overflow-y-auto">
        {!readOnly && activePanel === "editMap" && <BackgroundPanel />}
        {!readOnly && activePanel === "createUnit" && <TokenPanel onEditToken={onEditToken} mode="create" mapId={mapId} onTokenDelete={onTokenDelete} />}

        {/* Token List - Always visible when no panel is open or in readOnly mode */}
        {(activePanel === "none" || readOnly) && (
          <TokenPanel onEditToken={onEditToken} mode="list" readOnly={readOnly} mapId={mapId} onTokenDelete={onTokenDelete} />
        )}
      </div>

      {/* Players Online */}
      <PresenceList mapId={mapId} />
    </div>
  );
}
