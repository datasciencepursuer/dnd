import { useState, useEffect, useRef } from "react";

interface InitiativeEntry {
  tokenId: string;
  tokenName: string;
  tokenColor: string;
  initiative: number;
  initMod: number;
  roll: number;
  layer: string;
  groupId: string | null;
  groupCount: number;
  groupTokenIds: string[];
}

interface InitiativeSetupModalProps {
  isOpen: boolean;
  entries: InitiativeEntry[];
  onConfirm: (entries: InitiativeEntry[]) => void;
  onCancel: () => void;
}

function CharacterIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
    </svg>
  );
}

function MonsterIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 2a8 8 0 100 16 8 8 0 000-16zM6.5 8a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm7 0a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM10 12a2 2 0 100-4 2 2 0 000 4zm-3 2a1 1 0 112 0 1 1 0 01-2 0zm5 0a1 1 0 112 0 1 1 0 01-2 0z" clipRule="evenodd" />
    </svg>
  );
}

function DiceIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM7.5 18c-.83 0-1.5-.67-1.5-1.5S6.67 15 7.5 15s1.5.67 1.5 1.5S8.33 18 7.5 18zm0-9C6.67 9 6 8.33 6 7.5S6.67 6 7.5 6 9 6.67 9 7.5 8.33 9 7.5 9zm4.5 4.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4.5 4.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm0-9c-.83 0-1.5-.67-1.5-1.5S15.67 6 16.5 6s1.5.67 1.5 1.5S17.33 9 16.5 9z"/>
    </svg>
  );
}

function CrossedSwordsIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M6.92 5H5l5.5 5.5.71-.71L6.92 5zm12.08 0h-1.92l-4.29 4.29.71.71L19 5zM12 9.17L5.83 15.34 4.42 13.93 10.59 7.76l.71.71L5.83 13.93l1.41 1.41L12 10.59l4.76 4.75 1.41-1.41L12.71 8.46l.71-.71 5.46 5.46-1.41 1.42L12 9.17zM3 19v2h18v-2H3z"/>
    </svg>
  );
}

export function InitiativeSetupModal({
  isOpen,
  entries: initialEntries,
  onConfirm,
  onCancel,
}: InitiativeSetupModalProps) {
  const [entries, setEntries] = useState<InitiativeEntry[]>(initialEntries);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  // Update entries when modal opens with new data
  useEffect(() => {
    if (isOpen) {
      setEntries(initialEntries);
    }
  }, [isOpen, initialEntries]);

  // Handle keyboard events
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const rollD20 = () => Math.floor(Math.random() * 20) + 1;

  const handleRerollOne = (tokenId: string) => {
    setEntries((prev) =>
      prev.map((entry) => {
        if (entry.tokenId === tokenId) {
          const newRoll = rollD20();
          return {
            ...entry,
            roll: newRoll,
            initiative: newRoll + entry.initMod,
          };
        }
        return entry;
      })
    );
  };

  const handleRerollAll = () => {
    setEntries((prev) =>
      prev.map((entry) => {
        const newRoll = rollD20();
        return {
          ...entry,
          roll: newRoll,
          initiative: newRoll + entry.initMod,
        };
      })
    );
  };

  const handleInitiativeChange = (tokenId: string, value: string) => {
    const numValue = parseInt(value, 10);
    if (isNaN(numValue)) return;

    setEntries((prev) =>
      prev.map((entry) => {
        if (entry.tokenId === tokenId) {
          return {
            ...entry,
            initiative: numValue,
            // Update roll to reflect manual change (initiative - mod)
            roll: numValue - entry.initMod,
          };
        }
        return entry;
      })
    );
  };

  const handleConfirm = () => {
    // Sort by initiative descending before confirming
    const sorted = [...entries].sort((a, b) => b.initiative - a.initiative);
    onConfirm(sorted);
  };

  // Sort entries for display (highest initiative first)
  const sortedEntries = [...entries].sort((a, b) => b.initiative - a.initiative);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <CrossedSwordsIcon className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Initiative Setup
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Edit values or re-roll before starting combat
              </p>
            </div>
          </div>
          <button
            onClick={handleRerollAll}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer transition-colors"
          >
            <DiceIcon className="h-4 w-4" />
            Re-roll All
          </button>
        </div>

        {/* Initiative List */}
        <div className="p-4 max-h-80 overflow-y-auto">
          {sortedEntries.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-4">
              No eligible tokens found for combat
            </p>
          ) : (
            <div className="space-y-2">
              {sortedEntries.map((entry, index) => {
                const isMonsterGroup = entry.layer === "monster" && entry.groupCount > 1;
                return (
                  <div
                    key={entry.tokenId}
                    className={`flex items-center gap-3 p-2 rounded-lg ${
                      isMonsterGroup
                        ? "bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800"
                        : "bg-gray-50 dark:bg-gray-700/50"
                    }`}
                  >
                    {/* Rank */}
                    <span className="text-sm font-bold text-gray-400 dark:text-gray-500 w-5 text-center">
                      {index + 1}
                    </span>

                    {/* Layer icon */}
                    {entry.layer === "character" ? (
                      <CharacterIcon className="w-4 h-4 text-blue-500 dark:text-blue-400 flex-shrink-0" />
                    ) : (
                      <MonsterIcon className="w-4 h-4 text-red-500 dark:text-red-400 flex-shrink-0" />
                    )}

                    {/* Token color dot */}
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0 border border-gray-300 dark:border-gray-600"
                      style={{ backgroundColor: entry.tokenColor }}
                    />

                    {/* Name */}
                    <span
                      className={`flex-1 text-sm truncate ${
                        isMonsterGroup
                          ? "text-purple-700 dark:text-purple-300 font-medium"
                          : "text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {entry.tokenName}
                    </span>

                    {/* Roll info (small text) */}
                    <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                      {entry.roll >= 0 ? `${entry.roll}` : entry.roll}
                      {entry.initMod >= 0 ? `+${entry.initMod}` : entry.initMod}
                    </span>

                    {/* Initiative input */}
                    <input
                      type="number"
                      value={entry.initiative}
                      onChange={(e) => handleInitiativeChange(entry.tokenId, e.target.value)}
                      className="w-14 px-2 py-1 text-sm text-center font-medium rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 dark:focus:ring-red-400"
                    />

                    {/* Re-roll button */}
                    <button
                      onClick={() => handleRerollOne(entry.tokenId)}
                      className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer transition-colors"
                      title="Re-roll initiative"
                    >
                      <DiceIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
          >
            Cancel
          </button>
          <button
            ref={confirmButtonRef}
            onClick={handleConfirm}
            disabled={sortedEntries.length === 0}
            className="flex-1 px-4 py-2 rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 flex items-center justify-center gap-2"
          >
            <CrossedSwordsIcon className="h-5 w-5" />
            Start Combat
          </button>
        </div>
      </div>
    </div>
  );
}
