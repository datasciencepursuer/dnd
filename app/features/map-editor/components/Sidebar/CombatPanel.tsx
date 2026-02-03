import { useState, useEffect } from "react";

interface CombatPanelProps {
  isInCombat: boolean;
  onCombatRequest?: () => void;
  onStartCombat?: () => void;
  onEndCombat?: () => void;
  isDM: boolean;
  pendingRequest?: { requesterId: string; requesterName: string } | null;
  currentUserName?: string | null;
}

// Crossed swords icon
function CrossedSwordsIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M6.92 5H5l5.5 5.5.71-.71L6.92 5zm12.08 0h-1.92l-4.29 4.29.71.71L19 5zM12 9.17L5.83 15.34 4.42 13.93 10.59 7.76l.71.71L5.83 13.93l1.41 1.41L12 10.59l4.76 4.75 1.41-1.41L12.71 8.46l.71-.71 5.46 5.46-1.41 1.42L12 9.17zM3 19v2h18v-2H3z"/>
    </svg>
  );
}

export function CombatPanel({
  isInCombat,
  onCombatRequest,
  onStartCombat,
  onEndCombat,
  isDM,
  pendingRequest,
  currentUserName,
}: CombatPanelProps) {
  const [hasRequested, setHasRequested] = useState(false);

  // Reset hasRequested when combat starts or ends
  useEffect(() => {
    if (isInCombat || !pendingRequest) {
      setHasRequested(false);
    }
  }, [isInCombat, pendingRequest]);

  const handleRequestCombat = () => {
    setHasRequested(true);
    onCombatRequest?.();
  };

  // Show pending state if this player requested
  const isRequestPending = hasRequested;

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 p-3">
      {!isInCombat ? (
        // Not in combat - show Start/Request button
        isDM ? (
          <button
            onClick={onStartCombat}
            className="w-full px-4 py-2 rounded font-medium cursor-pointer transition-all bg-red-600 hover:bg-red-700 active:scale-95 text-white flex items-center justify-center gap-2"
          >
            <CrossedSwordsIcon className="h-5 w-5" />
            Start Combat
          </button>
        ) : isRequestPending ? (
          <div className="w-full px-4 py-2 rounded font-medium bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300 flex items-center justify-center gap-2">
            <CrossedSwordsIcon className="h-5 w-5 opacity-50" />
            <span className="text-sm">{currentUserName || "You"} requested combat</span>
          </div>
        ) : (
          <button
            onClick={handleRequestCombat}
            className="w-full px-4 py-2 rounded font-medium cursor-pointer transition-all bg-red-600 hover:bg-red-700 active:scale-95 text-white flex items-center justify-center gap-2"
          >
            <CrossedSwordsIcon className="h-5 w-5" />
            Request Combat
          </button>
        )
      ) : (
        // In combat - show End button (DM only) or status
        isDM ? (
          <button
            onClick={onEndCombat}
            className="w-full px-4 py-2 rounded font-medium cursor-pointer transition-all bg-gray-600 hover:bg-gray-700 active:scale-95 text-white flex items-center justify-center gap-2"
          >
            <CrossedSwordsIcon className="h-5 w-5" />
            End Combat
          </button>
        ) : (
          <div className="w-full px-4 py-2 rounded font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 flex items-center justify-center gap-2">
            <CrossedSwordsIcon className="h-5 w-5" />
            <span className="text-sm">Combat Active</span>
          </div>
        )
      )}
    </div>
  );
}
