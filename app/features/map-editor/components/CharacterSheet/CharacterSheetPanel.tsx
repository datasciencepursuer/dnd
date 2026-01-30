import { useCallback, useState, useEffect, useRef } from "react";
import type { Token, CharacterSheet, AbilityScore, AbilityScores, SkillProficiencies, ClassFeature, FeatureCategory, Weapon, Coins, Condition } from "../../types";
import { AbilityScoreCard } from "./AbilityScoreCard";
import { formatModifier, getHpPercentage, getHpBarColor, createDefaultCharacterSheet, calculatePassivePerception, ensureSkills, calculateProficiencyBonus } from "../../utils/character-utils";

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
  collapsedRows?: number;
  expandedRows?: number;
}

function ExpandingTextInput({
  value,
  onChange,
  placeholder = "",
  baseClassName = "",
  collapsedRows = 1,
  expandedRows = 3,
}: ExpandingTextInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // When focused, calculate rows based on content length
  const contentRows = Math.ceil((value.length || 1) / 30);
  const rows = isFocused ? Math.max(expandedRows, contentRows) : collapsedRows;

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      placeholder={placeholder}
      rows={rows}
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
  expandedRows?: number;
}

function ExpandingTextarea({
  value,
  onChange,
  placeholder = "",
  baseClassName = "",
  collapsedRows = 2,
  expandedRows = 5,
}: ExpandingTextareaProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      placeholder={placeholder}
      rows={isFocused ? expandedRows : collapsedRows}
      className={`${baseClassName} transition-all duration-150 resize-none`}
    />
  );
}

interface CharacterSheetPanelProps {
  token: Token;
  onUpdate: (updates: Partial<CharacterSheet>) => void;
  onClose: () => void;
  onInitialize: () => void;
  readOnly?: boolean;
}

export function CharacterSheetPanel({
  token,
  onUpdate,
  onClose,
  onInitialize,
  readOnly = false,
}: CharacterSheetPanelProps) {
  // For linked characters, we fetch and update via API
  const [linkedCharacterSheet, setLinkedCharacterSheet] = useState<CharacterSheet | null>(null);
  const [isLoadingLinked, setIsLoadingLinked] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isLinked = !!token.characterId;

  // Fetch linked character's sheet on mount
  useEffect(() => {
    if (!token.characterId) {
      setLinkedCharacterSheet(null);
      return;
    }

    setIsLoadingLinked(true);
    fetch(`/api/characters/${token.characterId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch character");
        return res.json();
      })
      .then((data) => {
        setLinkedCharacterSheet(data.characterSheet || null);
      })
      .catch((err) => {
        console.error("Failed to fetch linked character:", err);
        setLinkedCharacterSheet(null);
      })
      .finally(() => {
        setIsLoadingLinked(false);
      });
  }, [token.characterId]);

  // Debounced save to character API for linked characters
  const saveToCharacterApi = useCallback(
    (updates: Partial<CharacterSheet>) => {
      if (!token.characterId || !linkedCharacterSheet) return;

      // Update local state immediately
      const newSheet = { ...linkedCharacterSheet, ...updates };
      if (updates.abilities) {
        newSheet.abilities = { ...linkedCharacterSheet.abilities, ...updates.abilities };
      }
      setLinkedCharacterSheet(newSheet);

      // Debounce the API call
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      setIsSaving(true);
      saveTimeoutRef.current = setTimeout(() => {
        fetch(`/api/characters/${token.characterId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ characterSheet: newSheet }),
        })
          .then((res) => {
            if (!res.ok) throw new Error("Failed to save character sheet");
          })
          .catch((err) => {
            console.error("Failed to save character sheet:", err);
          })
          .finally(() => {
            setIsSaving(false);
          });
      }, 500);
    },
    [token.characterId, linkedCharacterSheet]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Use linked character sheet if available, otherwise use token's sheet
  const sheet = isLinked ? linkedCharacterSheet : token.characterSheet;

  // Handler that routes to either local update or API update
  const handleUpdate = useCallback(
    (updates: Partial<CharacterSheet>) => {
      if (isLinked) {
        saveToCharacterApi(updates);
      } else {
        onUpdate(updates);
      }
    },
    [isLinked, saveToCharacterApi, onUpdate]
  );

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
    (skill: keyof SkillProficiencies, proficient: boolean) => {
      if (!sheet) return;
      handleUpdate({
        skills: {
          ...ensureSkills(sheet.skills),
          [skill]: proficient,
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
            {token.name}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {isLinked
              ? "This linked character doesn't have a character sheet yet."
              : "This token doesn't have a character sheet yet."}
          </p>
          {!readOnly && (
            <button
              onClick={() => {
                if (isLinked && token.characterId) {
                  // Initialize character sheet via API for linked characters
                  const newSheet = createDefaultCharacterSheet();
                  setLinkedCharacterSheet(newSheet);
                  fetch(`/api/characters/${token.characterId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ characterSheet: newSheet }),
                  }).catch(console.error);
                } else {
                  onInitialize();
                }
              }}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
            >
              Create Character Sheet
            </button>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-5xl w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Character Info, Combat Stats & Coins */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-3">
          <div className="flex items-start gap-3">
            {/* Character Avatar with HP Bar underneath */}
            <div className="flex flex-col items-center flex-shrink-0">
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: token.color }}
              >
                {token.imageUrl ? (
                  <img src={token.imageUrl} alt={token.name} className="w-full h-full rounded-full object-cover" />
                ) : (
                  token.name.charAt(0).toUpperCase()
                )}
              </div>
              {/* HP Bar under avatar */}
              <div className="w-11 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mt-1">
                <div className="h-full transition-all" style={{ width: `${hpPercent}%`, backgroundColor: hpColor }} />
              </div>
            </div>

            {/* Basic Info */}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">{token.name}</h2>
                {isLinked && (
                  <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded">
                    Linked
                  </span>
                )}
                {isSaving && (
                  <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                )}
                {/* Level/XP, HP, AC, Init beside name */}
                <div className="flex items-center gap-2 ml-1">
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
                    {[sheet.race, sheet.characterClass, sheet.subclass, sheet.background, sheet.creatureSize].filter(Boolean).join(" / ") || "No details"}
                  </span>
                ) : (
                  <>
                    <input type="text" value={sheet.race || ""} onChange={(e) => handleUpdate({ race: e.target.value || null })} placeholder="Race" className="w-16 px-1 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400" />
                    <input type="text" value={sheet.characterClass || ""} onChange={(e) => handleUpdate({ characterClass: e.target.value || null })} placeholder="Class" className="w-16 px-1 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400" />
                    <input type="text" value={sheet.subclass || ""} onChange={(e) => handleUpdate({ subclass: e.target.value || null })} placeholder="Subclass" className="w-20 px-1 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400" />
                    <input type="text" value={sheet.background || ""} onChange={(e) => handleUpdate({ background: e.target.value || null })} placeholder="Background" className="w-20 px-1 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400" />
                    <select value={sheet.creatureSize} onChange={(e) => handleUpdate({ creatureSize: e.target.value as "S" | "M" | "L" })} className="px-1 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white cursor-pointer">
                      <option value="S">S</option>
                      <option value="M">M</option>
                      <option value="L">L</option>
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
                  <input type="text" value={sheet.hitDice} onChange={(e) => handleUpdate({ hitDice: e.target.value })} placeholder="1d8" className="w-12 px-0.5 py-0.5 text-sm text-center border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                )}
              </div>
            </div>

            {/* Coins */}
            <div className="flex-1 flex items-start justify-end gap-1 border-l border-gray-200 dark:border-gray-700 pl-2">
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

            {/* Close button */}
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

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
                          <ExpandingTextInput value={weapon.name} onChange={(v) => { const u = [...(sheet.weapons || [])]; u[index] = { ...weapon, name: v }; handleUpdate({ weapons: u }); }} placeholder="Name" baseClassName="w-20 px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                          <span className="text-gray-400">+</span>
                          <NumericInput value={weapon.bonus} onChange={(val) => { const u = [...(sheet.weapons || [])]; u[index] = { ...weapon, bonus: val }; handleUpdate({ weapons: u }); }} min={-10} max={30} defaultValue={0} className="w-8 px-0.5 py-0.5 text-center border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                          <ExpandingTextInput value={weapon.dice} onChange={(v) => { const u = [...(sheet.weapons || [])]; u[index] = { ...weapon, dice: v }; handleUpdate({ weapons: u }); }} placeholder="1d6" baseClassName="w-12 px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                          <ExpandingTextInput value={weapon.damageType} onChange={(v) => { const u = [...(sheet.weapons || [])]; u[index] = { ...weapon, damageType: v }; handleUpdate({ weapons: u }); }} placeholder="Type" baseClassName="w-14 px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
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
                          <button
                            onClick={() => {
                              const updated = (sheet.classFeatures || []).filter((_, i) => i !== index);
                              handleUpdate({ classFeatures: updated });
                            }}
                            className="p-0.5 text-gray-400 hover:text-red-500 cursor-pointer"
                            title="Remove"
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
              {/* Heroic Inspiration & Condition */}
              <div className="flex items-center gap-4">
                {/* Condition */}
                <div className="flex items-center gap-1.5">
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
                {/* Heroic Inspiration */}
                <div className="flex items-center gap-1.5">
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
                  <ExpandingTextarea
                    value={sheet.weaponProficiencies ?? ""}
                    onChange={(v) => handleUpdate({ weaponProficiencies: v })}
                    placeholder="Simple, Martial..."
                    collapsedRows={2}
                    expandedRows={5}
                    baseClassName="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                  />
                )}
              </div>

              {/* Tool Proficiencies */}
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Tools</label>
                {readOnly ? (
                  <p className="text-sm text-gray-700 dark:text-gray-300">{sheet.toolProficiencies || "None"}</p>
                ) : (
                  <ExpandingTextarea
                    value={sheet.toolProficiencies ?? ""}
                    onChange={(v) => handleUpdate({ toolProficiencies: v })}
                    placeholder="Thieves' tools..."
                    collapsedRows={2}
                    expandedRows={5}
                    baseClassName="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
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
                <ExpandingTextarea
                  value={sheet.speciesTraits ?? ""}
                  onChange={(v) => handleUpdate({ speciesTraits: v })}
                  placeholder="Darkvision, Fey Ancestry, Trance..."
                  collapsedRows={4}
                  expandedRows={8}
                  baseClassName="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
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
                <ExpandingTextarea
                  value={sheet.feats ?? ""}
                  onChange={(v) => handleUpdate({ feats: v })}
                  placeholder="Great Weapon Master, Sentinel..."
                  collapsedRows={4}
                  expandedRows={8}
                  baseClassName="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
