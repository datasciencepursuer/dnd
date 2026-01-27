import { create } from "zustand";

export interface RollResult {
  dice: string;
  count: number;
  rolls: number[];
  total: number;
  timestamp: number;
  tokenId: string;
  tokenName: string;
  tokenColor: string;
}

interface DiceState {
  diceCount: number;
  results: RollResult[];
  isRolling: boolean;

  setDiceCount: (count: number) => void;
  rollDice: (
    diceName: string,
    sides: number,
    token: { id: string; name: string; color: string }
  ) => void;
  clearHistory: () => void;
}

export const useDiceStore = create<DiceState>((set, get) => ({
  diceCount: 1,
  results: [],
  isRolling: false,

  setDiceCount: (count) => set({ diceCount: count }),

  rollDice: (diceName, sides, token) => {
    const { diceCount } = get();
    set({ isRolling: true });

    setTimeout(() => {
      const rolls: number[] = [];
      for (let i = 0; i < diceCount; i++) {
        rolls.push(Math.floor(Math.random() * sides) + 1);
      }

      const result: RollResult = {
        dice: diceName,
        count: diceCount,
        rolls,
        total: rolls.reduce((a, b) => a + b, 0),
        timestamp: Date.now(),
        tokenId: token.id,
        tokenName: token.name,
        tokenColor: token.color,
      };

      set((state) => ({
        results: [result, ...state.results].slice(0, 8),
        isRolling: false,
      }));
    }, 150);
  },

  clearHistory: () => set({ results: [] }),
}));
