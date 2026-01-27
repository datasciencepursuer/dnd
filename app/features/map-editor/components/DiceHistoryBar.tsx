import { useDiceStore } from "../store/dice-store";
import { useMapStore, useEditorStore } from "../store";

interface DiceType {
  name: string;
  sides: number;
  color: string;
}

const DICE_TYPES: DiceType[] = [
  { name: "d4", sides: 4, color: "bg-red-600 hover:bg-red-700" },
  { name: "d6", sides: 6, color: "bg-orange-600 hover:bg-orange-700" },
  { name: "d8", sides: 8, color: "bg-yellow-600 hover:bg-yellow-700" },
  { name: "d10", sides: 10, color: "bg-green-600 hover:bg-green-700" },
  { name: "d12", sides: 12, color: "bg-blue-600 hover:bg-blue-700" },
  { name: "d20", sides: 20, color: "bg-purple-600 hover:bg-purple-700" },
  { name: "d100", sides: 100, color: "bg-pink-600 hover:bg-pink-700" },
];

export function DiceHistoryBar() {
  const map = useMapStore((s) => s.map);
  const selectedIds = useEditorStore((s) => s.selectedElementIds);
  const { diceCount, results, isRolling, setDiceCount, rollDice, clearHistory } = useDiceStore();

  // Get the selected token
  const selectedToken = selectedIds.length === 1
    ? map?.tokens.find((t) => t.id === selectedIds[0])
    : null;

  const canRoll = !!selectedToken;

  const handleRoll = (dice: DiceType) => {
    if (!selectedToken) return;
    rollDice(dice.name, dice.sides, selectedToken);
  };

  return (
    <div className="w-72 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col h-full">
      {/* Dice Controls */}
      <div className="p-4 space-y-4 border-b border-gray-200 dark:border-gray-700">
        {/* Selected Token Indicator */}
        {selectedToken ? (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800">
            <div
              className="w-6 h-6 rounded-full flex-shrink-0 ring-2 ring-white dark:ring-gray-800"
              style={{ backgroundColor: selectedToken.color }}
            />
            <span className="text-base font-semibold text-blue-700 dark:text-blue-300 truncate">
              {selectedToken.name}
            </span>
          </div>
        ) : (
          <div className="p-3 rounded-lg bg-gray-100 dark:bg-gray-700 text-center">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Select a unit to roll dice
            </span>
          </div>
        )}

        {/* Dice Count */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setDiceCount(Math.max(1, diceCount - 1))}
            disabled={!canRoll}
            className="w-10 h-10 flex items-center justify-center rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 cursor-pointer font-bold text-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            -
          </button>
          <input
            type="number"
            min="1"
            max="99"
            value={diceCount}
            disabled={!canRoll}
            onChange={(e) => setDiceCount(Math.max(1, Math.min(99, parseInt(e.target.value) || 1)))}
            className="w-16 px-2 py-2 text-center text-xl font-bold rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
          />
          <button
            onClick={() => setDiceCount(Math.min(99, diceCount + 1))}
            disabled={!canRoll}
            className="w-10 h-10 flex items-center justify-center rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 cursor-pointer font-bold text-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            +
          </button>
        </div>

        {/* Dice Buttons */}
        <div className="grid grid-cols-4 gap-2">
          {DICE_TYPES.map((dice) => (
            <button
              key={dice.name}
              onClick={() => handleRoll(dice)}
              disabled={isRolling || !canRoll}
              title={canRoll ? `Roll ${diceCount}${dice.name}` : "Select a unit first"}
              className={`${dice.color} text-white font-bold py-2.5 rounded-lg text-sm font-mono tracking-tight active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-sm`}
            >
              {dice.name.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Roll History Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100 dark:border-gray-700">
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Roll History
        </span>
        {results.length > 0 && (
          <button
            onClick={clearHistory}
            className="text-sm text-gray-400 hover:text-red-500 dark:hover:text-red-400 cursor-pointer transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Roll History */}
      <div className="flex-1 px-4 py-3 space-y-2 overflow-y-auto">
        {Array.from({ length: 8 }).map((_, index) => {
          const result = results[index];
          if (result) {
            return (
              <div
                key={result.timestamp}
                className={`flex items-center gap-3 p-3 rounded-lg border ${
                  index === 0 && isRolling
                    ? "animate-pulse bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800"
                    : index === 0
                      ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                      : "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700"
                }`}
              >
                <div
                  className="w-5 h-5 rounded-full flex-shrink-0 ring-2 ring-white dark:ring-gray-800"
                  style={{ backgroundColor: result.tokenColor }}
                  title={result.tokenName}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      {result.count}{result.dice}
                    </span>
                    <span className={`text-xl font-bold ${
                      index === 0
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-gray-900 dark:text-white"
                    }`}>
                      {result.total}
                    </span>
                  </div>
                  {result.rolls.length > 1 && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                      {result.rolls.join(" + ")}
                    </div>
                  )}
                </div>
              </div>
            );
          }
          return (
            <div
              key={`empty-${index}`}
              className="flex items-center gap-3 p-3 rounded-lg bg-gray-50/50 dark:bg-gray-800/30 border border-dashed border-gray-200 dark:border-gray-700"
            >
              <div className="w-5 h-5 rounded-full flex-shrink-0 bg-gray-200 dark:bg-gray-700" />
              <span className="text-sm text-gray-300 dark:text-gray-600">—</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
