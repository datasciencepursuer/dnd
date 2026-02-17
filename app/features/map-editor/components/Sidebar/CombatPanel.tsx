import { useState, useEffect, useMemo } from "react";
import { useMapStore, useEditorStore } from "../../store";

interface CombatPanelProps {
  isInCombat: boolean;
  onCombatRequest?: () => void;
  onStartCombat?: () => void;
  onEndCombat?: () => void;
  isDM: boolean;
  pendingRequest?: { requesterId: string; requesterName: string } | null;
  currentUserName?: string | null;
  aiLoading?: boolean;
  onAiPrompt?: (prompt: string, silent?: boolean) => void;
  aiBattleEngine?: boolean;
  onAiBattleEngineChange?: (enabled: boolean) => void;
  // Environment setup
  onSetupEnvironment?: () => void;
}

// Crossed swords icon
function CrossedSwordsIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M6.92 5H5l5.5 5.5.71-.71L6.92 5zm12.08 0h-1.92l-4.29 4.29.71.71L19 5zM12 9.17L5.83 15.34 4.42 13.93 10.59 7.76l.71.71L5.83 13.93l1.41 1.41L12 10.59l4.76 4.75 1.41-1.41L12.71 8.46l.71-.71 5.46 5.46-1.41 1.42L12 9.17zM3 19v2h18v-2H3z"/>
    </svg>
  );
}

function BattlefieldStatus() {
  const wallCount = useMapStore((s) => s.map?.walls?.length ?? 0);
  const areaCount = useMapStore((s) => s.map?.areas?.length ?? 0);
  const hasFeatures = wallCount > 0 || areaCount > 0;

  if (hasFeatures) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1.5 rounded text-xs font-medium bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
          <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
        </svg>
        Battlefield ready ({wallCount} walls, {areaCount} areas)
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 px-2 py-1.5 rounded text-xs font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
        <path fillRule="evenodd" d="M6.701 2.25c.577-1 2.02-1 2.598 0l5.196 9a1.5 1.5 0 0 1-1.299 2.25H2.804a1.5 1.5 0 0 1-1.3-2.25l5.197-9ZM8 4a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-1.5 0v-3A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
      </svg>
      Add walls & terrain for better AI combat
    </div>
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
  aiLoading = false,
  onAiPrompt,
  aiBattleEngine = false,
  onAiBattleEngineChange,
  onSetupEnvironment,
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

  const map = useMapStore((s) => s.map);
  const isTokenOwner = useEditorStore((s) => s.isTokenOwner);
  const combat = map?.combat ?? null;

  const currentTurnTokenName = useMemo(() => {
    if (!combat?.isInCombat || !combat.initiativeOrder) return null;
    return combat.initiativeOrder[combat.currentTurnIndex]?.tokenName ?? null;
  }, [combat]);

  const isMonsterTurn = useMemo(() => {
    if (!aiBattleEngine || !combat?.isInCombat || !combat.initiativeOrder) return false;
    const entry = combat.initiativeOrder[combat.currentTurnIndex];
    return !!entry && entry.layer !== "character";
  }, [aiBattleEngine, combat]);

  const isMyTurn = useMemo(() => {
    if (!aiBattleEngine || !combat?.isInCombat || !combat.initiativeOrder) return false;
    const entry = combat.initiativeOrder[combat.currentTurnIndex];
    if (!entry || entry.layer !== "character") return false;
    const token = map?.tokens.find((t) => t.id === entry.tokenId);
    if (!token) return false;
    return isTokenOwner(token.ownerId);
  }, [aiBattleEngine, combat, map?.tokens, isTokenOwner]);

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 p-3">
      {!isInCombat ? (
        // Not in combat - show Start/Request button
        isDM ? (
          <div className="space-y-1.5">
            {onAiBattleEngineChange && (
              <label
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-xs font-medium cursor-pointer select-none transition-colors ${
                  aiBattleEngine
                    ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                }`}
                title="AI Battle Engine: auto-run AI each turn"
              >
                <input
                  type="checkbox"
                  checked={aiBattleEngine}
                  onChange={(e) => onAiBattleEngineChange(e.target.checked)}
                  className="sr-only"
                />
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M13 7H7v6h6V7z" />
                  <path fillRule="evenodd" d="M7 2a1 1 0 012 0v1h2V2a1 1 0 112 0v1h2a2 2 0 012 2v2h1a1 1 0 110 2h-1v2h1a1 1 0 110 2h-1v2a2 2 0 01-2 2h-2v1a1 1 0 11-2 0v-1H9v1a1 1 0 11-2 0v-1H5a2 2 0 01-2-2v-2H2a1 1 0 110-2h1V9H2a1 1 0 010-2h1V5a2 2 0 012-2h2V2zM5 5h10v10H5V5z" clipRule="evenodd" />
                </svg>
                AI Battle Engine
              </label>
            )}
            {aiBattleEngine && (
              <>
                <BattlefieldStatus />
                {onSetupEnvironment && (
                  <button
                    onClick={onSetupEnvironment}
                    className="w-full px-3 py-1.5 rounded text-xs font-medium cursor-pointer transition-colors bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800/40"
                  >
                    Set Up Environment
                  </button>
                )}
              </>
            )}
            <button
              onClick={onStartCombat}
              className="w-full px-4 py-2 rounded font-medium cursor-pointer transition-all bg-red-600 hover:bg-red-700 active:scale-95 text-white flex items-center justify-center gap-2"
            >
              <CrossedSwordsIcon className="h-5 w-5" />
              Start Combat
            </button>
          </div>
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
        // In combat
        <div className="space-y-1.5">
          {/* Monster turn — Continue button */}
          {isMonsterTurn && currentTurnTokenName && (
            <div className="border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 rounded px-2 py-2">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200">
                  ENEMY TURN
                </span>
                <span className="text-xs text-red-700 dark:text-red-300 truncate">
                  {currentTurnTokenName}
                </span>
              </div>
              <button
                onClick={() => onAiPrompt?.(`Continue ${currentTurnTokenName}'s turn. Resolve any pending actions or saving throw results.`)}
                disabled={aiLoading}
                className="w-full px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500 hover:bg-red-600 text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors flex items-center justify-center gap-1.5"
              >
                {aiLoading ? (
                  <>
                    <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    AI Resolving...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                      <path d="M3 3.732a1.5 1.5 0 012.305-1.265l6.706 4.267a1.5 1.5 0 010 2.531l-6.706 4.268A1.5 1.5 0 013 12.267V3.732z" />
                    </svg>
                    Continue
                  </>
                )}
              </button>
            </div>
          )}

          {/* End Combat - DM only */}
          {isDM ? (
            <button
              onClick={onEndCombat}
              className="w-full px-4 py-2 rounded font-medium cursor-pointer transition-all bg-gray-600 hover:bg-gray-700 active:scale-95 text-white flex items-center justify-center gap-2"
            >
              <CrossedSwordsIcon className="h-5 w-5" />
              End Combat
            </button>
          ) : !isMyTurn && !isMonsterTurn ? (
            <div className="w-full px-4 py-2 rounded font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 flex items-center justify-center gap-2">
              <CrossedSwordsIcon className="h-5 w-5" />
              <span className="text-sm">Combat Active</span>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
