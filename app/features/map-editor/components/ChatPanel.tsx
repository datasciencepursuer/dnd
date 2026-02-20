import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useFetcher } from "react-router";
import { useChatStore } from "../store/chat-store";
import { parseDiceNotation, rollDice } from "../store/chat-store";
import { useMapStore, useEditorStore } from "../store";
import { usePresenceStore } from "../store/presence-store";
import type { ChatMessageData, DiceRollData } from "../store/chat-store";
import type { TierLimits } from "~/lib/tier-limits";


const DICE_BUTTONS = [
  { name: "d4", sides: 4, color: "bg-red-600 hover:bg-red-700" },
  { name: "d6", sides: 6, color: "bg-orange-600 hover:bg-orange-700" },
  { name: "d8", sides: 8, color: "bg-yellow-600 hover:bg-yellow-700" },
  { name: "d10", sides: 10, color: "bg-green-600 hover:bg-green-700" },
  { name: "d12", sides: 12, color: "bg-blue-600 hover:bg-blue-700" },
  { name: "d20", sides: 20, color: "bg-purple-600 hover:bg-purple-700" },
  { name: "d100", sides: 100, color: "bg-pink-600 hover:bg-pink-700" },
];

interface ChatPanelProps {
  mapId: string;
  userId: string;
  userName: string;
  isDM: boolean;
  onSendMessage: (chatMessage: ChatMessageData) => void;
  onClearChat?: () => void;
  variant?: "sidebar" | "panel";
  mapOwnerId?: string;
  aiLoading?: boolean;
  onAiPrompt?: (prompt: string, silent?: boolean) => void;
  aiBattleEngine?: boolean;
  tierLimits?: TierLimits;
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);

  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function formatNotation(dr: DiceRollData): string {
  const keepStr = dr.keep ?? "";
  const mod = dr.modifier > 0 ? `+${dr.modifier}` : dr.modifier < 0 ? `${dr.modifier}` : "";
  return `${dr.count}${dr.dice}${keepStr}${mod}`;
}

function DiceRollMessage({ diceRoll, messageText }: { diceRoll: DiceRollData; messageText: string }) {
  const { rolls, modifier, total, keep } = diceRoll;
  const hasMultiple = rolls.length > 1;
  const hasMod = modifier !== 0;
  const modStr = modifier > 0 ? `+${modifier}` : `${modifier}`;

  // Determine which die was kept for advantage/disadvantage display
  const keptValue = keep === "h" ? Math.max(...rolls) : keep === "l" ? Math.min(...rolls) : null;

  let breakdownNode: React.ReactNode = null;
  if (keep && hasMultiple) {
    // Advantage/disadvantage: show each die, strikethrough dropped, bold kept
    const parts = rolls.map((r, i) => {
      const isKept = r === keptValue;
      // If multiple dice share the kept value, only mark the first one
      const firstKeptIdx = rolls.indexOf(keptValue!);
      const shouldHighlight = isKept && i === firstKeptIdx;
      const shouldStrike = !shouldHighlight;
      return (
        <span key={i}>
          {i > 0 && <span className="text-gray-300 dark:text-gray-600">{" · "}</span>}
          <span className={shouldStrike ? "line-through opacity-50" : "font-semibold"}>
            {r}{hasMod && <>{modStr}={r + modifier}</>}
          </span>
        </span>
      );
    });
    breakdownNode = <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">{parts}</span>;
  } else if (hasMultiple && hasMod) {
    const parts = rolls.map((r, i) => {
      const sub = r + modifier;
      return <span key={i}>{i > 0 && <span className="text-gray-300 dark:text-gray-600">{" · "}</span>}{r}{modStr}={sub}</span>;
    });
    breakdownNode = <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">{parts}</span>;
  } else if (hasMultiple) {
    breakdownNode = <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">[{rolls.join(", ")}]</span>;
  } else if (hasMod) {
    breakdownNode = <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">{rolls[0]}{modStr}</span>;
  }

  return (
    <div className="flex items-baseline gap-1.5 flex-wrap">
      <span className="text-base text-gray-600 dark:text-gray-300">{messageText}</span>
      <span className="text-gray-400 dark:text-gray-500">&rarr;</span>
      <span className="text-base font-bold text-gray-900 dark:text-white">{total}</span>
      {breakdownNode}
      {diceRoll.tokenName && (
        <>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          {diceRoll.tokenColor && (
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 self-center" style={{ backgroundColor: diceRoll.tokenColor }} />
          )}
          <span className="text-xs text-gray-400 dark:text-gray-500">{diceRoll.tokenName}</span>
        </>
      )}
    </div>
  );
}

export function ChatPanel({ mapId, userId, userName, isDM, onSendMessage, onClearChat, variant = "sidebar", mapOwnerId, aiLoading = false, onAiPrompt, aiBattleEngine = false, tierLimits }: ChatPanelProps) {
  const messages = useChatStore((s) => s.messages);
  const isLoaded = useChatStore((s) => s.isLoaded);
  const setMessages = useChatStore((s) => s.setMessages);
  const [input, setInput] = useState("");
  const [clearing, setClearing] = useState(false);
  const [showDice, setShowDice] = useState(false);
  const [diceCount, setDiceCount] = useState(1);
  const [diceModifier, setDiceModifier] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const inputRef = useRef<HTMLInputElement>(null);

  // Input history (last 3 sent messages)
  const inputHistoryRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const savedInputRef = useRef("");

  // Whisper state
  const whispersEnabled = !tierLimits || tierLimits.chatWhispers;
  const [whisperTarget, setWhisperTarget] = useState<{ id: string; name: string } | null>(null);
  const [showWhisperList, setShowWhisperList] = useState(false);
  const [whisperFilterIndex, setWhisperFilterIndex] = useState(0);

  // Online users from presence store (for whisper autocomplete)
  const presenceUsers = usePresenceStore((s) => s.users);
  const otherUsers = useMemo(
    () => presenceUsers.filter((u) => u.id !== userId),
    [presenceUsers, userId]
  );

  // Filtered whisper targets based on input after "/w "
  const whisperSearchText = showWhisperList && input.startsWith("/w ")
    ? input.slice(3).toLowerCase()
    : "";
  const filteredWhisperUsers = useMemo(
    () => whisperSearchText
      ? otherUsers.filter((u) => u.name.toLowerCase().includes(whisperSearchText))
      : otherUsers,
    [otherUsers, whisperSearchText]
  );

  // Resolve DM user for /dmroll command
  const dmUser = useMemo(() => {
    if (!mapOwnerId || mapOwnerId === userId) return null;
    const found = presenceUsers.find((u) => u.id === mapOwnerId);
    return found ? { id: found.id, name: found.name } : null;
  }, [mapOwnerId, userId, presenceUsers]);

  // Token selection for dice rolls via buttons
  const map = useMapStore((s) => s.map);
  const selectedIds = useEditorStore((s) => s.selectedElementIds);
  const canMoveToken = useEditorStore((s) => s.canMoveToken);
  const selectedToken = selectedIds.length === 1
    ? map?.tokens.find((t) => t.id === selectedIds[0])
    : null;
  const canRollToken = !!selectedToken && canMoveToken(selectedToken.ownerId);

  // AI Battle Engine: combat turn state
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
    if (!aiBattleEngine || !combat?.isInCombat || !combat.initiativeOrder) return null;
    return combat.initiativeOrder[combat.currentTurnIndex]?.tokenName ?? null;
  }, [aiBattleEngine, combat]);

  const isMonsterTurn = useMemo(() => {
    if (!aiBattleEngine || !combat?.isInCombat || !combat.initiativeOrder) return false;
    const entry = combat.initiativeOrder[combat.currentTurnIndex];
    return !!entry && entry.layer !== "character";
  }, [aiBattleEngine, combat]);

  // Reset chat store when switching maps
  useEffect(() => {
    useChatStore.getState().reset();
  }, [mapId]);

  // Load messages from API on mount
  const chatFetcher = useFetcher<{ messages: ChatMessageData[] }>();
  useEffect(() => {
    if (isLoaded) return;
    chatFetcher.load(`/api/maps/${mapId}/chat`);
  }, [mapId, isLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync fetcher data into chat store
  useEffect(() => {
    if (chatFetcher.data?.messages && !isLoaded) {
      setMessages(chatFetcher.data.messages);
    }
  }, [chatFetcher.data, isLoaded, setMessages]);

  // Track if user is at bottom for auto-scroll
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  }, []);

  // Auto-scroll when new messages arrive (if at bottom)
  useEffect(() => {
    if (isAtBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length]);

  // Reset whisper filter index when list changes
  useEffect(() => {
    setWhisperFilterIndex(0);
  }, [filteredWhisperUsers.length]);

  const selectWhisperTarget = useCallback((target: { id: string; name: string }) => {
    setWhisperTarget(target);
    setShowWhisperList(false);
    setInput("");
    setWhisperFilterIndex(0);
    inputRef.current?.focus();
  }, []);

  const clearWhisperTarget = useCallback(() => {
    setWhisperTarget(null);
    setShowWhisperList(false);
    setInput("");
    inputRef.current?.focus();
  }, []);

  const createAndSendMessage = useCallback((
    text: string,
    diceRoll?: DiceRollData,
    overrideRecipient?: { id: string; name: string } | null,
  ) => {
    const recipient = overrideRecipient !== undefined ? overrideRecipient : whisperTarget;
    const chatMessage: ChatMessageData = {
      id: crypto.randomUUID(),
      mapId,
      userId,
      userName,
      message: text,
      role: isDM ? "dm" : "player",
      createdAt: new Date().toISOString(),
      metadata: diceRoll ? { diceRoll } : null,
      recipientId: recipient?.id ?? null,
      recipientName: recipient?.name ?? null,
    };

    onSendMessage(chatMessage);
    // DB persistence handled by PartyKit server batch flush
  }, [mapId, userId, userName, isDM, onSendMessage, whisperTarget]);

  const handleDiceButtonRoll = useCallback((sides: number, name: string) => {
    const { rolls, total } = rollDice(diceCount, sides, diceModifier);
    const mod = diceModifier > 0 ? `+${diceModifier}` : diceModifier < 0 ? `${diceModifier}` : "";
    const diceRoll: DiceRollData = {
      dice: name,
      count: diceCount,
      modifier: diceModifier,
      rolls,
      total,
      tokenName: selectedToken?.name,
      tokenColor: selectedToken?.color,
    };
    createAndSendMessage(`Rolling ${diceCount}${name}${mod}`, diceRoll);
  }, [createAndSendMessage, selectedToken, diceCount, diceModifier]);

  const handleInputChange = useCallback((value: string) => {
    setInput(value);
    if (whispersEnabled && value.startsWith("/w ") && !whisperTarget) {
      setShowWhisperList(true);
    } else if (!value.startsWith("/w ")) {
      setShowWhisperList(false);
    }
  }, [whisperTarget, whispersEnabled]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || trimmed.length > 500) return;

    // If whisper list is showing and user presses send, select first filtered user
    if (showWhisperList && filteredWhisperUsers.length > 0) {
      selectWhisperTarget(filteredWhisperUsers[whisperFilterIndex]);
      return;
    }

    // Push to input history (keep last 3, no consecutive duplicates)
    const history = inputHistoryRef.current;
    if (history[0] !== trimmed) {
      inputHistoryRef.current = [trimmed, ...history].slice(0, 3);
    }
    historyIndexRef.current = -1;
    savedInputRef.current = "";

    // Check for /ai command (AI DM combat assistant)
    const aiMatch = trimmed.match(/^\/ai\s+(.+)$/i);
    if (aiMatch) {
      setInput("");
      onAiPrompt?.(aiMatch[1].trim());
      return;
    }

    // Check for /dmw command (whisper message to DM)
    const dmWhisperMatch = trimmed.match(/^\/dmw\s+(.+)$/i);
    if (dmWhisperMatch) {
      if (!whispersEnabled) {
        setInput("");
        return;
      }
      const dmTarget = isDM ? { id: userId, name: userName } : dmUser;
      if (dmTarget) {
        createAndSendMessage(dmWhisperMatch[1].trim(), undefined, dmTarget);
      }
      setInput("");
      return;
    }

    // Check for /dmroll or /dr command (secret roll to DM)
    const dmRollMatch = trimmed.match(/^\/(?:dmroll|dr)\s+(.+)$/i);
    if (dmRollMatch && !whispersEnabled) {
      // Fall through to regular roll handling if whispers disabled
    } else if (dmRollMatch) {
      const notation = dmRollMatch[1].trim();
      const parsed = parseDiceNotation(notation);
      if (parsed) {
        const { rolls, total } = rollDice(parsed.count, parsed.sides, parsed.modifier, parsed.keep);
        const diceName = `d${parsed.sides}`;
        const keepStr = parsed.keep ?? "";
        const mod = parsed.modifier > 0 ? `+${parsed.modifier}` : parsed.modifier < 0 ? `${parsed.modifier}` : "";
        const diceRoll: DiceRollData = {
          dice: diceName,
          count: parsed.count,
          modifier: parsed.modifier,
          rolls,
          total,
          keep: parsed.keep,
          tokenName: selectedToken?.name,
          tokenColor: selectedToken?.color,
        };
        // If current user IS the DM, send as a self-only whisper (recipientId = self)
        const dmTarget = isDM
          ? { id: userId, name: userName }
          : dmUser;
        if (dmTarget) {
          createAndSendMessage(`Secret roll ${parsed.count}${diceName}${keepStr}${mod}`, diceRoll, dmTarget);
        } else {
          // DM not online - fall back to regular roll
          createAndSendMessage(`Rolling ${parsed.count}${diceName}${keepStr}${mod}`, diceRoll);
        }
        setInput("");
        return;
      }
    }

    // Check for /r or /roll command
    const rollMatch = trimmed.match(/^\/r(?:oll)?\s+(.+)$/i);
    if (rollMatch) {
      const notation = rollMatch[1].trim();
      const parsed = parseDiceNotation(notation);
      if (parsed) {
        const { rolls, total } = rollDice(parsed.count, parsed.sides, parsed.modifier, parsed.keep);
        const diceName = `d${parsed.sides}`;
        const keepStr = parsed.keep ?? "";
        const mod = parsed.modifier > 0 ? `+${parsed.modifier}` : parsed.modifier < 0 ? `${parsed.modifier}` : "";
        const diceRoll: DiceRollData = {
          dice: diceName,
          count: parsed.count,
          modifier: parsed.modifier,
          rolls,
          total,
          keep: parsed.keep,
          tokenName: selectedToken?.name,
          tokenColor: selectedToken?.color,
        };
        createAndSendMessage(`Rolling ${parsed.count}${diceName}${keepStr}${mod}`, diceRoll);
        setInput("");
        return;
      }
      // Invalid notation - send as regular message with hint
    }

    createAndSendMessage(trimmed);
    setInput("");
  };

  const handleSendToAi = () => {
    const trimmed = input.trim();
    if (!trimmed || !currentTurnTokenName || !onAiPrompt) return;

    // Send as player intent chat message
    const chatMessage: ChatMessageData = {
      id: crypto.randomUUID(),
      mapId,
      userId,
      userName,
      message: trimmed,
      role: isDM ? "dm" : "player",
      createdAt: new Date().toISOString(),
      metadata: { playerIntent: true },
      recipientId: null,
      recipientName: null,
    };
    onSendMessage(chatMessage);
    setInput("");

    onAiPrompt(`${currentTurnTokenName} declares: ${trimmed}. Tell them what to roll.`);
  };

  const handleContinueTurn = () => {
    if (!currentTurnTokenName || !onAiPrompt) return;
    onAiPrompt(`Continue ${currentTurnTokenName}'s turn. Check PENDING DICE ROLLS for new rolls and resolve.`, true);
  };

  const handleChipClick = useCallback((text: string) => {
    setInput((prev) => {
      const trimmed = prev.trimEnd();
      return trimmed ? `${trimmed} ${text}` : text;
    });
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Whisper autocomplete navigation
    if (showWhisperList && filteredWhisperUsers.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setWhisperFilterIndex((i) => Math.min(i + 1, filteredWhisperUsers.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setWhisperFilterIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        selectWhisperTarget(filteredWhisperUsers[whisperFilterIndex]);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        selectWhisperTarget(filteredWhisperUsers[whisperFilterIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowWhisperList(false);
        setInput("");
        return;
      }
    }

    // Input history navigation (ArrowUp/ArrowDown)
    if (e.key === "ArrowUp" && !showWhisperList) {
      const history = inputHistoryRef.current;
      if (history.length === 0) return;
      e.preventDefault();
      if (historyIndexRef.current === -1) {
        savedInputRef.current = input;
      }
      const nextIdx = Math.min(historyIndexRef.current + 1, history.length - 1);
      historyIndexRef.current = nextIdx;
      setInput(history[nextIdx]);
      return;
    }
    if (e.key === "ArrowDown" && !showWhisperList && historyIndexRef.current >= 0) {
      e.preventDefault();
      const nextIdx = historyIndexRef.current - 1;
      historyIndexRef.current = nextIdx;
      setInput(nextIdx < 0 ? savedInputRef.current : inputHistoryRef.current[nextIdx]);
      return;
    }

    // Clear whisper target with Escape
    if (e.key === "Escape" && whisperTarget) {
      e.preventDefault();
      clearWhisperTarget();
      return;
    }

    // Clear whisper target with Backspace on empty input
    if (e.key === "Backspace" && whisperTarget && input === "") {
      e.preventDefault();
      clearWhisperTarget();
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const [isCollapsed, setIsCollapsed] = useState(false);

  if (variant === "sidebar" && isCollapsed) {
    const unread = useChatStore.getState().unreadCount;
    return (
      <div className="relative w-0">
        <button
          onClick={() => setIsCollapsed(false)}
          className="absolute top-3 right-0 z-10 flex items-center justify-center w-6 h-12 bg-white dark:bg-gray-800 border border-r-0 border-gray-300 dark:border-gray-600 rounded-l-lg shadow-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer"
          title="Expand chat"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
          </svg>
          {unread > 0 && (
            <span className="absolute -top-1 -left-1 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className={variant === "panel" ? "flex flex-col h-full" : "relative w-56 lg:w-64 xl:w-72 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col h-full"}>
      {/* Collapse tab - sidebar only */}
      {variant === "sidebar" && (
        <button
          onClick={() => setIsCollapsed(true)}
          className="absolute top-3 -left-6 z-10 flex items-center justify-center w-6 h-12 bg-white dark:bg-gray-800 border border-r-0 border-gray-300 dark:border-gray-600 rounded-l-lg shadow-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer"
          title="Collapse chat"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
          </svg>
        </button>
      )}

      {/* Chat header with clear button - DM only */}
      {isDM && (
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-200 dark:border-gray-700">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Chat</span>
          {messages.length > 0 && (
            <button
              onClick={() => {
                if (clearing) return;
                setClearing(true);
                fetch(`/api/maps/${mapId}/chat`, { method: "DELETE" })
                  .then((res) => {
                    if (res.ok) {
                      setMessages([]);
                      onClearChat?.();
                    }
                  })
                  .finally(() => setClearing(false));
              }}
              disabled={clearing}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors rounded"
              title="Clear all chat history for this map"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {clearing ? "Clearing..." : "Clear Chat"}
            </button>
          )}
        </div>
      )}

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-2 py-2 space-y-1"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-8 h-8 text-gray-300 dark:text-gray-600">
              <path fillRule="evenodd" d="M3.43 2.524A41.29 41.29 0 0110 2c2.236 0 4.43.18 6.57.524 1.437.231 2.43 1.49 2.43 2.902v5.148c0 1.413-.993 2.67-2.43 2.902a41.202 41.202 0 01-5.183.501.78.78 0 00-.528.224l-3.579 3.58A.75.75 0 016 17.25v-3.443a41.033 41.033 0 01-2.57-.33C2.993 13.244 2 11.986 2 10.574V5.426c0-1.413.993-2.67 2.43-2.902z" clipRule="evenodd" />
            </svg>
            <span className="text-sm text-gray-400 dark:text-gray-500">
              No messages yet
            </span>
            <span className="text-xs text-gray-300 dark:text-gray-600">
              {whispersEnabled ? "/r roll | /dr /dmw secret | /ai combat" : "/r roll | /ai combat"}
            </span>
          </div>
        )}
        {messages.map((msg) => {
          const isSelf = msg.userId === userId;
          const isMsgDM = msg.role === "dm";
          const diceRoll = msg.metadata?.diceRoll;
          const isWhisper = !!msg.recipientId;
          const isAI = !!msg.metadata?.aiResponse;
          const isIntent = !!msg.metadata?.playerIntent;

          return (
            <div
              key={msg.id}
              className={`flex ${isSelf && !isAI && !isIntent ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[92%] rounded-md px-2.5 py-1 ${
                  isIntent
                    ? "bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300/60 dark:border-yellow-700/40"
                    : isAI
                      ? "bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-200/60 dark:border-emerald-800/30"
                      : isWhisper
                        ? isSelf
                          ? "bg-purple-100 dark:bg-purple-900/30 border border-purple-200/60 dark:border-purple-800/30"
                          : "bg-purple-50 dark:bg-purple-900/20 border border-purple-200/40 dark:border-purple-800/20"
                        : diceRoll
                          ? "bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200/60 dark:border-indigo-800/30"
                          : isMsgDM
                            ? isSelf
                              ? "bg-amber-100 dark:bg-amber-900/30"
                              : "bg-amber-50 dark:bg-amber-900/20"
                            : isSelf
                              ? "bg-blue-100 dark:bg-blue-900/30"
                              : "bg-blue-50 dark:bg-blue-900/20"
                }`}
              >
                {/* Inline header: name, badge, whisper label, time */}
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-xs font-semibold ${
                      isIntent
                        ? "text-yellow-700 dark:text-yellow-400"
                        : isAI
                          ? "text-emerald-700 dark:text-emerald-400"
                          : isWhisper
                            ? "text-purple-700 dark:text-purple-400"
                            : isMsgDM
                              ? "text-amber-700 dark:text-amber-400"
                              : "text-blue-700 dark:text-blue-400"
                    }`}
                  >
                    {isSelf ? "You" : msg.userName}
                  </span>
                  {isIntent && (
                    <span className="text-[10px] font-bold px-1 rounded bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 leading-tight">
                      ACTION
                    </span>
                  )}
                  {isAI && (
                    <span className="text-[10px] font-bold px-1 rounded bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200 leading-tight">
                      AI DM
                    </span>
                  )}
                  {isMsgDM && !isAI && !isIntent && (
                    <span className="text-[10px] font-bold px-1 rounded bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 leading-tight">
                      DM
                    </span>
                  )}
                  {isWhisper && (
                    <>
                      <span className="text-[10px] font-bold px-1 rounded bg-purple-200 dark:bg-purple-800 text-purple-800 dark:text-purple-200 leading-tight">
                        whisper
                      </span>
                      <span className="text-[11px] text-purple-500 dark:text-purple-400 italic">
                        {isSelf ? `to ${msg.recipientName}` : `from ${msg.userName}`}
                      </span>
                    </>
                  )}
                  <span className="text-[11px] text-gray-400 dark:text-gray-500 ml-auto flex-shrink-0">
                    {formatRelativeTime(msg.createdAt)}
                  </span>
                </div>
                {/* Content: dice roll inline, or text message */}
                {diceRoll ? (
                  <DiceRollMessage diceRoll={diceRoll} messageText={msg.message} />
                ) : (
                  <p className={`text-base whitespace-pre-wrap break-words ${
                    isAI
                      ? "text-emerald-900 dark:text-emerald-100"
                      : isWhisper
                        ? "text-purple-800 dark:text-purple-200 italic"
                        : "text-gray-800 dark:text-gray-200"
                  }`}>
                    {msg.message}
                  </p>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Dice quick buttons (collapsible) */}
      {showDice && (
        <div className="border-t border-gray-200 dark:border-gray-700 px-3 py-2 space-y-2">
          {/* Count + Modifier controls row */}
          <div className="flex items-center gap-3">
            {/* Dice count */}
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium w-3 text-center">#</span>
              <button
                onClick={() => setDiceCount((c) => Math.max(1, c - 1))}
                className="w-6 h-6 flex items-center justify-center rounded bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500 active:scale-95 transition-all cursor-pointer text-sm font-bold"
              >
                -
              </button>
              <input
                type="number"
                value={diceCount}
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  if (!isNaN(v)) setDiceCount(Math.max(1, Math.min(99, v)));
                }}
                onBlur={() => { if (diceCount < 1) setDiceCount(1); }}
                className="w-8 text-center text-sm font-bold text-gray-800 dark:text-gray-200 tabular-nums bg-transparent border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:border-blue-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <button
                onClick={() => setDiceCount((c) => Math.min(99, c + 1))}
                className="w-6 h-6 flex items-center justify-center rounded bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500 active:scale-95 transition-all cursor-pointer text-sm font-bold"
              >
                +
              </button>
            </div>
            {/* Modifier */}
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">mod</span>
              <button
                onClick={() => setDiceModifier((m) => Math.max(-99, m - 1))}
                className="w-6 h-6 flex items-center justify-center rounded bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500 active:scale-95 transition-all cursor-pointer text-sm font-bold"
              >
                -
              </button>
              <input
                type="number"
                value={diceModifier}
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  if (!isNaN(v)) setDiceModifier(Math.max(-99, Math.min(99, v)));
                  else if (e.target.value === "" || e.target.value === "-") setDiceModifier(0);
                }}
                className="w-10 text-center text-sm font-bold text-gray-800 dark:text-gray-200 tabular-nums bg-transparent border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:border-blue-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <button
                onClick={() => setDiceModifier((m) => Math.min(99, m + 1))}
                className="w-6 h-6 flex items-center justify-center rounded bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500 active:scale-95 transition-all cursor-pointer text-sm font-bold"
              >
                +
              </button>
            </div>
            {/* Reset button */}
            {(diceCount !== 1 || diceModifier !== 0) && (
              <button
                onClick={() => { setDiceCount(1); setDiceModifier(0); }}
                className="ml-auto w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer"
                title="Reset to 1d+0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                  <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.451a.75.75 0 000-1.5H4.5a.75.75 0 00-.75.75v3.75a.75.75 0 001.5 0v-2.136l.312.311a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm-10.624-3.85a5.5 5.5 0 019.201-2.465l.312.31H11.75a.75.75 0 000 1.5H15.5a.75.75 0 00.75-.75V2.419a.75.75 0 00-1.5 0v2.136l-.312-.311A7 7 0 002.726 7.384a.75.75 0 001.449.39z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>
          {/* Dice type buttons */}
          <div className="grid grid-cols-7 gap-1">
            {DICE_BUTTONS.map((d) => (
              <button
                key={d.name}
                onClick={() => handleDiceButtonRoll(d.sides, d.name)}
                className={`${d.color} text-white font-bold py-1.5 rounded text-[11px] font-mono active:scale-95 transition-all cursor-pointer shadow-sm`}
                title={`Roll ${diceCount}${d.name}${diceModifier >= 0 ? `+${diceModifier}` : diceModifier}`}
              >
                {d.name.toUpperCase()}
              </button>
            ))}
          </div>
          {/* Token attribution */}
          {selectedToken ? (
            canRollToken ? (
              <div className="flex items-center gap-2 text-xs">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: selectedToken.color }} />
                <span className="text-gray-500 dark:text-gray-400 truncate">{selectedToken.name}</span>
              </div>
            ) : (
              <div className="text-[11px] text-gray-400 dark:text-gray-500">Not your unit</div>
            )
          ) : (
            <div className="text-[11px] text-gray-400 dark:text-gray-500">Select unit for token attribution</div>
          )}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-2">
        {/* AI Battle Engine: Turn banner */}
        {isMyTurn && currentTurnTokenName && (
          <div className="flex items-center gap-1.5 mb-1.5 px-1">
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200">
              YOUR TURN
            </span>
            <span className="text-xs text-yellow-700 dark:text-yellow-300 truncate">
              {currentTurnTokenName}
            </span>
            <button
              onClick={handleContinueTurn}
              disabled={aiLoading}
              className="ml-auto flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors flex items-center gap-1"
              title="Continue turn — send your rolls to AI"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-2.5 h-2.5">
                <path d="M3 3.732a1.5 1.5 0 012.305-1.265l6.706 4.267a1.5 1.5 0 010 2.531l-6.706 4.268A1.5 1.5 0 013 12.267V3.732z" />
              </svg>
              Continue
            </button>
          </div>
        )}

        {/* Quick-fill chips for player turn */}
        {isMyTurn && currentTurnTokenName && (
          <div className="flex flex-wrap gap-1 mb-1.5 px-1">
            {["Action:", "Bonus:", "Attack", "Cast", "Disengage", "Hide"].map((chip) => (
              <button
                key={chip}
                onClick={() => handleChipClick(chip)}
                className="px-1.5 py-0.5 rounded-full text-[11px] font-medium bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-200 dark:hover:bg-yellow-800/50 cursor-pointer transition-colors"
              >
                {chip}
              </button>
            ))}
          </div>
        )}

        {/* AI Battle Engine: Monster turn indicator */}
        {isMonsterTurn && currentTurnTokenName && (
          <div className="flex items-center gap-1.5 mb-1.5 px-1">
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200">
              ENEMY TURN
            </span>
            <span className="text-xs text-red-700 dark:text-red-300 truncate">
              {currentTurnTokenName}
            </span>
          </div>
        )}

        {/* AI loading indicator */}
        {aiLoading && (
          <div className="flex items-center gap-1.5 mb-1.5 px-1">
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200 animate-pulse">
              AI DM thinking...
            </span>
          </div>
        )}

        {/* Whisper target indicator */}
        {whispersEnabled && whisperTarget && (
          <div className="flex items-center gap-1.5 mb-1.5 px-1">
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-200 dark:bg-purple-800 text-purple-800 dark:text-purple-200">
              whisper
            </span>
            <span className="text-xs text-purple-600 dark:text-purple-400 truncate">
              to {whisperTarget.name}
            </span>
            <button
              onClick={clearWhisperTarget}
              className="ml-auto flex-shrink-0 w-4 h-4 flex items-center justify-center rounded-full text-purple-400 hover:text-purple-600 dark:hover:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/30 cursor-pointer"
              title="Cancel whisper"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                <path d="M5.28 4.22a.75.75 0 00-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 101.06 1.06L8 9.06l2.72 2.72a.75.75 0 101.06-1.06L9.06 8l2.72-2.72a.75.75 0 00-1.06-1.06L8 6.94 5.28 4.22z" />
              </svg>
            </button>
          </div>
        )}

        <div className="relative">
          {/* Whisper autocomplete dropdown */}
          {whispersEnabled && showWhisperList && (
            <div className="absolute bottom-full left-0 right-0 mb-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-40 overflow-y-auto z-20">
              {filteredWhisperUsers.length === 0 ? (
                <div className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500">
                  {otherUsers.length === 0 ? "No other players online" : "No matching players"}
                </div>
              ) : (
                filteredWhisperUsers.map((u, idx) => (
                  <button
                    key={u.id}
                    onClick={() => selectWhisperTarget(u)}
                    className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 cursor-pointer transition-colors ${
                      idx === whisperFilterIndex
                        ? "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
                    }`}
                  >
                    <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                    <span className="truncate">{u.name}</span>
                  </button>
                ))
              )}
            </div>
          )}

          <div className="flex gap-1.5">
            {/* Dice toggle */}
            <button
              onClick={() => setShowDice(!showDice)}
              className={`flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
                showDice
                  ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
                  : "text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300"
              }`}
              title={showDice ? "Hide dice" : "Show dice buttons"}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M12.378 1.602a.75.75 0 00-.756 0L3 6.632l9 5.25 9-5.25-8.622-5.03zM21.75 7.93l-9 5.25v9l8.628-5.032a.75.75 0 00.372-.648V7.93zm-10.5 14.25v-9l-9-5.25v8.57a.75.75 0 00.372.648l8.628 5.033z" />
              </svg>
            </button>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isMyTurn
                  ? "Declare your action..."
                  : whisperTarget
                    ? `Message ${whisperTarget.name}...`
                    : "/r /dr /w ..."
              }
              maxLength={500}
              className={`flex-1 min-w-0 px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 ${
                isMyTurn
                  ? "border-yellow-300 dark:border-yellow-600 focus:ring-yellow-500"
                  : whisperTarget
                    ? "border-purple-300 dark:border-purple-600 focus:ring-purple-500"
                    : "border-gray-300 dark:border-gray-600 focus:ring-blue-500"
              }`}
            />
            {/* Send to AI button - shown when it's your turn and input has text */}
            {isMyTurn && onAiPrompt && (
              <button
                onClick={handleSendToAi}
                disabled={!input.trim() || aiLoading}
                className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg bg-yellow-500 hover:bg-yellow-600 text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="Send action to AI"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path d="M13 7H7v6h6V7z" />
                  <path fillRule="evenodd" d="M7 2a1 1 0 012 0v1h2V2a1 1 0 112 0v1h2a2 2 0 012 2v2h1a1 1 0 110 2h-1v2h1a1 1 0 110 2h-1v2a2 2 0 01-2 2h-2v1a1 1 0 11-2 0v-1H9v1a1 1 0 11-2 0v-1H5a2 2 0 01-2-2v-2H2a1 1 0 110-2h1V9H2a1 1 0 010-2h1V5a2 2 0 012-2h2V2zM5 5h10v10H5V5z" clipRule="evenodd" />
                </svg>
              </button>
            )}
            <button
              onClick={handleSend}
              disabled={!input.trim() && !showWhisperList}
              className={`flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors ${
                whisperTarget
                  ? "bg-purple-600 hover:bg-purple-700"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
