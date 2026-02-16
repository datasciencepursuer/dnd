import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useMapStore, useEditorStore } from "../../store";
import type { ChatMessageData } from "../../store/chat-store";
import { TurnPromptBuilder } from "../TurnPromptBuilder";

interface CombatPanelProps {
  isInCombat: boolean;
  onCombatRequest?: () => void;
  onStartCombat?: () => void;
  onEndCombat?: () => void;
  isDM: boolean;
  pendingRequest?: { requesterId: string; requesterName: string } | null;
  currentUserName?: string | null;
  aiLoading?: boolean;
  onAiPrompt?: (prompt: string) => void;
  aiBattleEngine?: boolean;
  onAiBattleEngineChange?: (enabled: boolean) => void;
  // Props needed for TurnPromptBuilder
  mapId?: string;
  userId?: string;
  onSendMessage?: (chatMessage: ChatMessageData) => void;
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
  aiLoading = false,
  onAiPrompt,
  aiBattleEngine = false,
  onAiBattleEngineChange,
  mapId,
  userId,
  onSendMessage,
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

  // --- Turn prompt logic (moved from ChatPanel) ---
  const map = useMapStore((s) => s.map);
  const isTokenOwner = useEditorStore((s) => s.isTokenOwner);
  const combat = map?.combat ?? null;

  const isMyTurn = useMemo(() => {
    if (!aiBattleEngine || !combat?.isInCombat || !combat.initiativeOrder) return false;
    const entry = combat.initiativeOrder[combat.currentTurnIndex];
    if (!entry || entry.layer !== "character") return false;
    const token = map?.tokens.find((t) => t.id === entry.tokenId);
    if (!token) return false;
    return isTokenOwner(token.ownerId);
  }, [aiBattleEngine, combat, map?.tokens, isTokenOwner]);

  const currentTurnTokenName = useMemo(() => {
    if (!combat?.isInCombat || !combat.initiativeOrder) return null;
    return combat.initiativeOrder[combat.currentTurnIndex]?.tokenName ?? null;
  }, [combat]);

  const currentTurnToken = useMemo(() => {
    if (!combat?.isInCombat || !combat.initiativeOrder) return null;
    const entry = combat.initiativeOrder[combat.currentTurnIndex];
    if (!entry) return null;
    return map?.tokens.find((t) => t.id === entry.tokenId) ?? null;
  }, [combat, map?.tokens]);

  const isMonsterTurn = useMemo(() => {
    if (!aiBattleEngine || !combat?.isInCombat || !combat.initiativeOrder) return false;
    const entry = combat.initiativeOrder[combat.currentTurnIndex];
    return !!entry && entry.layer !== "character";
  }, [aiBattleEngine, combat]);

  const [intentInput, setIntentInput] = useState("");
  const intentInputRef = useRef<HTMLInputElement>(null);

  const handleSendIntent = useCallback(() => {
    const trimmed = intentInput.trim();
    if (!trimmed || !currentTurnTokenName || !mapId || !userId || !onSendMessage) return;

    const chatMessage: ChatMessageData = {
      id: crypto.randomUUID(),
      mapId,
      userId,
      userName: currentUserName || "Anonymous",
      message: trimmed,
      role: isDM ? "dm" : "player",
      createdAt: new Date().toISOString(),
      metadata: { playerIntent: true },
      recipientId: null,
      recipientName: null,
    };

    onSendMessage(chatMessage);
    setIntentInput("");

    // Declare = fresh start. AI will check PENDING DICE ROLLS for any new rolls.
    onAiPrompt?.(`${currentTurnTokenName} declares: ${trimmed}. Tell them what to roll.`);
  }, [intentInput, currentTurnTokenName, mapId, userId, currentUserName, isDM, onSendMessage, onAiPrompt]);

  const handleContinueTurn = useCallback(() => {
    if (!currentTurnTokenName) return;
    // Continue uses whatever new rolls are in PENDING DICE ROLLS (filtered by serializer)
    onAiPrompt?.(`Continue ${currentTurnTokenName}'s turn. Check PENDING DICE ROLLS for new rolls and resolve.`);
  }, [currentTurnTokenName, onAiPrompt]);

  const handleStructuredSubmit = useCallback((prompt: string) => {
    if (!currentTurnTokenName || !mapId || !userId || !onSendMessage) return;

    const chatMessage: ChatMessageData = {
      id: crypto.randomUUID(),
      mapId,
      userId,
      userName: currentUserName || "Anonymous",
      message: prompt,
      role: isDM ? "dm" : "player",
      createdAt: new Date().toISOString(),
      metadata: { playerIntent: true },
      recipientId: null,
      recipientName: null,
    };

    onSendMessage(chatMessage);

    // Declare = fresh start. AI will check PENDING DICE ROLLS for any new rolls.
    onAiPrompt?.(`${prompt} Tell them what to roll.`);
  }, [currentTurnTokenName, mapId, userId, currentUserName, isDM, onSendMessage, onAiPrompt]);

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
          {/* Player Turn Prompt */}
          {isMyTurn && currentTurnToken && combat && map && (
            currentTurnToken.characterSheet ? (
              <TurnPromptBuilder
                tokenName={currentTurnTokenName!}
                token={currentTurnToken}
                combat={combat}
                allTokens={map.tokens}
                onSubmit={handleStructuredSubmit}
                onContinueTurn={handleContinueTurn}
                aiLoading={aiLoading}
              />
            ) : (
              <div className="border border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20 rounded px-2 py-2">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200">
                    YOUR TURN
                  </span>
                  <span className="text-xs text-yellow-700 dark:text-yellow-300 truncate">
                    {currentTurnTokenName}
                  </span>
                </div>
                <div className="flex gap-1.5">
                  <input
                    ref={intentInputRef}
                    type="text"
                    value={intentInput}
                    onChange={(e) => setIntentInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendIntent(); } }}
                    placeholder="Declare your action..."
                    maxLength={500}
                    className="flex-1 min-w-0 px-3 py-1.5 text-sm rounded-lg border border-yellow-300 dark:border-yellow-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-yellow-400 dark:placeholder-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  />
                  <button
                    onClick={handleSendIntent}
                    disabled={!intentInput.trim()}
                    className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-yellow-500 hover:bg-yellow-600 text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    Declare
                  </button>
                  <button
                    onClick={handleContinueTurn}
                    disabled={aiLoading}
                    className="flex-shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors flex items-center gap-1"
                    title="Continue turn — send your rolls to AI"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                      <path d="M3 3.732a1.5 1.5 0 012.305-1.265l6.706 4.267a1.5 1.5 0 010 2.531l-6.706 4.268A1.5 1.5 0 013 12.267V3.732z" />
                    </svg>
                  </button>
                </div>
              </div>
            )
          )}

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
