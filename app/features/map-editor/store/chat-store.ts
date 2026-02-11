import { create } from "zustand";

export interface DiceRollData {
  dice: string;       // "d20", "d6", etc.
  count: number;      // number of dice
  modifier: number;   // +/- modifier
  rolls: number[];    // individual roll results
  total: number;      // final total
  tokenName?: string;
  tokenColor?: string;
}

export interface ChatMessageData {
  id: string;
  mapId: string;
  userId: string;
  userName: string;
  message: string;
  role: "dm" | "player";
  createdAt: string;
  metadata?: {
    diceRoll?: DiceRollData;
  } | null;
  recipientId?: string | null;
  recipientName?: string | null;
}

interface ChatState {
  messages: ChatMessageData[];
  unreadCount: number;
  isOpen: boolean;
  isLoaded: boolean;
}

interface ChatActions {
  addMessage: (msg: ChatMessageData) => void;
  setMessages: (msgs: ChatMessageData[]) => void;
  appendHistory: (msgs: ChatMessageData[]) => void;
  setOpen: (open: boolean) => void;
  toggleOpen: () => void;
  setLoaded: (loaded: boolean) => void;
  reset: () => void;
}

const MAX_MESSAGES = 200;

const initialState: ChatState = {
  messages: [],
  unreadCount: 0,
  isOpen: false,
  isLoaded: false,
};

export const useChatStore = create<ChatState & ChatActions>((set, get) => ({
  ...initialState,

  addMessage: (msg) => {
    const { messages, isOpen } = get();
    if (messages.some((m) => m.id === msg.id)) return;
    const updated = [...messages, msg].slice(-MAX_MESSAGES);
    set({
      messages: updated,
      unreadCount: isOpen ? 0 : get().unreadCount + 1,
    });
  },

  setMessages: (msgs) => {
    set({ messages: msgs.slice(-MAX_MESSAGES), isLoaded: true });
  },

  appendHistory: (msgs) => {
    const { messages } = get();
    const existingIds = new Set(messages.map((m) => m.id));
    const newMsgs = msgs.filter((m) => !existingIds.has(m.id));
    if (newMsgs.length === 0) return;
    const merged = [...messages, ...newMsgs]
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .slice(-MAX_MESSAGES);
    set({ messages: merged });
  },

  setOpen: (open) => {
    set({ isOpen: open, unreadCount: open ? 0 : get().unreadCount });
  },

  toggleOpen: () => {
    const isOpen = !get().isOpen;
    set({ isOpen, unreadCount: isOpen ? 0 : get().unreadCount });
  },

  setLoaded: (loaded) => set({ isLoaded: loaded }),

  reset: () => set(initialState),
}));

/**
 * Parse dice notation like "1d20+3", "2d6-1", "d8", "4d6"
 * Returns null if the notation is invalid.
 */
export function parseDiceNotation(notation: string): { count: number; sides: number; modifier: number } | null {
  const match = notation.trim().match(/^(\d*)d(\d+)([+-]\d+)?$/i);
  if (!match) return null;

  const count = match[1] ? parseInt(match[1]) : 1;
  const sides = parseInt(match[2]);
  const modifier = match[3] ? parseInt(match[3]) : 0;

  if (count < 1 || count > 99 || sides < 2 || sides > 100) return null;

  return { count, sides, modifier };
}

/**
 * Execute dice rolls and return results.
 */
export function rollDice(count: number, sides: number, modifier: number): { rolls: number[]; total: number } {
  const rolls: number[] = [];
  for (let i = 0; i < count; i++) {
    rolls.push(Math.floor(Math.random() * sides) + 1);
  }
  const total = rolls.reduce((a, b) => a + b, 0) + modifier;
  return { rolls, total };
}
