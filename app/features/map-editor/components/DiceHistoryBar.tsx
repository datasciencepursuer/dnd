import { useDiceStore } from "../store/dice-store";
import { useMapStore, useEditorStore } from "../store";

interface DiceType {
  name: string;
  sides: number;
  color: string;
}

const DICE_TYPES: DiceType[] = [
  { name: "d4", sides: 4, color: "bg-gray-600 dark:bg-gray-500" },
  { name: "d6", sides: 6, color: "bg-gray-600 dark:bg-gray-500" },
  { name: "d8", sides: 8, color: "bg-gray-600 dark:bg-gray-500" },
  { name: "d10", sides: 10, color: "bg-gray-600 dark:bg-gray-500" },
  { name: "d12", sides: 12, color: "bg-gray-600 dark:bg-gray-500" },
  { name: "d20", sides: 20, color: "bg-gray-600 dark:bg-gray-500" },
  { name: "d100", sides: 100, color: "bg-gray-600 dark:bg-gray-500" },
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
    <div className="w-52 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col h-full">
      {/* Dice Controls */}
      <div className="p-3 space-y-3 border-b border-gray-200 dark:border-gray-700">
        {/* Selected Token Indicator */}
        {selectedToken ? (
          <div className="flex items-center gap-2 p-2 rounded bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800">
            <div
              className="w-4 h-4 rounded-full flex-shrink-0"
              style={{ backgroundColor: selectedToken.color }}
            />
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300 truncate">
              {selectedToken.name}
            </span>
          </div>
        ) : (
          <div className="p-2 rounded bg-gray-100 dark:bg-gray-700 text-center">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Select a unit to roll
            </span>
          </div>
        )}

        {/* Dice Count */}
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setDiceCount(Math.max(1, diceCount - 1))}
            disabled={!canRoll}
            className="w-7 h-7 flex items-center justify-center rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 cursor-pointer font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
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
            className="w-12 px-1 py-1 text-center text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
          />
          <button
            onClick={() => setDiceCount(Math.min(99, diceCount + 1))}
            disabled={!canRoll}
            className="w-7 h-7 flex items-center justify-center rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 cursor-pointer font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            +
          </button>
        </div>

        {/* Dice Buttons */}
        <div className="grid grid-cols-4 gap-1">
          {DICE_TYPES.map((dice) => (
            <button
              key={dice.name}
              onClick={() => handleRoll(dice)}
              disabled={isRolling || !canRoll}
              title={canRoll ? `Roll ${diceCount}${dice.name}` : "Select a unit first"}
              className={`${dice.color} text-white font-bold py-1.5 rounded text-sm font-mono tracking-tight hover:opacity-90 active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {dice.name.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Roll History Header */}
      <div className="px-3 py-2 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
          History
        </span>
        {results.length > 0 && (
          <button
            onClick={clearHistory}
            className="text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 cursor-pointer"
          >
            Clear
          </button>
        )}
      </div>

      {/* Roll History */}
      <div className="flex-1 px-3 pb-3 space-y-1 overflow-y-auto">
        {Array.from({ length: 8 }).map((_, index) => {
          const result = results[index];
          if (result) {
            return (
              <div
                key={result.timestamp}
                className={`flex items-center gap-2 p-2 rounded text-xs border border-transparent ${
                  index === 0 && isRolling
                    ? "animate-pulse bg-gray-100 dark:bg-gray-700"
                    : "bg-gray-50 dark:bg-gray-800"
                }`}
              >
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: result.tokenColor }}
                  title={result.tokenName}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 dark:text-gray-400">
                      {result.count}{result.dice}
                    </span>
                    <span className="font-bold text-gray-900 dark:text-white">
                      {result.total}
                    </span>
                  </div>
                  {result.rolls.length > 1 && (
                    <div className="text-gray-400 dark:text-gray-500 truncate text-[10px]">
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
              className="flex items-center gap-2 p-2 rounded text-xs bg-gray-50/30 dark:bg-gray-800/30 border border-dashed border-gray-200 dark:border-gray-700"
            >
              <div className="w-3 h-3 rounded-full flex-shrink-0 bg-gray-200 dark:bg-gray-700" />
              <span className="text-gray-300 dark:text-gray-600">—</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
