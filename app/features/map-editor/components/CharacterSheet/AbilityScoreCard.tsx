import { useState, useEffect } from "react";
import type { AbilityScore, AbilityScores, SkillProficiencies, SkillLevel } from "../../types";
import { formatModifier, updateAbilityScore, getSkillsForAbility, formatSkillName, cycleSkillLevel } from "../../utils/character-utils";

interface AbilityScoreCardProps {
  name: string;
  abilityKey: keyof AbilityScores;
  ability: AbilityScore;
  proficiencyBonus: number;
  skills: SkillProficiencies;
  onChange: (ability: AbilityScore) => void;
  onSkillChange: (skill: keyof SkillProficiencies, level: SkillLevel) => void;
  readOnly?: boolean;
}

export function AbilityScoreCard({
  name,
  abilityKey,
  ability,
  proficiencyBonus,
  skills,
  onChange,
  onSkillChange,
  readOnly = false,
}: AbilityScoreCardProps) {
  // Local state to allow empty input while typing
  const [inputValue, setInputValue] = useState(String(ability.score));

  // Sync with external changes
  useEffect(() => {
    setInputValue(String(ability.score));
  }, [ability.score]);

  const handleScoreChange = (value: string) => {
    // Allow empty or partial input while typing
    setInputValue(value);
  };

  const handleBlur = () => {
    // Validate on blur: 0-30 range (D&D 5e max), default to 0 if empty/invalid
    const parsed = parseInt(inputValue);
    const score = isNaN(parsed) ? 0 : Math.max(0, Math.min(30, parsed));
    setInputValue(String(score));
    onChange(updateAbilityScore(ability, score));
  };

  const handleProficiencyToggle = () => {
    onChange({ ...ability, savingThrowProficient: !ability.savingThrowProficient });
  };

  const savingThrowBonus = ability.modifier + (ability.savingThrowProficient ? proficiencyBonus : 0);
  const abilitySkills = getSkillsForAbility(abilityKey);

  return (
    <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3 sm:p-4 text-center min-w-[140px]">
      <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
        {name}
      </div>

      {/* Score input */}
      {readOnly ? (
        <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
          {ability.score}
        </div>
      ) : (
        <input
          type="number"
          value={inputValue}
          onChange={(e) => handleScoreChange(e.target.value)}
          onBlur={handleBlur}
          min={0}
          max={30}
          className="w-12 text-xl sm:text-2xl font-bold text-center bg-transparent border-b border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
        />
      )}

      {/* Modifier */}
      <div className="text-base sm:text-lg font-medium text-blue-600 dark:text-blue-400 mt-1">
        {formatModifier(ability.modifier)}
      </div>

      {/* Saving throw */}
      <div className="mt-2 flex items-center justify-center gap-1">
        {readOnly ? (
          <span className={`text-xs ${ability.savingThrowProficient ? "text-green-600 dark:text-green-400" : "text-gray-500 dark:text-gray-400"}`}>
            Save: {formatModifier(savingThrowBonus)}
          </span>
        ) : (
          <>
            <input
              type="checkbox"
              checked={ability.savingThrowProficient}
              onChange={handleProficiencyToggle}
              className="w-3 h-3 flex-shrink-0 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
              Save {formatModifier(savingThrowBonus)}
            </span>
          </>
        )}
      </div>

      {/* Skills */}
      {abilitySkills.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 space-y-1.5">
          {abilitySkills.map((skill) => {
            const level = skills[skill];
            const skillMod = ability.modifier + (level === "expertise" ? proficiencyBonus * 2 : level === "proficient" ? proficiencyBonus : 0);
            const colorClass = level === "expertise"
              ? "text-amber-500 dark:text-amber-400"
              : level === "proficient"
                ? "text-green-600 dark:text-green-400"
                : "text-gray-500 dark:text-gray-400";
            const indicator = level === "expertise" ? "\u25C9" : level === "proficient" ? "\u25CF" : "\u25CB";
            return (
              <div key={skill} className="flex items-center justify-between gap-2 text-sm">
                {readOnly ? (
                  <>
                    <span className={`flex items-center gap-1.5 ${colorClass}`}>
                      <span className="text-xs">{indicator}</span>
                      {formatSkillName(skill)}
                    </span>
                    <span className={colorClass}>
                      {formatModifier(skillMod)}
                    </span>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onSkillChange(skill, cycleSkillLevel(level))}
                        className={`text-sm leading-none cursor-pointer select-none ${colorClass} hover:opacity-80`}
                        title={level === "none" ? "Not proficient" : level === "proficient" ? "Proficient (click for expertise)" : "Expertise (click to remove)"}
                      >
                        {indicator}
                      </button>
                      <span className="text-gray-600 dark:text-gray-300 text-left">
                        {formatSkillName(skill)}
                      </span>
                    </div>
                    <span className={`${colorClass} ${level !== "none" ? "font-medium" : ""}`}>
                      {formatModifier(skillMod)}
                    </span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
