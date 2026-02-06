import { useCallback, useState, useEffect, useRef } from "react";
import type { Token, CharacterSheet, AbilityScore, AbilityScores, SkillProficiencies, SkillLevel, ClassFeature, FeatureCategory, Weapon, Condition, Spell, Equipment, RechargeCondition, DamageType } from "../../types";
import { DAMAGE_TYPES } from "../../types";
import { AbilityScoreCard } from "./AbilityScoreCard";
import { Combobox } from "./Combobox";
import { formatModifier, getHpPercentage, getHpBarColor, createDefaultCharacterSheet, calculatePassivePerception, ensureSkills, calculateProficiencyBonus } from "../../utils/character-utils";
import { DND_RACES, DND_CLASSES, DND_BACKGROUNDS, DND_WEAPONS, DND_DICE, DND_EQUIPMENT, DND_MAGIC_ITEMS, DND_LANGUAGES, DND_TOOLS, DND_SPECIES_TRAITS, DND_FEATS, DND_SPELL_RANGES, getSubclasses, getSpellNames } from "../../data/dnd-srd";

const FEATURE_CATEGORIES: { value: FeatureCategory; label: string; color: string }[] = [
  { value: "action", label: "Action", color: "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300" },
  { value: "bonusAction", label: "Bonus Action", color: "bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300" },
  { value: "reaction", label: "Reaction", color: "bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300" },
  { value: "limitedUse", label: "Limited Use", color: "bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300" },
];

const CONDITIONS: Condition[] = [
  "Healthy",
  "Blinded",
  "Charmed",
  "Deafened",
  "Frightened",
  "Grappled",
  "Incapacitated",
  "Invisible",
  "Paralyzed",
  "Petrified",
  "Poisoned",
  "Prone",
  "Restrained",
  "Stunned",
  "Unconscious",
  "Exhaustion",
];

// Reusable numeric input that allows empty while typing, validates on blur
interface NumericInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  defaultValue?: number;
  className?: string;
  placeholder?: string;
}

function NumericInput({
  value,
  onChange,
  min = 0,
  max = 99,
  defaultValue = 0,
  className = "",
  placeholder,
}: NumericInputProps) {
  const [inputValue, setInputValue] = useState(String(value));

  // Sync with external changes
  useEffect(() => {
    setInputValue(String(value));
  }, [value]);

  const handleBlur = () => {
    const parsed = parseInt(inputValue);
    const validated = isNaN(parsed) ? defaultValue : Math.max(min, Math.min(max, parsed));
    setInputValue(String(validated));
    onChange(validated);
  };

  return (
    <input
      type="number"
      value={inputValue}
      onChange={(e) => setInputValue(e.target.value)}
      onBlur={handleBlur}
      min={min}
      max={max}
      className={className}
      placeholder={placeholder}
    />
  );
}

// Text input that expands downward on focus to show full content
interface ExpandingTextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  baseClassName?: string;
}

function ExpandingTextInput({
  value,
  onChange,
  placeholder = "",
  baseClassName = "",
}: ExpandingTextInputProps) {
  const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    e.target.style.height = "";
    const trimmed = value.trim();
    if (trimmed !== value) {
      onChange(trimmed);
    }
  };

  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={(e) => { e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
      onBlur={handleBlur}
      placeholder={placeholder}
      rows={1}
      className={`${baseClassName} transition-all duration-150 resize-none overflow-hidden`}
      style={{ lineHeight: '1.4' }}
    />
  );
}

// Textarea that expands on focus
interface ExpandingTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  baseClassName?: string;
  collapsedRows?: number;
}

function ExpandingTextarea({
  value,
  onChange,
  placeholder = "",
  baseClassName = "",
  collapsedRows = 2,
}: ExpandingTextareaProps) {
  const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    e.target.style.height = "";
    const trimmed = value.trim();
    if (trimmed !== value) {
      onChange(trimmed);
    }
  };

  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={(e) => { e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
      onBlur={handleBlur}
      placeholder={placeholder}
      rows={collapsedRows}
      className={`${baseClassName} transition-all duration-150 resize-none overflow-hidden`}
    />
  );
}

// localStorage helpers for crash recovery
const STORAGE_PREFIX = "character-sheet-draft-";

function getStorageKey(characterId: string): string {
  return `${STORAGE_PREFIX}${characterId}`;
}

function saveDraftToStorage(characterId: string, sheet: CharacterSheet): void {
  try {
    const key = getStorageKey(characterId);
    const data = { sheet, savedAt: Date.now() };
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error("Failed to save draft to localStorage:", e);
  }
}

function loadDraftFromStorage(characterId: string): { sheet: CharacterSheet; savedAt: number } | null {
  try {
    const key = getStorageKey(characterId);
    const data = localStorage.getItem(key);
    if (!data) return null;
    return JSON.parse(data);
  } catch (e) {
    console.error("Failed to load draft from localStorage:", e);
    return null;
  }
}

function clearDraftFromStorage(characterId: string): void {
  try {
    const key = getStorageKey(characterId);
    localStorage.removeItem(key);
  } catch (e) {
    console.error("Failed to clear draft from localStorage:", e);
  }
}

// Standalone character data (for /characters route)
interface StandaloneCharacter {
  id: string;
  name: string;
  color: string;
  imageUrl: string | null;
  sheet: CharacterSheet | null;
}

interface LibraryCharacter {
  id: string;
  name: string;
  imageUrl: string | null;
  color: string;
  size: number;
  layer: string;
  characterSheet: CharacterSheet | null;
}

interface CharacterSheetPanelProps {
  // Option 1: Token-based (map editor)
  token?: Token;
  onUpdate?: (updates: Partial<CharacterSheet>) => void;
  onInitialize?: () => void;
  onLinkCharacter?: (character: LibraryCharacter) => void;
  // Option 2: Standalone character (/characters route)
  character?: StandaloneCharacter;
  // Common props
  onClose: () => void;
  readOnly?: boolean;
  onSaved?: () => void;
}

export function CharacterSheetPanel({
  token,
  onUpdate,
  onClose,
  onInitialize,
  onLinkCharacter,
  character,
  readOnly = false,
  onSaved,
}: CharacterSheetPanelProps) {
  // Determine mode: standalone character vs token-based
  const isStandalone = !!character && !token;
  const characterId = isStandalone ? character.id : token?.characterId;
  const isLinked = !!characterId;

  // Character info (from token or standalone)
  const charName = isStandalone ? character.name : token?.name ?? "";
  const charColor = isStandalone ? character.color : token?.color ?? "#888";
  const charImageUrl = isStandalone ? character.imageUrl : token?.imageUrl ?? null;

  // State
  const [linkedCharacterSheet, setLinkedCharacterSheet] = useState<CharacterSheet | null>(
    isStandalone ? character.sheet : null
  );
  // Start loading if we have a token-linked character that needs to be fetched
  const [isLoadingLinked, setIsLoadingLinked] = useState(!isStandalone && !!token?.characterId);
  const [linkedFetchFailed, setLinkedFetchFailed] = useState(false);
  const [isSavingToLibrary, setIsSavingToLibrary] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<1 | 2>(1);
  const [availableCharacters, setAvailableCharacters] = useState<LibraryCharacter[]>([]);
  const [showCharacterPicker, setShowCharacterPicker] = useState(false);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentSheetRef = useRef<CharacterSheet | null>(null);
  const draftRecoveredRef = useRef(false);

  // Fetch linked character's sheet on mount (for token-based linked characters)
  // Linked tokens have characterSheet = null, so we always fetch from library
  useEffect(() => {
    if (isStandalone || !token?.characterId) {
      return;
    }

    setIsLoadingLinked(true);
    fetch(`/api/characters/${token.characterId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch character");
        return res.json();
      })
      .then((data) => {
        // API returns { character: { characterSheet, ... } }
        // Library is the single source of truth for linked characters
        const fetchedSheet = data.character?.characterSheet || null;
        setLinkedCharacterSheet(fetchedSheet);

        // Also update token's cached copy for display (HP bar, AC icon on hover)
        // This ensures hover display works even before any edits are made
        if (fetchedSheet && onUpdate) {
          onUpdate(fetchedSheet);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch linked character:", err);
        // Fall back to token's cached sheet if available (e.g. token assigned to new owner
        // who doesn't have access to the original owner's library)
        if (token?.characterSheet) {
          setLinkedCharacterSheet(token.characterSheet);
        } else {
          setLinkedCharacterSheet(null);
        }
        setLinkedFetchFailed(true);
      })
      .finally(() => {
        setIsLoadingLinked(false);
      });
  }, [isStandalone, token?.characterId, onUpdate]);

  // Fetch available characters from library (for "Link from Library" picker)
  useEffect(() => {
    if (isStandalone || isLinked || !onLinkCharacter) return;

    const fetchCharacters = async () => {
      try {
        const response = await fetch("/api/characters");
        if (response.ok) {
          const data = await response.json();
          setAvailableCharacters(data.characters || []);
        }
      } catch (error) {
        console.error("Failed to fetch characters:", error);
      }
    };

    fetchCharacters();
  }, [isStandalone, isLinked, onLinkCharacter]);

  // Sync to server function (for API-saved characters)
  const syncToServer = useCallback(async (sheetToSync: CharacterSheet) => {
    if (!characterId) return;

    setIsSyncing(true);
    setSyncError(null);
    try {
      const response = await fetch(`/api/characters/${characterId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterSheet: sheetToSync }),
      });
      if (!response.ok) throw new Error("Failed to save");
      clearDraftFromStorage(characterId);
      setHasPendingChanges(false);
      onSaved?.();
    } catch (e) {
      setSyncError("Failed to sync - will retry");
      console.error("Sync failed:", e);
    } finally {
      setIsSyncing(false);
    }
  }, [characterId, onSaved]);

  // Check for unsaved draft on mount - automatically apply if found (seamless recovery)
  useEffect(() => {
    if (!characterId || draftRecoveredRef.current) return;

    const draft = loadDraftFromStorage(characterId);
    if (draft) {
      draftRecoveredRef.current = true;
      // Automatically apply the draft - user likely won't remember what changes they made
      setLinkedCharacterSheet(draft.sheet);
      setHasPendingChanges(true);
      // Sync the recovered draft to server
      syncToServer(draft.sheet);
    }
  }, [characterId, syncToServer]);

  // Keep ref in sync for beforeunload
  useEffect(() => {
    currentSheetRef.current = linkedCharacterSheet;
  }, [linkedCharacterSheet]);

  // beforeunload handler - attempt best-effort sync (no warning needed since localStorage has backup)
  useEffect(() => {
    if (!characterId || linkedFetchFailed) return;

    const handleBeforeUnload = () => {
      if (hasPendingChanges && currentSheetRef.current) {
        const data = JSON.stringify({ characterSheet: currentSheetRef.current });
        const blob = new Blob([data], { type: "application/json" });
        navigator.sendBeacon?.(`/api/characters/${characterId}`, blob);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [characterId, hasPendingChanges, linkedFetchFailed]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);

  // If linked fetch failed, treat as unlinked for editing (edits go through onUpdate instead of syncToServer)
  const effectivelyLinked = isLinked && !linkedFetchFailed;

  // Use linked/standalone character sheet if available, otherwise use token's inline sheet
  const sheet = isLinked ? linkedCharacterSheet : token?.characterSheet ?? null;

  // Handler that routes to either local update or API update
  const handleUpdate = useCallback(
    (updates: Partial<CharacterSheet>) => {
      if (!sheet) return;

      // Always update lastModified for version tracking
      const newSheet = { ...sheet, ...updates, lastModified: Date.now() };
      if (updates.abilities) {
        newSheet.abilities = { ...sheet.abilities, ...updates.abilities };
      }

      if (effectivelyLinked && characterId) {
        // API-saved characters: localStorage + debounced sync to library
        setLinkedCharacterSheet(newSheet);
        saveDraftToStorage(characterId, newSheet);
        setHasPendingChanges(true);
        setSyncError(null);

        // Also update token's cached copy for display (HP bar, AC icon)
        if (onUpdate) {
          onUpdate({ ...updates, lastModified: Date.now() });
        }

        if (syncTimeoutRef.current) {
          clearTimeout(syncTimeoutRef.current);
        }

        syncTimeoutRef.current = setTimeout(() => {
          syncToServer(newSheet);
        }, 5000); // 5 second debounce
      } else if (onUpdate) {
        // Token inline sheet or linked-but-fetch-failed: use callback
        if (linkedFetchFailed) {
          // Also keep local state in sync so the panel reflects edits
          setLinkedCharacterSheet(newSheet);
        }
        onUpdate({ ...updates, lastModified: Date.now() });
      }
    },
    [sheet, effectivelyLinked, linkedFetchFailed, characterId, syncToServer, onUpdate]
  );

  // Fire-and-forget sync on close
  const handleClose = useCallback(() => {
    if (hasPendingChanges && currentSheetRef.current && effectivelyLinked && characterId) {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      syncToServer(currentSheetRef.current);
    }
    onClose();
  }, [hasPendingChanges, effectivelyLinked, characterId, syncToServer, onClose]);

  // Save token (with sheet) to the current user's library
  const handleSaveToLibrary = useCallback(async () => {
    if (!token || !sheet || !onLinkCharacter) return;
    setIsSavingToLibrary(true);
    try {
      const response = await fetch("/api/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: token.name || "Unnamed Character",
          imageUrl: token.imageUrl,
          color: token.color,
          size: token.size,
          layer: token.layer,
          characterSheet: sheet,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        // Link the token to the newly created library character
        onLinkCharacter(data.character);
        setLinkedFetchFailed(false);
      }
    } catch (err) {
      console.error("Failed to save to library:", err);
    } finally {
      setIsSavingToLibrary(false);
    }
  }, [token, sheet, onLinkCharacter]);

  const handleAbilityChange = useCallback(
    (abilityName: keyof AbilityScores, ability: AbilityScore) => {
      if (!sheet) return;
      handleUpdate({
        abilities: {
          ...sheet.abilities,
          [abilityName]: ability,
        },
      });
    },
    [sheet, handleUpdate]
  );

  const handleSkillChange = useCallback(
    (skill: keyof SkillProficiencies, level: SkillLevel) => {
      if (!sheet) return;
      handleUpdate({
        skills: {
          ...ensureSkills(sheet.skills),
          [skill]: level,
        },
      });
    },
    [sheet, handleUpdate]
  );

  // Loading state for linked characters
  if (isLinked && isLoadingLinked) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
        <div
          className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-sm w-full mx-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-center gap-2">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-600 dark:text-gray-400">Loading character...</span>
          </div>
        </div>
      </div>
    );
  }

  // If no character sheet, show initialize button
  if (!sheet) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
        <div
          className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-sm w-full mx-4"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {charName}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {isStandalone
              ? "This character doesn't have a character sheet yet."
              : isLinked
                ? "This linked character doesn't have a character sheet yet."
                : "This token doesn't have a character sheet yet."}
          </p>
          {!readOnly && (
            <>
              <button
                onClick={() => {
                  if (isLinked && characterId) {
                    // Initialize character sheet via API for linked/standalone characters
                    const newSheet = createDefaultCharacterSheet();
                    setLinkedCharacterSheet(newSheet);
                    fetch(`/api/characters/${characterId}`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ characterSheet: newSheet }),
                    }).catch(console.error);
                  } else if (onInitialize) {
                    onInitialize();
                  }
                }}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
              >
                Create Character Sheet
              </button>
              {onLinkCharacter && !isLinked && !isStandalone && (
                <>
                  <button
                    onClick={() => setShowCharacterPicker((v) => !v)}
                    className="w-full mt-2 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 cursor-pointer"
                  >
                    {showCharacterPicker ? "Hide Library" : "Import Character"}
                  </button>
                  {showCharacterPicker && (
                    <div className="mt-2 max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded">
                      {availableCharacters.length === 0 ? (
                        <p className="p-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                          No characters in library yet
                        </p>
                      ) : (
                        availableCharacters.map((char) => (
                          <button
                            key={char.id}
                            type="button"
                            onClick={() => onLinkCharacter(char)}
                            className="w-full flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer text-left"
                          >
                            {char.imageUrl ? (
                              <img
                                src={char.imageUrl}
                                alt={char.name}
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            ) : (
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                                style={{ backgroundColor: char.color }}
                              >
                                {char.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <span className="text-sm text-gray-900 dark:text-white flex-1 truncate">
                              {char.name}
                            </span>
                            {char.characterSheet && (
                              <span className="text-xs px-1.5 py-0.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded">
                                Sheet
                              </span>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          )}
          <button
            onClick={onClose}
            className="w-full mt-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const hpPercent = getHpPercentage(sheet.hpCurrent, sheet.hpMax);
  const hpColor = getHpBarColor(hpPercent);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={handleClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-5xl w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Character Info, Combat Stats & Coins */}
        <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-3">
          {/* Upper Row: Name, Condition, Heroic Inspiration */}
          <div className="flex items-center gap-3 mb-2">
            {/* Character Avatar with HP Bar underneath */}
            <div className="flex flex-col items-center flex-shrink-0">
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: charColor }}
              >
                {charImageUrl ? (
                  <img src={charImageUrl} alt={charName} className="w-full h-full rounded-full object-cover" />
                ) : (
                  charName.charAt(0).toUpperCase()
                )}
              </div>
              {/* HP Bar under avatar */}
              <div className="w-11 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mt-1">
                <div className="h-full transition-all" style={{ width: `${hpPercent}%`, backgroundColor: hpColor }} />
              </div>
            </div>

            {/* Name */}
            <div className="flex items-center gap-1.5">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">{charName}</h2>
              {effectivelyLinked && (
                <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded">
                  Linked
                </span>
              )}
              {/* Save to Library button for tokens with sheets not linked to user's library */}
              {!readOnly && !effectivelyLinked && !isStandalone && onLinkCharacter && (
                <button
                  onClick={handleSaveToLibrary}
                  disabled={isSavingToLibrary}
                  className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-800 cursor-pointer disabled:opacity-50"
                >
                  {isSavingToLibrary ? "Saving..." : "Save to My Library"}
                </button>
              )}
              {/* Sync status indicator */}
              {isSyncing ? (
                <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" title="Syncing..." />
              ) : hasPendingChanges ? (
                <div className="w-2 h-2 bg-yellow-500 rounded-full" title="Pending sync" />
              ) : syncError ? (
                <div className="w-2 h-2 bg-red-500 rounded-full" title={syncError} />
              ) : effectivelyLinked ? (
                <div className="w-2 h-2 bg-green-500 rounded-full" title="Saved" />
              ) : null}
            </div>

            {/* Condition */}
            <div className="flex items-center gap-1.5 border-l border-gray-200 dark:border-gray-700 pl-3">
              <span className="text-xs text-gray-500 dark:text-gray-400">Condition</span>
              {readOnly ? (
                <span className={`text-xs font-medium ${(sheet.condition ?? "Healthy") === "Healthy" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                  {sheet.condition ?? "Healthy"}
                </span>
              ) : (
                <select
                  value={sheet.condition ?? "Healthy"}
                  onChange={(e) => handleUpdate({ condition: e.target.value as Condition })}
                  className={`px-1.5 py-0.5 text-xs border rounded cursor-pointer bg-white dark:bg-gray-700 ${
                    (sheet.condition ?? "Healthy") === "Healthy"
                      ? "border-green-400 dark:border-green-600 text-green-700 dark:text-green-400"
                      : "border-red-400 dark:border-red-600 text-red-700 dark:text-red-400"
                  }`}
                >
                  {CONDITIONS.map((c) => (
                    <option key={c} value={c} className="text-gray-900 dark:text-white bg-white dark:bg-gray-700">{c}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Shield */}
            <div className="flex items-center gap-1.5 border-l border-gray-200 dark:border-gray-700 pl-3">
              <span className="text-xs text-gray-500 dark:text-gray-400">Shield</span>
              {readOnly ? (
                <span className={sheet.shield ? "text-blue-500 text-lg" : "text-gray-400 text-lg"}>
                  {sheet.shield ? "🛡" : "○"}
                </span>
              ) : (
                <button onClick={() => handleUpdate({ shield: !sheet.shield })} className={`w-7 h-7 rounded-full flex items-center justify-center cursor-pointer transition-colors ${sheet.shield ? "bg-blue-500 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-400"}`} title="Shield">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2A11.954 11.954 0 0110 1.944z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
            </div>

            {/* Heroic Inspiration */}
            <div className="flex items-center gap-1.5 border-l border-gray-200 dark:border-gray-700 pl-3">
              <span className="text-xs text-gray-500 dark:text-gray-400">Heroic Inspiration</span>
              {readOnly ? (
                <span className={sheet.heroicInspiration ? "text-yellow-500 text-lg" : "text-gray-400 text-lg"}>
                  {sheet.heroicInspiration ? "★" : "☆"}
                </span>
              ) : (
                <button onClick={() => handleUpdate({ heroicInspiration: !sheet.heroicInspiration })} className={`w-7 h-7 rounded-full flex items-center justify-center cursor-pointer transition-colors ${sheet.heroicInspiration ? "bg-yellow-500 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-400"}`} title="Heroic Inspiration">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </button>
              )}
            </div>

            {/* Page Toggle Button */}
            <button
              onClick={() => setCurrentPage(currentPage === 1 ? 2 : 1)}
              className="ml-auto px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded cursor-pointer transition-colors"
            >
              {currentPage === 1 ? "What else can I do..." : "← Back to Stats"}
            </button>

            {/* Close button */}
            <button onClick={handleClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Lower Row: Stats & Details */}
          <div className="flex items-start gap-3">
            {/* Basic Info */}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Level/XP, HP, AC, Init */}
                <div className="flex items-center gap-2">
                  {/* Level/XP */}
                  <div className="flex items-center gap-0.5">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Lv</span>
                    {readOnly ? (
                      <span className="text-xs font-bold text-gray-900 dark:text-white">{sheet.level}</span>
                    ) : (
                      <NumericInput value={sheet.level} onChange={(val) => handleUpdate({ level: val })} min={1} max={20} defaultValue={1} className="w-8 px-0.5 py-0.5 text-xs font-bold text-center border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                    )}
                    {readOnly ? (
                      <span className="text-xs text-gray-400">({sheet.experience}xp)</span>
                    ) : (
                      <>
                        <span className="text-xs text-gray-400">(</span>
                        <NumericInput value={sheet.experience} onChange={(val) => handleUpdate({ experience: val })} min={0} max={999999} defaultValue={0} className="w-12 px-0.5 py-0.5 text-xs text-center border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                        <span className="text-xs text-gray-400">xp)</span>
                      </>
                    )}
                  </div>
                  {/* HP */}
                  <div className="flex items-center gap-0.5">
                    <span className="text-xs text-gray-500 dark:text-gray-400">HP</span>
                    {readOnly ? (
                      <span className="text-xs font-medium text-gray-900 dark:text-white">{sheet.hpCurrent}/{sheet.hpMax}</span>
                    ) : (
                      <>
                        <NumericInput value={sheet.hpCurrent} onChange={(val) => handleUpdate({ hpCurrent: val })} min={0} max={999} defaultValue={0} className="w-9 px-0.5 py-0.5 text-xs text-center border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                        <span className="text-gray-400 text-xs">/</span>
                        <NumericInput value={sheet.hpMax} onChange={(val) => handleUpdate({ hpMax: val })} min={1} max={999} defaultValue={1} className="w-9 px-0.5 py-0.5 text-xs text-center border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                      </>
                    )}
                  </div>
                  {/* AC */}
                  <div className="flex items-center gap-0.5">
                    <span className="text-xs text-gray-500 dark:text-gray-400">AC</span>
                    {readOnly ? (
                      <span className="text-sm font-bold text-gray-900 dark:text-white">{sheet.ac}</span>
                    ) : (
                      <NumericInput value={sheet.ac} onChange={(val) => handleUpdate({ ac: val })} min={0} max={99} defaultValue={10} className="w-10 px-1 py-0.5 text-xs font-bold text-center border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                    )}
                  </div>
                  {/* Init */}
                  <div className="flex items-center gap-0.5">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Init</span>
                    {readOnly ? (
                      <span className="text-sm font-bold text-gray-900 dark:text-white">{formatModifier(sheet.initiative)}</span>
                    ) : (
                      <NumericInput value={sheet.initiative} onChange={(val) => handleUpdate({ initiative: val })} min={-10} max={99} defaultValue={0} className="w-10 px-1 py-0.5 text-xs font-bold text-center border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1 mt-0.5">
                {readOnly ? (
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {[sheet.race, sheet.characterClass, sheet.subclass, sheet.background, { S: "Small", M: "Medium", L: "Large" }[sheet.creatureSize]].filter(Boolean).join(" / ") || "No details"}
                  </span>
                ) : (
                  <>
                    <Combobox value={sheet.race || ""} onChange={(v) => handleUpdate({ race: v || null })} suggestions={DND_RACES} placeholder="Race" className="w-16 px-1 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400" />
                    <Combobox value={sheet.characterClass || ""} onChange={(v) => handleUpdate({ characterClass: v || null })} suggestions={DND_CLASSES} placeholder="Class" className="w-16 px-1 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400" />
                    <Combobox value={sheet.subclass || ""} onChange={(v) => handleUpdate({ subclass: v || null })} suggestions={getSubclasses(sheet.characterClass)} placeholder="Subclass" className="w-20 px-1 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400" />
                    <Combobox value={sheet.background || ""} onChange={(v) => handleUpdate({ background: v || null })} suggestions={DND_BACKGROUNDS} placeholder="Background" className="w-20 px-1 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400" />
                    <select value={sheet.creatureSize} onChange={(e) => handleUpdate({ creatureSize: e.target.value as "S" | "M" | "L" })} className="px-1 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white cursor-pointer">
                      <option value="S">Small</option>
                      <option value="M">Medium</option>
                      <option value="L">Large</option>
                    </select>
                  </>
                )}
              </div>
            </div>

            {/* Combat Stats Row */}
            <div className="flex items-start gap-3 border-l border-gray-200 dark:border-gray-700 pl-2 flex-shrink-0">
              {/* Perception */}
              <div className="text-center flex-shrink-0">
                <div className="text-xs text-gray-500 dark:text-gray-400">Perception</div>
                <div className="text-sm font-bold text-gray-900 dark:text-white">{calculatePassivePerception(sheet)}</div>
              </div>
              {/* Prof - calculated from level */}
              <div className="text-center flex-shrink-0">
                <div className="text-xs text-gray-500 dark:text-gray-400">Prof</div>
                <div className="text-sm font-bold text-gray-900 dark:text-white">{formatModifier(calculateProficiencyBonus(sheet.level))}</div>
              </div>
              {/* Spd */}
              <div className="text-center flex-shrink-0">
                <div className="text-xs text-gray-500 dark:text-gray-400">Spd</div>
                {readOnly ? (
                  <div className="text-sm font-bold text-gray-900 dark:text-white">{sheet.speed}</div>
                ) : (
                  <NumericInput value={sheet.speed} onChange={(val) => handleUpdate({ speed: val })} min={0} max={999} defaultValue={30} className="w-10 text-sm font-bold text-center bg-transparent border-b border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500" />
                )}
              </div>
              {/* Hit Dice */}
              <div className="text-center flex-shrink-0">
                <div className="text-xs text-gray-500 dark:text-gray-400">Hit Dice</div>
                {readOnly ? (
                  <div className="text-sm text-gray-900 dark:text-white">{sheet.hitDice}</div>
                ) : (
                  <Combobox value={sheet.hitDice} onChange={(v) => handleUpdate({ hitDice: v })} suggestions={DND_DICE} placeholder="1d8" className="w-12 px-0.5 py-0.5 text-sm text-center border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                )}
              </div>
            </div>

            {/* Coins */}
            <div className="flex items-start gap-1 border-l border-gray-200 dark:border-gray-700 pl-2 flex-shrink-0">
              {(["cp", "sp", "ep", "gp", "pp"] as const).map((coin) => {
                const colors = { cp: "text-amber-700", sp: "text-gray-400", ep: "text-blue-400", gp: "text-yellow-500", pp: "text-gray-300" };
                const coinValue = sheet.coins?.[coin] ?? 0;
                return (
                  <div key={coin} className="text-center">
                    <div className={`text-xs font-medium uppercase ${colors[coin]}`}>{coin}</div>
                    {readOnly ? (
                      <div className="text-xs text-gray-900 dark:text-white">{coinValue}</div>
                    ) : (
                      <NumericInput
                        value={coinValue}
                        onChange={(val) => handleUpdate({ coins: { ...(sheet.coins ?? { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }), [coin]: val } })}
                        min={0}
                        max={99999}
                        defaultValue={0}
                        className="w-10 px-0.5 py-0.5 text-xs text-center border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Death Saves */}
            <div className="flex flex-col border-l border-gray-200 dark:border-gray-700 pl-2 flex-shrink-0">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Death Saves</div>
              <div className="flex items-start gap-2">
                <div className="text-center">
                  <div className="text-xs text-green-600 dark:text-green-400 mb-0.5">Success</div>
                  <div className="flex gap-0.5">
                    {[0, 1, 2].map((i) => {
                      const isChecked = sheet.deathSaves?.successes?.[i] ?? false;
                      return readOnly ? (
                        <span key={i} className={`text-sm ${isChecked ? "text-green-500" : "text-gray-300 dark:text-gray-600"}`}>
                          {isChecked ? "●" : "○"}
                        </span>
                      ) : (
                        <input
                          key={i}
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            const currentSuccesses = sheet.deathSaves?.successes ?? [false, false, false];
                            const newSuccesses: [boolean, boolean, boolean] = [...currentSuccesses] as [boolean, boolean, boolean];
                            newSuccesses[i] = !newSuccesses[i];
                            handleUpdate({
                              deathSaves: {
                                successes: newSuccesses,
                                failures: sheet.deathSaves?.failures ?? [false, false, false],
                              },
                            });
                          }}
                          className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-green-500 focus:ring-green-500 cursor-pointer"
                        />
                      );
                    })}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-red-600 dark:text-red-400 mb-0.5">Fail</div>
                  <div className="flex gap-0.5">
                    {[0, 1, 2].map((i) => {
                      const isChecked = sheet.deathSaves?.failures?.[i] ?? false;
                      return readOnly ? (
                        <span key={i} className={`text-sm ${isChecked ? "text-red-500" : "text-gray-300 dark:text-gray-600"}`}>
                          {isChecked ? "●" : "○"}
                        </span>
                      ) : (
                        <input
                          key={i}
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            const currentFailures = sheet.deathSaves?.failures ?? [false, false, false];
                            const newFailures: [boolean, boolean, boolean] = [...currentFailures] as [boolean, boolean, boolean];
                            newFailures[i] = !newFailures[i];
                            handleUpdate({
                              deathSaves: {
                                successes: sheet.deathSaves?.successes ?? [false, false, false],
                                failures: newFailures,
                              },
                            });
                          }}
                          className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-red-500 focus:ring-red-500 cursor-pointer"
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Page 1: Combat & Stats */}
        {currentPage === 1 && (
        <div className="p-4 space-y-4">
          {/* Weapons & Class Features - Side by Side */}
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Weapons & Damage */}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 flex-1">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Weapons & Damage</h3>
                {!readOnly && (
                  <button
                    onClick={() => {
                      const newWeapon: Weapon = { id: crypto.randomUUID(), name: "", bonus: 0, dice: "1d6", damageType: "", notes: "" };
                      handleUpdate({ weapons: [...(sheet.weapons || []), newWeapon] });
                    }}
                    className="text-xs px-2 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
                  >
                    + Add
                  </button>
                )}
              </div>
              {(sheet.weapons || []).length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">No weapons</p>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {(sheet.weapons || []).map((weapon, index) => (
                    <div key={weapon.id} className="flex items-center gap-1 text-xs">
                      {readOnly ? (
                        <>
                          <span className="font-medium text-gray-900 dark:text-white">{weapon.name || "Unnamed"}</span>
                          <span className="text-blue-600 dark:text-blue-400">+{weapon.bonus}</span>
                          <span className="text-gray-600 dark:text-gray-400">{weapon.dice}</span>
                          <span className="text-gray-500">{weapon.damageType}</span>
                          {weapon.notes && <span className="text-gray-400 italic">({weapon.notes})</span>}
                        </>
                      ) : (
                        <>
                          <Combobox value={weapon.name} onChange={(v) => { const u = [...(sheet.weapons || [])]; u[index] = { ...weapon, name: v }; handleUpdate({ weapons: u }); }} suggestions={DND_WEAPONS} placeholder="Name" className="w-20 px-1 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                          <span className="text-gray-400">+</span>
                          <NumericInput value={weapon.bonus} onChange={(val) => { const u = [...(sheet.weapons || [])]; u[index] = { ...weapon, bonus: val }; handleUpdate({ weapons: u }); }} min={-10} max={30} defaultValue={0} className="w-8 px-0.5 py-0.5 text-center border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                          <Combobox value={weapon.dice} onChange={(v) => { const u = [...(sheet.weapons || [])]; u[index] = { ...weapon, dice: v }; handleUpdate({ weapons: u }); }} suggestions={DND_DICE} placeholder="1d6" className="w-12 px-1 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                          <select value={weapon.damageType} onChange={(e) => { const u = [...(sheet.weapons || [])]; u[index] = { ...weapon, damageType: e.target.value as DamageType }; handleUpdate({ weapons: u }); }} className="w-24 px-1 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white cursor-pointer">
                            <option value="">Type</option>
                            {DAMAGE_TYPES.map((type) => (
                              <option key={type} value={type}>{type}</option>
                            ))}
                          </select>
                          <ExpandingTextInput value={weapon.notes} onChange={(v) => { const u = [...(sheet.weapons || [])]; u[index] = { ...weapon, notes: v }; handleUpdate({ weapons: u }); }} placeholder="Notes" baseClassName="flex-1 px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                          <button onClick={() => { const u = (sheet.weapons || []).filter((_, i) => i !== index); handleUpdate({ weapons: u }); }} className="p-0.5 text-gray-400 hover:text-red-500 cursor-pointer" title="Remove">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Class Features */}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 flex-1">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Class Features</h3>
                {!readOnly && (
                  <button
                    onClick={() => {
                      const newFeature: ClassFeature = {
                        id: crypto.randomUUID(),
                        name: "",
                        category: "action",
                        charges: null,
                        recharge: "none",
                      };
                      handleUpdate({
                        classFeatures: [...(sheet.classFeatures || []), newFeature],
                      });
                    }}
                    className="text-xs px-2 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
                  >
                    + Add
                  </button>
                )}
              </div>
              {(sheet.classFeatures || []).length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">No features</p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {(sheet.classFeatures || []).map((feature, index) => (
                    <div key={feature.id} className="flex items-center gap-1.5">
                      {readOnly ? (
                        <>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${FEATURE_CATEGORIES.find(c => c.value === feature.category)?.color || ""}`}>
                            {FEATURE_CATEGORIES.find(c => c.value === feature.category)?.label.charAt(0)}
                          </span>
                          <span className="text-sm text-gray-900 dark:text-white flex-1">{feature.name || "Unnamed"}</span>
                          {feature.charges && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {feature.charges.current}/{feature.charges.max}
                            </span>
                          )}
                          {feature.charges && feature.recharge !== "none" && (
                            <span className="text-xs text-gray-400">
                              ({({ shortRest: "SR", longRest: "LR", dawn: "Dawn", dusk: "Dusk", daily: "Daily", weekly: "Weekly", none: "" } as const)[feature.recharge]})
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <select
                            value={feature.category}
                            onChange={(e) => {
                              const updated = [...(sheet.classFeatures || [])];
                              updated[index] = { ...feature, category: e.target.value as FeatureCategory };
                              handleUpdate({ classFeatures: updated });
                            }}
                            className="w-16 px-1 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white cursor-pointer"
                            title="Action type"
                          >
                            {FEATURE_CATEGORIES.map(cat => (
                              <option key={cat.value} value={cat.value}>{cat.label.substring(0, 6)}</option>
                            ))}
                          </select>
                          <ExpandingTextInput
                            value={feature.name}
                            onChange={(v) => {
                              const updated = [...(sheet.classFeatures || [])];
                              updated[index] = { ...feature, name: v };
                              handleUpdate({ classFeatures: updated });
                            }}
                            placeholder="Feature name"
                            baseClassName="flex-1 px-1.5 py-0.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                          {/* Charges */}
                          <div className="flex items-center gap-0.5">
                            {feature.charges ? (
                              <>
                                <NumericInput
                                  value={feature.charges.current}
                                  onChange={(val) => {
                                    const updated = [...(sheet.classFeatures || [])];
                                    updated[index] = { ...feature, charges: { ...feature.charges!, current: val } };
                                    handleUpdate({ classFeatures: updated });
                                  }}
                                  min={0}
                                  max={feature.charges.max}
                                  defaultValue={0}
                                  className="w-6 text-xs text-center border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                />
                                <span className="text-xs text-gray-400">/</span>
                                <NumericInput
                                  value={feature.charges.max}
                                  onChange={(val) => {
                                    const updated = [...(sheet.classFeatures || [])];
                                    updated[index] = { ...feature, charges: { current: Math.min(feature.charges!.current, val), max: val } };
                                    handleUpdate({ classFeatures: updated });
                                  }}
                                  min={1}
                                  max={99}
                                  defaultValue={1}
                                  className="w-6 text-xs text-center border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                />
                              </>
                            ) : (
                              <button
                                onClick={() => {
                                  const updated = [...(sheet.classFeatures || [])];
                                  updated[index] = { ...feature, charges: { current: 1, max: 1 } };
                                  handleUpdate({ classFeatures: updated });
                                }}
                                className="text-xs text-blue-500 hover:text-blue-600 cursor-pointer px-1"
                                title="Add charges"
                              >
                                +Uses
                              </button>
                            )}
                          </div>
                          {/* Recharge */}
                          {feature.charges && (
                            <select
                              value={feature.recharge}
                              onChange={(e) => {
                                const updated = [...(sheet.classFeatures || [])];
                                updated[index] = { ...feature, recharge: e.target.value as RechargeCondition };
                                handleUpdate({ classFeatures: updated });
                              }}
                              className="w-14 px-0.5 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white cursor-pointer"
                              title="Recharge"
                            >
                              <option value="none">—</option>
                              <option value="shortRest">SR</option>
                              <option value="longRest">LR</option>
                              <option value="dawn">Dawn</option>
                              <option value="dusk">Dusk</option>
                              <option value="daily">Daily</option>
                              <option value="weekly">Weekly</option>
                            </select>
                          )}
                          <button
                            onClick={() => {
                              if (feature.charges) {
                                const updated = [...(sheet.classFeatures || [])];
                                updated[index] = { ...feature, charges: null, recharge: "none" };
                                handleUpdate({ classFeatures: updated });
                              } else {
                                const updated = (sheet.classFeatures || []).filter((_, i) => i !== index);
                                handleUpdate({ classFeatures: updated });
                              }
                            }}
                            className="p-0.5 text-gray-400 hover:text-red-500 cursor-pointer"
                            title={feature.charges ? "Remove uses" : "Remove feature"}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Ability Scores */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Ability Scores & Skills</h3>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 dark:text-gray-400">Aura</span>
                {/* Circle Aura */}
                <div className="flex items-center gap-1.5">
                  {readOnly ? (
                    <span className={`flex items-center ${(sheet.auraCircleEnabled ?? false) ? "text-cyan-500" : "text-gray-400"} text-xs`}>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-0.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="10" cy="10" r="7" />
                      </svg>
                      {(sheet.auraCircleEnabled ?? false) ? `${sheet.auraCircleRange ?? 0}ft` : "Off"}
                    </span>
                  ) : (
                    <>
                      <button
                        onClick={() => handleUpdate({ auraCircleEnabled: !(sheet.auraCircleEnabled ?? false) })}
                        className={`w-6 h-6 rounded-full flex items-center justify-center cursor-pointer transition-colors ${(sheet.auraCircleEnabled ?? false) ? "bg-cyan-500 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-400"}`}
                        title="Circle Aura"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="10" cy="10" r="7" />
                        </svg>
                      </button>
                      {(sheet.auraCircleEnabled ?? false) && (
                        <div className="flex items-center gap-0.5">
                          <NumericInput value={sheet.auraCircleRange ?? 0} onChange={(val) => handleUpdate({ auraCircleRange: val })} min={0} max={120} defaultValue={0} className="w-9 px-0.5 py-0.5 text-xs text-center border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                          <span className="text-xs text-gray-400">ft</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
                {/* Square Aura */}
                <div className="flex items-center gap-1.5">
                  {readOnly ? (
                    <span className={`flex items-center ${(sheet.auraSquareEnabled ?? false) ? "text-cyan-500" : "text-gray-400"} text-xs`}>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-0.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="14" height="14" />
                      </svg>
                      {(sheet.auraSquareEnabled ?? false) ? `${sheet.auraSquareRange ?? 0}ft` : "Off"}
                    </span>
                  ) : (
                    <>
                      <button
                        onClick={() => handleUpdate({ auraSquareEnabled: !(sheet.auraSquareEnabled ?? false) })}
                        className={`w-6 h-6 rounded-full flex items-center justify-center cursor-pointer transition-colors ${(sheet.auraSquareEnabled ?? false) ? "bg-cyan-500 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-400"}`}
                        title="Square Aura"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="3" width="14" height="14" />
                        </svg>
                      </button>
                      {(sheet.auraSquareEnabled ?? false) && (
                        <div className="flex items-center gap-0.5">
                          <NumericInput value={sheet.auraSquareRange ?? 0} onChange={(val) => handleUpdate({ auraSquareRange: val })} min={0} max={120} defaultValue={0} className="w-9 px-0.5 py-0.5 text-xs text-center border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                          <span className="text-xs text-gray-400">ft</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
              <AbilityScoreCard
                name="Strength"
                abilityKey="strength"
                ability={sheet.abilities.strength}
                proficiencyBonus={calculateProficiencyBonus(sheet.level)}
                skills={ensureSkills(sheet.skills)}
                onChange={(a) => handleAbilityChange("strength", a)}
                onSkillChange={handleSkillChange}
                readOnly={readOnly}
              />
              <AbilityScoreCard
                name="Dexterity"
                abilityKey="dexterity"
                ability={sheet.abilities.dexterity}
                proficiencyBonus={calculateProficiencyBonus(sheet.level)}
                skills={ensureSkills(sheet.skills)}
                onChange={(a) => handleAbilityChange("dexterity", a)}
                onSkillChange={handleSkillChange}
                readOnly={readOnly}
              />
              <AbilityScoreCard
                name="Constitution"
                abilityKey="constitution"
                ability={sheet.abilities.constitution}
                proficiencyBonus={calculateProficiencyBonus(sheet.level)}
                skills={ensureSkills(sheet.skills)}
                onChange={(a) => handleAbilityChange("constitution", a)}
                onSkillChange={handleSkillChange}
                readOnly={readOnly}
              />
              <AbilityScoreCard
                name="Intelligence"
                abilityKey="intelligence"
                ability={sheet.abilities.intelligence}
                proficiencyBonus={calculateProficiencyBonus(sheet.level)}
                skills={ensureSkills(sheet.skills)}
                onChange={(a) => handleAbilityChange("intelligence", a)}
                onSkillChange={handleSkillChange}
                readOnly={readOnly}
              />
              <AbilityScoreCard
                name="Wisdom"
                abilityKey="wisdom"
                ability={sheet.abilities.wisdom}
                proficiencyBonus={calculateProficiencyBonus(sheet.level)}
                skills={ensureSkills(sheet.skills)}
                onChange={(a) => handleAbilityChange("wisdom", a)}
                onSkillChange={handleSkillChange}
                readOnly={readOnly}
              />
              <AbilityScoreCard
                name="Charisma"
                abilityKey="charisma"
                ability={sheet.abilities.charisma}
                proficiencyBonus={calculateProficiencyBonus(sheet.level)}
                skills={ensureSkills(sheet.skills)}
                onChange={(a) => handleAbilityChange("charisma", a)}
                onSkillChange={handleSkillChange}
                readOnly={readOnly}
              />
            </div>
          </div>

          {/* Proficiencies */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Proficiencies</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Armor Proficiencies */}
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-2">Armor</label>
                <div className="flex flex-wrap gap-2">
                  {(["light", "medium", "heavy", "shields"] as const).map((armor) => {
                    const labels = { light: "Light", medium: "Medium", heavy: "Heavy", shields: "Shields" };
                    const isChecked = sheet.armorProficiencies?.[armor] ?? false;
                    return (
                      <label key={armor} className="flex items-center gap-1 cursor-pointer">
                        {readOnly ? (
                          <span className={`text-sm ${isChecked ? "text-green-600 dark:text-green-400" : "text-gray-400"}`}>
                            {isChecked ? "✓" : "○"} {labels[armor]}
                          </span>
                        ) : (
                          <>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleUpdate({
                                armorProficiencies: {
                                  ...(sheet.armorProficiencies ?? { light: false, medium: false, heavy: false, shields: false }),
                                  [armor]: !isChecked,
                                },
                              })}
                              className="w-3.5 h-3.5 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">{labels[armor]}</span>
                          </>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Weapon Proficiencies */}
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Weapons</label>
                {readOnly ? (
                  <p className="text-sm text-gray-700 dark:text-gray-300">{sheet.weaponProficiencies || "None"}</p>
                ) : (
                  <Combobox
                    value={sheet.weaponProficiencies ?? ""}
                    onChange={(v) => handleUpdate({ weaponProficiencies: v })}
                    suggestions={["Simple weapons", "Martial weapons", ...DND_WEAPONS]}
                    placeholder="Simple, Martial..."
                    delimiter=", "
                    className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                  />
                )}
              </div>

              {/* Tool Proficiencies */}
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Tools</label>
                {readOnly ? (
                  <p className="text-sm text-gray-700 dark:text-gray-300">{sheet.toolProficiencies || "None"}</p>
                ) : (
                  <Combobox
                    value={sheet.toolProficiencies ?? ""}
                    onChange={(v) => handleUpdate({ toolProficiencies: v })}
                    suggestions={DND_TOOLS}
                    placeholder="Thieves' tools..."
                    delimiter=", "
                    className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Species Traits & Feats - Side by Side */}
          <div className="flex flex-col md:flex-row gap-4">
            {/* Species Traits */}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 flex-1">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Species Traits</h3>
              {readOnly ? (
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {sheet.speciesTraits || "None"}
                </p>
              ) : (
                <Combobox
                  value={sheet.speciesTraits ?? ""}
                  onChange={(v) => handleUpdate({ speciesTraits: v })}
                  suggestions={DND_SPECIES_TRAITS}
                  placeholder="Darkvision, Fey Ancestry, Trance..."
                  delimiter=", "
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                />
              )}
            </div>

            {/* Feats */}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 flex-1">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Feats</h3>
              {readOnly ? (
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {sheet.feats || "None"}
                </p>
              ) : (
                <Combobox
                  value={sheet.feats ?? ""}
                  onChange={(v) => handleUpdate({ feats: v })}
                  suggestions={DND_FEATS}
                  placeholder="Great Weapon Master, Sentinel..."
                  delimiter=", "
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                />
              )}
            </div>
          </div>
        </div>
        )}

        {/* Page 2: Spellcasting, Backstory & More */}
        {currentPage === 2 && (
        <div className="p-4 space-y-4">
          {/* Spellcasting */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Spellcasting</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Spellcasting Ability */}
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Spellcasting Ability</label>
                {readOnly ? (
                  <p className="text-sm text-gray-700 dark:text-gray-300 capitalize">{sheet.spellcastingAbility || "None"}</p>
                ) : (
                  <select
                    value={sheet.spellcastingAbility ?? ""}
                    onChange={(e) => handleUpdate({ spellcastingAbility: e.target.value as "intelligence" | "wisdom" | "charisma" | null || null })}
                    className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white cursor-pointer"
                  >
                    <option value="">None</option>
                    <option value="intelligence">Intelligence</option>
                    <option value="wisdom">Wisdom</option>
                    <option value="charisma">Charisma</option>
                  </select>
                )}
              </div>
              {/* Spell Save DC & Attack Bonus */}
              {sheet.spellcastingAbility && (
                <div className="flex gap-4">
                  <div className="text-center">
                    <div className="text-xs text-gray-500 dark:text-gray-400">Spell Save DC</div>
                    <div className="text-lg font-bold text-gray-900 dark:text-white">
                      {8 + calculateProficiencyBonus(sheet.level) + sheet.abilities[sheet.spellcastingAbility].modifier}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500 dark:text-gray-400">Spell Attack</div>
                    <div className="text-lg font-bold text-gray-900 dark:text-white">
                      {formatModifier(calculateProficiencyBonus(sheet.level) + sheet.abilities[sheet.spellcastingAbility].modifier)}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Spell Slots - only show if spellcasting ability is set */}
            {sheet.spellcastingAbility && (
              <div className="mt-4">
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-2">Spell Slots</label>
                <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2">
                  {([1, 2, 3, 4, 5, 6, 7, 8, 9] as const).map((level) => {
                    const slotKey = `level${level}` as keyof typeof sheet.spellSlots;
                    const slot = sheet.spellSlots?.[slotKey] ?? { max: 0, used: 0 };
                    return (
                      <div key={level} className="text-center border border-gray-200 dark:border-gray-700 rounded p-1">
                        <div className="text-xs font-medium text-gray-500 dark:text-gray-400">Lv {level}</div>
                        {readOnly ? (
                          <div className="text-sm text-gray-900 dark:text-white">{slot.max - slot.used}/{slot.max}</div>
                        ) : (
                          <div className="flex items-center justify-center gap-0.5">
                            <NumericInput
                              value={slot.max - slot.used}
                              onChange={(val) => handleUpdate({
                                spellSlots: {
                                  ...(sheet.spellSlots ?? { level1: { max: 0, used: 0 }, level2: { max: 0, used: 0 }, level3: { max: 0, used: 0 }, level4: { max: 0, used: 0 }, level5: { max: 0, used: 0 }, level6: { max: 0, used: 0 }, level7: { max: 0, used: 0 }, level8: { max: 0, used: 0 }, level9: { max: 0, used: 0 } }),
                                  [slotKey]: { max: slot.max, used: slot.max - val }
                                }
                              })}
                              min={0}
                              max={slot.max}
                              defaultValue={0}
                              className="w-6 text-xs text-center border-0 bg-transparent text-gray-900 dark:text-white"
                            />
                            <span className="text-xs text-gray-400">/</span>
                            <NumericInput
                              value={slot.max}
                              onChange={(val) => handleUpdate({
                                spellSlots: {
                                  ...(sheet.spellSlots ?? { level1: { max: 0, used: 0 }, level2: { max: 0, used: 0 }, level3: { max: 0, used: 0 }, level4: { max: 0, used: 0 }, level5: { max: 0, used: 0 }, level6: { max: 0, used: 0 }, level7: { max: 0, used: 0 }, level8: { max: 0, used: 0 }, level9: { max: 0, used: 0 } }),
                                  [slotKey]: { max: val, used: Math.min(slot.used, val) }
                                }
                              })}
                              min={0}
                              max={9}
                              defaultValue={0}
                              className="w-6 text-xs text-center border-0 bg-transparent text-gray-900 dark:text-white"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Spells (Cantrips & Prepared Spells) */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Spells</h3>
              {!readOnly && (
                <button
                  onClick={() => {
                    const newSpell: Spell = {
                      id: crypto.randomUUID(),
                      level: 0,
                      name: "",
                      concentration: false,
                      range: "",
                      material: "",
                      notes: "",
                    };
                    handleUpdate({ spells: [...(sheet.spells || []), newSpell] });
                  }}
                  className="text-xs px-2 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
                >
                  + Add Spell
                </button>
              )}
            </div>
            {(sheet.spells || []).length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 italic">No spells</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-1 px-1 w-12">Lv</th>
                      <th className="text-left py-1 px-1">Name</th>
                      <th className="text-center py-1 px-1 w-12">Conc</th>
                      <th className="text-left py-1 px-1 w-20">Range</th>
                      <th className="text-left py-1 px-1 w-24">Material</th>
                      <th className="text-left py-1 px-1">Notes</th>
                      {!readOnly && <th className="w-6"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {(sheet.spells || [])
                      .slice()
                      .sort((a, b) => a.level - b.level)
                      .map((spell, index) => {
                        const originalIndex = (sheet.spells || []).findIndex(s => s.id === spell.id);
                        return (
                          <tr key={spell.id} className="border-b border-gray-100 dark:border-gray-800">
                            {readOnly ? (
                              <>
                                <td className="py-1 px-1 text-gray-600 dark:text-gray-400">{spell.level === 0 ? "C" : spell.level}</td>
                                <td className="py-1 px-1 font-medium text-gray-900 dark:text-white">
                                  <span
                                    className="block truncate cursor-pointer hover:whitespace-normal hover:overflow-visible"
                                    title={spell.name || "Unnamed"}
                                    onClick={(e) => { const el = e.currentTarget; el.classList.toggle("truncate"); el.classList.toggle("whitespace-normal"); }}
                                  >
                                    {spell.name || "Unnamed"}
                                  </span>
                                </td>
                                <td className="py-1 px-1 text-center">{spell.concentration ? <span className="text-orange-500">●</span> : <span className="text-gray-300 dark:text-gray-600">○</span>}</td>
                                <td className="py-1 px-1 text-gray-600 dark:text-gray-400">
                                  {spell.range && (
                                    <span
                                      className="block truncate cursor-pointer hover:whitespace-normal hover:overflow-visible"
                                      title={spell.range}
                                      onClick={(e) => { const el = e.currentTarget; el.classList.toggle("truncate"); el.classList.toggle("whitespace-normal"); }}
                                    >
                                      {spell.range}
                                    </span>
                                  )}
                                </td>
                                <td className="py-1 px-1 text-gray-600 dark:text-gray-400">
                                  {spell.material && (
                                    <span
                                      className="block truncate cursor-pointer hover:whitespace-normal hover:overflow-visible"
                                      title={spell.material}
                                      onClick={(e) => { const el = e.currentTarget; el.classList.toggle("truncate"); el.classList.toggle("whitespace-normal"); }}
                                    >
                                      {spell.material}
                                    </span>
                                  )}
                                </td>
                                <td className="py-1 px-1 text-gray-500 dark:text-gray-400 italic">
                                  {spell.notes && (
                                    <span
                                      className="block truncate cursor-pointer hover:whitespace-normal hover:overflow-visible"
                                      title={spell.notes}
                                      onClick={(e) => { const el = e.currentTarget; el.classList.toggle("truncate"); el.classList.toggle("whitespace-normal"); }}
                                    >
                                      {spell.notes}
                                    </span>
                                  )}
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="py-1 px-1">
                                  <select
                                    value={spell.level}
                                    onChange={(e) => {
                                      const updated = [...(sheet.spells || [])];
                                      updated[originalIndex] = { ...spell, level: parseInt(e.target.value) };
                                      handleUpdate({ spells: updated });
                                    }}
                                    className="w-10 px-0.5 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white cursor-pointer"
                                  >
                                    <option value={0}>C</option>
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(l => <option key={l} value={l}>{l}</option>)}
                                  </select>
                                </td>
                                <td className="py-1 px-1">
                                  <Combobox
                                    value={spell.name}
                                    onChange={(v) => {
                                      const updated = [...(sheet.spells || [])];
                                      updated[originalIndex] = { ...spell, name: v };
                                      handleUpdate({ spells: updated });
                                    }}
                                    suggestions={getSpellNames(spell.level)}
                                    placeholder="Spell name"
                                    className="w-full px-1 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                  />
                                </td>
                                <td className="py-1 px-1 text-center">
                                  <input
                                    type="checkbox"
                                    checked={spell.concentration}
                                    onChange={(e) => {
                                      const updated = [...(sheet.spells || [])];
                                      updated[originalIndex] = { ...spell, concentration: e.target.checked };
                                      handleUpdate({ spells: updated });
                                    }}
                                    className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-orange-500 focus:ring-orange-500 cursor-pointer"
                                  />
                                </td>
                                <td className="py-1 px-1">
                                  <Combobox
                                    value={spell.range}
                                    onChange={(v) => {
                                      const updated = [...(sheet.spells || [])];
                                      updated[originalIndex] = { ...spell, range: v };
                                      handleUpdate({ spells: updated });
                                    }}
                                    suggestions={DND_SPELL_RANGES}
                                    placeholder="Range"
                                    className="w-full px-1 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                  />
                                </td>
                                <td className="py-1 px-1">
                                  <textarea
                                    value={spell.material}
                                    onChange={(e) => {
                                      const updated = [...(sheet.spells || [])];
                                      updated[originalIndex] = { ...spell, material: e.target.value };
                                      handleUpdate({ spells: updated });
                                    }}
                                    onFocus={(e) => { e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
                                    onBlur={(e) => { e.target.style.height = ""; }}
                                    placeholder="Material"
                                    rows={1}
                                    className="w-full px-1 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none overflow-hidden"
                                  />
                                </td>
                                <td className="py-1 px-1">
                                  <textarea
                                    value={spell.notes}
                                    onChange={(e) => {
                                      const updated = [...(sheet.spells || [])];
                                      updated[originalIndex] = { ...spell, notes: e.target.value };
                                      handleUpdate({ spells: updated });
                                    }}
                                    onFocus={(e) => { e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
                                    onBlur={(e) => { e.target.style.height = ""; }}
                                    placeholder="Notes"
                                    rows={1}
                                    className="w-full px-1 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none overflow-hidden"
                                  />
                                </td>
                                <td className="py-1 px-1">
                                  <button
                                    onClick={() => {
                                      const updated = (sheet.spells || []).filter((_, i) => i !== originalIndex);
                                      handleUpdate({ spells: updated });
                                    }}
                                    className="p-0.5 text-gray-400 hover:text-red-500 cursor-pointer"
                                    title="Remove"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                  </button>
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Equipment */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Equipment</h3>
              {!readOnly && (
                <button
                  onClick={() => {
                    const newEquipment: Equipment = {
                      id: crypto.randomUUID(),
                      name: "",
                      quantity: 1,
                      equipped: false,
                      charges: null,
                      recharge: "none",
                      notes: "",
                    };
                    handleUpdate({ equipment: [...(sheet.equipment || []), newEquipment] });
                  }}
                  className="text-xs px-2 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
                >
                  + Add Item
                </button>
              )}
            </div>
            {(sheet.equipment || []).length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 italic">No equipment</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-1 px-1">Name</th>
                      <th className="text-center py-1 px-1 w-20">Qty</th>
                      <th className="text-left py-1 px-1 w-24">Recharge</th>
                      <th className="text-center py-1 px-1 w-16">Equipped</th>
                      <th className="text-left py-1 px-1">Notes</th>
                      {!readOnly && <th className="w-6"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {(sheet.equipment || []).map((item, index) => (
                      <tr key={item.id} className="border-b border-gray-100 dark:border-gray-800">
                        {readOnly ? (
                          <>
                            <td className="py-1 px-1 font-medium text-gray-900 dark:text-white">
                              <span
                                className="block truncate cursor-pointer hover:whitespace-normal hover:overflow-visible"
                                title={item.name || "Unnamed"}
                                onClick={(e) => { const el = e.currentTarget; el.classList.toggle("truncate"); el.classList.toggle("whitespace-normal"); }}
                              >
                                {item.name || "Unnamed"}
                              </span>
                            </td>
                            <td className="py-1 px-1 text-center text-gray-600 dark:text-gray-400">{item.charges ? `${item.charges.current}/${item.charges.max}` : item.quantity}</td>
                            <td className="py-1 px-1 text-gray-600 dark:text-gray-400">{item.recharge === "none" ? "—" : { shortRest: "Short Rest", longRest: "Long Rest", dawn: "Dawn", dusk: "Dusk", daily: "Daily", weekly: "Weekly" }[item.recharge]}</td>
                            <td className="py-1 px-1 text-center">{item.equipped ? <span className="text-green-500">✓</span> : <span className="text-gray-300 dark:text-gray-600">○</span>}</td>
                            <td className="py-1 px-1 text-gray-500 dark:text-gray-400 italic">
                              {item.notes && (
                                <span
                                  className="block truncate cursor-pointer hover:whitespace-normal hover:overflow-visible"
                                  title={item.notes}
                                  onClick={(e) => { const el = e.currentTarget; el.classList.toggle("truncate"); el.classList.toggle("whitespace-normal"); }}
                                >
                                  {item.notes}
                                </span>
                              )}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="py-1 px-1">
                              <Combobox
                                value={item.name}
                                onChange={(v) => {
                                  const updated = [...(sheet.equipment || [])];
                                  updated[index] = { ...item, name: v };
                                  handleUpdate({ equipment: updated });
                                }}
                                suggestions={DND_EQUIPMENT}
                                placeholder="Item name"
                                className="w-full px-1 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              />
                            </td>
                            <td className="py-1 px-1">
                              <div className="flex items-center justify-center gap-0.5">
                                <NumericInput
                                  value={item.charges?.current ?? item.quantity}
                                  onChange={(val) => {
                                    const updated = [...(sheet.equipment || [])];
                                    const max = item.charges?.max ?? item.quantity;
                                    updated[index] = { ...item, charges: { current: val, max }, quantity: val };
                                    handleUpdate({ equipment: updated });
                                  }}
                                  min={0}
                                  max={item.charges?.max ?? 999}
                                  defaultValue={1}
                                  className="w-8 text-xs text-center border-0 bg-transparent text-gray-900 dark:text-white"
                                />
                                <span className="text-xs text-gray-400">/</span>
                                <NumericInput
                                  value={item.charges?.max ?? item.quantity}
                                  onChange={(val) => {
                                    const updated = [...(sheet.equipment || [])];
                                    const current = Math.min(item.charges?.current ?? item.quantity, val);
                                    updated[index] = { ...item, charges: { current, max: val }, quantity: val };
                                    handleUpdate({ equipment: updated });
                                  }}
                                  min={1}
                                  max={999}
                                  defaultValue={1}
                                  className="w-8 text-xs text-center border-0 bg-transparent text-gray-900 dark:text-white"
                                />
                              </div>
                            </td>
                            <td className="py-1 px-1">
                              <select
                                value={item.recharge}
                                onChange={(e) => {
                                  const updated = [...(sheet.equipment || [])];
                                  updated[index] = { ...item, recharge: e.target.value as RechargeCondition };
                                  handleUpdate({ equipment: updated });
                                }}
                                className="w-full px-0.5 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white cursor-pointer"
                              >
                                <option value="none">None</option>
                                <option value="shortRest">Short Rest</option>
                                <option value="longRest">Long Rest</option>
                                <option value="dawn">Dawn</option>
                                <option value="dusk">Dusk</option>
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                              </select>
                            </td>
                            <td className="py-1 px-1 text-center">
                              <input
                                type="checkbox"
                                checked={item.equipped}
                                onChange={(e) => {
                                  const updated = [...(sheet.equipment || [])];
                                  updated[index] = { ...item, equipped: e.target.checked };
                                  handleUpdate({ equipment: updated });
                                }}
                                className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-green-500 focus:ring-green-500 cursor-pointer"
                              />
                            </td>
                            <td className="py-1 px-1">
                              <textarea
                                value={item.notes}
                                onChange={(e) => {
                                  const updated = [...(sheet.equipment || [])];
                                  updated[index] = { ...item, notes: e.target.value };
                                  handleUpdate({ equipment: updated });
                                }}
                                onFocus={(e) => { e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
                                onBlur={(e) => { e.target.style.height = ""; }}
                                placeholder="Notes"
                                rows={1}
                                className="w-full px-1 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none overflow-hidden"
                              />
                            </td>
                            <td className="py-1 px-1">
                              <button
                                onClick={() => {
                                  const updated = (sheet.equipment || []).filter((_, i) => i !== index);
                                  handleUpdate({ equipment: updated });
                                }}
                                className="p-0.5 text-gray-400 hover:text-red-500 cursor-pointer"
                                title="Remove"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                              </button>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Backstory & Personality */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Backstory & Personality</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
              {/* Alignment */}
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Alignment</label>
                {readOnly ? (
                  <p className="text-sm text-gray-700 dark:text-gray-300">{sheet.alignment || "None"}</p>
                ) : (
                  <select
                    value={sheet.alignment ?? ""}
                    onChange={(e) => handleUpdate({ alignment: e.target.value || null })}
                    className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white cursor-pointer"
                  >
                    <option value="">None</option>
                    <option value="Lawful Good">Lawful Good</option>
                    <option value="Neutral Good">Neutral Good</option>
                    <option value="Chaotic Good">Chaotic Good</option>
                    <option value="Lawful Neutral">Lawful Neutral</option>
                    <option value="True Neutral">True Neutral</option>
                    <option value="Chaotic Neutral">Chaotic Neutral</option>
                    <option value="Lawful Evil">Lawful Evil</option>
                    <option value="Neutral Evil">Neutral Evil</option>
                    <option value="Chaotic Evil">Chaotic Evil</option>
                  </select>
                )}
              </div>
              {/* Personality Traits */}
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Personality Traits</label>
                {readOnly ? (
                  <p className="text-sm text-gray-700 dark:text-gray-300">{sheet.personalityTraits || "None"}</p>
                ) : (
                  <ExpandingTextarea
                    value={sheet.personalityTraits ?? ""}
                    onChange={(v) => handleUpdate({ personalityTraits: v })}
                    placeholder="I always have a plan..."
                    collapsedRows={2}
                    baseClassName="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                  />
                )}
              </div>
              {/* Ideals */}
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Ideals</label>
                {readOnly ? (
                  <p className="text-sm text-gray-700 dark:text-gray-300">{sheet.ideals || "None"}</p>
                ) : (
                  <ExpandingTextarea
                    value={sheet.ideals ?? ""}
                    onChange={(v) => handleUpdate({ ideals: v })}
                    placeholder="Freedom, Honor..."
                    collapsedRows={2}
                    baseClassName="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                  />
                )}
              </div>
              {/* Bonds */}
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Bonds</label>
                {readOnly ? (
                  <p className="text-sm text-gray-700 dark:text-gray-300">{sheet.bonds || "None"}</p>
                ) : (
                  <ExpandingTextarea
                    value={sheet.bonds ?? ""}
                    onChange={(v) => handleUpdate({ bonds: v })}
                    placeholder="My family..."
                    collapsedRows={2}
                    baseClassName="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                  />
                )}
              </div>
              {/* Flaws */}
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Flaws</label>
                {readOnly ? (
                  <p className="text-sm text-gray-700 dark:text-gray-300">{sheet.flaws || "None"}</p>
                ) : (
                  <ExpandingTextarea
                    value={sheet.flaws ?? ""}
                    onChange={(v) => handleUpdate({ flaws: v })}
                    placeholder="I can't resist a pretty face..."
                    collapsedRows={2}
                    baseClassName="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                  />
                )}
              </div>
            </div>
            {/* Backstory */}
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Backstory</label>
              {readOnly ? (
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{sheet.backstory || "None"}</p>
              ) : (
                <ExpandingTextarea
                  value={sheet.backstory ?? ""}
                  onChange={(v) => handleUpdate({ backstory: v })}
                  placeholder="Born in a small village..."
                  collapsedRows={3}
                  baseClassName="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                />
              )}
            </div>
          </div>

          {/* Languages, Attunements, Appearance */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Languages */}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Languages</h3>
              {readOnly ? (
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{sheet.languages || "None"}</p>
              ) : (
                <Combobox
                  value={sheet.languages ?? ""}
                  onChange={(v) => handleUpdate({ languages: v })}
                  suggestions={DND_LANGUAGES}
                  placeholder="Common, Elvish, Dwarvish..."
                  delimiter=", "
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                />
              )}
            </div>

            {/* Magic Item Attunements */}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Magic Item Attunements (Max 3)</h3>
              <div className="space-y-2">
                {[0, 1, 2].map((i) => {
                  const attunement = sheet.magicItemAttunements?.[i] ?? "";
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-4">{i + 1}.</span>
                      {readOnly ? (
                        <p className="text-sm text-gray-700 dark:text-gray-300">{attunement || "Empty"}</p>
                      ) : (
                        <Combobox
                          value={attunement}
                          onChange={(v) => {
                            const newAttunements: [string, string, string] = [...(sheet.magicItemAttunements ?? ["", "", ""])] as [string, string, string];
                            newAttunements[i] = v;
                            handleUpdate({ magicItemAttunements: newAttunements });
                          }}
                          suggestions={DND_MAGIC_ITEMS}
                          placeholder="Magic item name..."
                          className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Appearance */}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Appearance</h3>
              {readOnly ? (
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{sheet.appearance || "None"}</p>
              ) : (
                <ExpandingTextarea
                  value={sheet.appearance ?? ""}
                  onChange={(v) => handleUpdate({ appearance: v })}
                  placeholder="Tall, dark hair, piercing blue eyes..."
                  collapsedRows={2}
                  baseClassName="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                />
              )}
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
