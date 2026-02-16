import { useState, useMemo, useCallback } from "react";
import type { Token, CombatState } from "../types";
import { lookupDistance } from "../utils/distance-utils";

interface TurnPromptBuilderProps {
  tokenName: string;
  token: Token;
  combat: CombatState;
  allTokens: Token[];
  onSubmit: (prompt: string) => void;
  onContinueTurn: () => void;
  aiLoading: boolean;
}

type ActionType =
  | "attack"
  | "cast-spell"
  | "dash"
  | "disengage"
  | "dodge"
  | "help"
  | "hide"
  | "ready"
  | "use-feature"
  | "other";

type BonusActionType = "cast-spell" | "use-feature" | "other";

interface TargetOption {
  id: string;
  name: string;
  distance: number | null;
  isEnemy: boolean;
}

const ACTION_LABELS: Record<ActionType, string> = {
  attack: "Attack",
  "cast-spell": "Cast Spell",
  dash: "Dash",
  disengage: "Disengage",
  dodge: "Dodge",
  help: "Help",
  hide: "Hide",
  ready: "Ready",
  "use-feature": "Use Feature",
  other: "Other",
};

const BONUS_ACTION_LABELS: Record<BonusActionType, string> = {
  "cast-spell": "Cast Spell",
  "use-feature": "Use Feature",
  other: "Other",
};

export function TurnPromptBuilder({
  tokenName,
  token,
  combat,
  allTokens,
  onSubmit,
  onContinueTurn,
  aiLoading,
}: TurnPromptBuilderProps) {
  const sheet = token.characterSheet!;

  // Collapsible sections
  const [expandedSections, setExpandedSections] = useState({
    action: false,
    bonusAction: false,
  });
  const toggleSection = (section: "action" | "bonusAction") => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // Form state
  const [actionType, setActionType] = useState<ActionType | null>(null);
  const [weaponId, setWeaponId] = useState<string | null>(null);
  const [spellId, setSpellId] = useState<string | null>(null);
  const [spellCastLevel, setSpellCastLevel] = useState<number | null>(null);
  const [actionFeatureId, setActionFeatureId] = useState<string | null>(null);
  const [actionTargetId, setActionTargetId] = useState<string | null>(null);
  const [readyTrigger, setReadyTrigger] = useState("");
  const [otherActionDesc, setOtherActionDesc] = useState("");
  const [bonusActionType, setBonusActionType] = useState<BonusActionType | null>(null);
  const [bonusSpellId, setBonusSpellId] = useState<string | null>(null);
  const [bonusFeatureId, setBonusFeatureId] = useState<string | null>(null);
  const [bonusTargetId, setBonusTargetId] = useState<string | null>(null);
  const [otherBonusDesc, setOtherBonusDesc] = useState("");
  const [notes, setNotes] = useState("");

  // Build target list from initiative order
  const targets = useMemo((): TargetOption[] => {
    const result: TargetOption[] = [];
    const distances = combat.distances ?? [];

    for (const entry of combat.initiativeOrder) {
      if (entry.groupTokenIds && entry.groupTokenIds.length > 0) {
        for (const gid of entry.groupTokenIds) {
          if (gid === token.id) continue;
          const t = allTokens.find((tk) => tk.id === gid);
          if (!t) continue;
          const dist = lookupDistance(distances, token.id, gid);
          result.push({ id: gid, name: t.name, distance: dist, isEnemy: t.layer === "monster" });
        }
      } else {
        if (entry.tokenId === token.id) continue;
        const t = allTokens.find((tk) => tk.id === entry.tokenId);
        if (!t) continue;
        const dist = lookupDistance(distances, token.id, entry.tokenId);
        result.push({
          id: entry.tokenId,
          name: t.name,
          distance: dist,
          isEnemy: t.layer === "monster",
        });
      }
    }

    // Deduplicate
    const seen = new Set<string>();
    const deduped = result.filter((t) => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });

    // Sort: enemies first (by distance), then allies (by distance)
    return deduped.sort((a, b) => {
      if (a.isEnemy !== b.isEnemy) return a.isEnemy ? -1 : 1;
      return (a.distance ?? 999) - (b.distance ?? 999);
    });
  }, [combat.initiativeOrder, combat.distances, allTokens, token.id]);

  // Character data
  const weapons = sheet.weapons;
  const spells = sheet.spells;
  const actionFeatures = sheet.classFeatures.filter(
    (f) => f.category === "action" || f.category === "limitedUse"
  );
  const bonusActionFeatures = sheet.classFeatures.filter(
    (f) => f.category === "bonusAction"
  );

  // Spell slot helpers
  const getSlotInfo = (level: number) => {
    const key = `level${level}` as keyof typeof sheet.spellSlots;
    const slot = sheet.spellSlots[key];
    return { remaining: slot.max - slot.used, max: slot.max };
  };

  // Selected item names for prompt assembly
  const selectedWeapon = weapons.find((w) => w.id === weaponId);
  const selectedSpell = spells.find((s) => s.id === spellId);
  const selectedActionFeature = actionFeatures.find((f) => f.id === actionFeatureId);
  const selectedBonusSpell = spells.find((s) => s.id === bonusSpellId);
  const selectedBonusFeature = bonusActionFeatures.find((f) => f.id === bonusFeatureId);
  const actionTargetName = targets.find((t) => t.id === actionTargetId)?.name;
  const bonusTargetName = targets.find((t) => t.id === bonusTargetId)?.name;

  // Assemble natural language prompt
  const assembledPrompt = useMemo(() => {
    const parts: string[] = [];

    // Action
    if (actionType) {
      switch (actionType) {
        case "attack":
          if (selectedWeapon) {
            let atk = `Action: Attacks with ${selectedWeapon.name}`;
            if (actionTargetName) atk += ` targeting ${actionTargetName}`;
            parts.push(atk);
          }
          break;
        case "cast-spell":
          if (selectedSpell) {
            let sp = `Action: Casts ${selectedSpell.name}`;
            if (spellCastLevel && spellCastLevel > selectedSpell.level)
              sp += ` at level ${spellCastLevel}`;
            if (actionTargetName) sp += ` targeting ${actionTargetName}`;
            parts.push(sp);
          }
          break;
        case "use-feature":
          if (selectedActionFeature) {
            let feat = `Action: Uses ${selectedActionFeature.name}`;
            if (actionTargetName) feat += ` targeting ${actionTargetName}`;
            parts.push(feat);
          }
          break;
        case "ready":
          parts.push(`Action: Readies${readyTrigger ? ` (${readyTrigger})` : ""}`);
          break;
        case "other":
          if (otherActionDesc) parts.push(`Action: ${otherActionDesc}`);
          break;
        default:
          parts.push(`Action: ${ACTION_LABELS[actionType]}`);
          break;
      }
    }

    // Bonus Action
    if (bonusActionType) {
      switch (bonusActionType) {
        case "cast-spell":
          if (selectedBonusSpell) {
            let sp = `Bonus Action: Casts ${selectedBonusSpell.name}`;
            if (bonusTargetName) sp += ` targeting ${bonusTargetName}`;
            parts.push(sp);
          }
          break;
        case "use-feature":
          if (selectedBonusFeature) {
            let feat = `Bonus Action: Uses ${selectedBonusFeature.name}`;
            if (bonusTargetName) feat += ` targeting ${bonusTargetName}`;
            parts.push(feat);
          }
          break;
        case "other":
          if (otherBonusDesc) parts.push(`Bonus Action: ${otherBonusDesc}`);
          break;
      }
    }

    // Notes
    if (notes.trim()) {
      parts.push(`Notes: ${notes.trim()}`);
    }

    return parts.length > 0 ? `${tokenName} ${parts.join(". ")}.` : "";
  }, [
    tokenName,
    actionType,
    selectedWeapon,
    selectedSpell,
    spellCastLevel,
    actionTargetName,
    selectedActionFeature,
    readyTrigger,
    otherActionDesc,
    bonusActionType,
    selectedBonusSpell,
    selectedBonusFeature,
    bonusTargetName,
    otherBonusDesc,
    notes,
  ]);

  const canSubmit = assembledPrompt.length > 0;

  const resetForm = useCallback(() => {
    setActionType(null);
    setWeaponId(null);
    setSpellId(null);
    setSpellCastLevel(null);
    setActionFeatureId(null);
    setActionTargetId(null);
    setReadyTrigger("");
    setOtherActionDesc("");
    setBonusActionType(null);
    setBonusSpellId(null);
    setBonusFeatureId(null);
    setBonusTargetId(null);
    setOtherBonusDesc("");
    setNotes("");
    setExpandedSections({ action: false, bonusAction: false });
  }, []);

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;
    onSubmit(assembledPrompt);
    resetForm();
  }, [canSubmit, assembledPrompt, onSubmit, resetForm]);

  const formatTarget = (t: TargetOption) => {
    const dist = t.distance != null ? ` (${Math.round(t.distance)}ft)` : "";
    return `${t.name}${dist}`;
  };

  // Shared select class
  const selectCls =
    "w-full px-2 py-1 text-sm rounded border border-yellow-300 dark:border-yellow-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-white";
  const selectDisabledCls = `${selectCls} disabled:opacity-50`;
  const inputCls =
    "w-full px-2 py-1 text-sm rounded border border-yellow-300 dark:border-yellow-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-yellow-400 dark:placeholder-yellow-600";

  const renderTargetSelect = (
    value: string | null,
    onChange: (id: string | null) => void
  ) => {
    const hasEnemies = targets.some((t) => t.isEnemy);
    const hasAllies = targets.some((t) => !t.isEnemy);
    return (
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className={selectCls}
      >
        <option value="">Select target...</option>
        {hasEnemies && (
          <optgroup label="Enemies">
            {targets
              .filter((t) => t.isEnemy)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {formatTarget(t)}
                </option>
              ))}
          </optgroup>
        )}
        {hasAllies && (
          <optgroup label="Allies">
            {targets
              .filter((t) => !t.isEnemy)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {formatTarget(t)}
                </option>
              ))}
          </optgroup>
        )}
      </select>
    );
  };

  const sectionHeader = (
    label: string,
    info: string,
    section: "action" | "bonusAction"
  ) => (
    <button
      onClick={() => toggleSection(section)}
      className="w-full flex items-center justify-between px-2 py-1 text-xs font-semibold text-yellow-800 dark:text-yellow-200 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 rounded transition-colors cursor-pointer"
    >
      <span>
        {label}{" "}
        <span className="font-normal text-yellow-600 dark:text-yellow-400">({info})</span>
      </span>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 16 16"
        fill="currentColor"
        className={`w-3 h-3 transition-transform ${expandedSections[section] ? "rotate-180" : ""}`}
      >
        <path
          fillRule="evenodd"
          d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z"
          clipRule="evenodd"
        />
      </svg>
    </button>
  );

  return (
    <div className="border-t border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20 px-2 py-2 space-y-1">
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200">
          YOUR TURN
        </span>
        <span className="text-xs text-yellow-700 dark:text-yellow-300 truncate">
          {tokenName}
        </span>
      </div>

      {/* Action Section */}
      {sectionHeader("Action", actionType ? ACTION_LABELS[actionType] : "none", "action")}
      {expandedSections.action && (
        <div className="pl-2 pr-1 pb-1 space-y-1.5">
          <select
            value={actionType ?? ""}
            onChange={(e) => {
              setActionType((e.target.value || null) as ActionType | null);
              setWeaponId(null);
              setSpellId(null);
              setSpellCastLevel(null);
              setActionFeatureId(null);
              setActionTargetId(null);
              setReadyTrigger("");
              setOtherActionDesc("");
            }}
            className={selectCls}
          >
            <option value="">Select action...</option>
            {(Object.entries(ACTION_LABELS) as [ActionType, string][]).map(
              ([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              )
            )}
          </select>

          {/* Attack: weapon + target */}
          {actionType === "attack" && (
            <>
              <select
                value={weaponId ?? ""}
                onChange={(e) => setWeaponId(e.target.value || null)}
                disabled={weapons.length === 0}
                className={selectDisabledCls}
              >
                <option value="">
                  {weapons.length === 0 ? "(no weapons)" : "Select weapon..."}
                </option>
                {weapons.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} (+{w.bonus}, {w.dice} {w.damageType})
                  </option>
                ))}
              </select>
              {renderTargetSelect(actionTargetId, setActionTargetId)}
            </>
          )}

          {/* Cast Spell: spell + level + target */}
          {actionType === "cast-spell" && (
            <>
              <select
                value={spellId ?? ""}
                onChange={(e) => {
                  const id = e.target.value || null;
                  setSpellId(id);
                  if (id) {
                    const s = spells.find((sp) => sp.id === id);
                    setSpellCastLevel(s && s.level >= 1 ? s.level : null);
                  } else {
                    setSpellCastLevel(null);
                  }
                }}
                disabled={spells.length === 0}
                className={selectDisabledCls}
              >
                <option value="">
                  {spells.length === 0 ? "(no spells)" : "Select spell..."}
                </option>
                {spells.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.level === 0 ? " (cantrip)" : ` (lvl ${s.level})`}
                    {s.concentration ? " [C]" : ""}
                  </option>
                ))}
              </select>
              {/* Spell level selector for leveled spells */}
              {selectedSpell && selectedSpell.level >= 1 && (
                <select
                  value={spellCastLevel ?? selectedSpell.level}
                  onChange={(e) => setSpellCastLevel(parseInt(e.target.value))}
                  className={selectCls}
                >
                  {Array.from(
                    { length: 10 - selectedSpell.level },
                    (_, i) => selectedSpell.level + i
                  ).map((lvl) => {
                    const info = getSlotInfo(lvl);
                    return (
                      <option
                        key={lvl}
                        value={lvl}
                        disabled={info.remaining <= 0 && info.max > 0}
                      >
                        Level {lvl} ({info.remaining}/{info.max} slots)
                      </option>
                    );
                  })}
                </select>
              )}
              {renderTargetSelect(actionTargetId, setActionTargetId)}
            </>
          )}

          {/* Use Feature: feature + target */}
          {actionType === "use-feature" && (
            <>
              <select
                value={actionFeatureId ?? ""}
                onChange={(e) => setActionFeatureId(e.target.value || null)}
                disabled={actionFeatures.length === 0}
                className={selectDisabledCls}
              >
                <option value="">
                  {actionFeatures.length === 0 ? "(no features)" : "Select feature..."}
                </option>
                {actionFeatures.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                    {f.charges ? ` (${f.charges.current}/${f.charges.max})` : ""}
                  </option>
                ))}
              </select>
              {renderTargetSelect(actionTargetId, setActionTargetId)}
            </>
          )}

          {/* Help: target only */}
          {actionType === "help" && renderTargetSelect(actionTargetId, setActionTargetId)}

          {/* Ready: trigger text */}
          {actionType === "ready" && (
            <input
              type="text"
              value={readyTrigger}
              onChange={(e) => setReadyTrigger(e.target.value)}
              placeholder="Trigger condition..."
              maxLength={200}
              className={inputCls}
            />
          )}

          {/* Other: free text */}
          {actionType === "other" && (
            <input
              type="text"
              value={otherActionDesc}
              onChange={(e) => setOtherActionDesc(e.target.value)}
              placeholder="Describe action..."
              maxLength={200}
              className={inputCls}
            />
          )}
        </div>
      )}

      {/* Bonus Action Section */}
      {sectionHeader(
        "Bonus Action",
        bonusActionType ? BONUS_ACTION_LABELS[bonusActionType] : "none",
        "bonusAction"
      )}
      {expandedSections.bonusAction && (
        <div className="pl-2 pr-1 pb-1 space-y-1.5">
          <select
            value={bonusActionType ?? ""}
            onChange={(e) => {
              setBonusActionType((e.target.value || null) as BonusActionType | null);
              setBonusSpellId(null);
              setBonusFeatureId(null);
              setBonusTargetId(null);
              setOtherBonusDesc("");
            }}
            className={selectCls}
          >
            <option value="">Select bonus action...</option>
            {(Object.entries(BONUS_ACTION_LABELS) as [BonusActionType, string][]).map(
              ([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              )
            )}
          </select>

          {/* Cast Spell (bonus): spell + target */}
          {bonusActionType === "cast-spell" && (
            <>
              <select
                value={bonusSpellId ?? ""}
                onChange={(e) => setBonusSpellId(e.target.value || null)}
                disabled={spells.length === 0}
                className={selectDisabledCls}
              >
                <option value="">
                  {spells.length === 0 ? "(no spells)" : "Select spell..."}
                </option>
                {spells.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.level === 0 ? " (cantrip)" : ` (lvl ${s.level})`}
                  </option>
                ))}
              </select>
              {renderTargetSelect(bonusTargetId, setBonusTargetId)}
            </>
          )}

          {/* Use Feature (bonus): feature + target */}
          {bonusActionType === "use-feature" && (
            <>
              <select
                value={bonusFeatureId ?? ""}
                onChange={(e) => setBonusFeatureId(e.target.value || null)}
                disabled={bonusActionFeatures.length === 0}
                className={selectDisabledCls}
              >
                <option value="">
                  {bonusActionFeatures.length === 0
                    ? "(no features)"
                    : "Select feature..."}
                </option>
                {bonusActionFeatures.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                    {f.charges ? ` (${f.charges.current}/${f.charges.max})` : ""}
                  </option>
                ))}
              </select>
              {renderTargetSelect(bonusTargetId, setBonusTargetId)}
            </>
          )}

          {/* Other (bonus): free text */}
          {bonusActionType === "other" && (
            <input
              type="text"
              value={otherBonusDesc}
              onChange={(e) => setOtherBonusDesc(e.target.value)}
              placeholder="Describe bonus action..."
              maxLength={200}
              className={inputCls}
            />
          )}
        </div>
      )}

      {/* Notes */}
      <div className="px-2 pt-1">
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)..."
          maxLength={200}
          className={inputCls}
        />
      </div>

      {/* Submit row */}
      <div className="flex gap-1.5 px-2 pt-1">
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || aiLoading}
          className="flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-yellow-500 hover:bg-yellow-600 text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
        >
          Declare Turn
        </button>
        <button
          onClick={onContinueTurn}
          disabled={aiLoading}
          className="flex-shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors flex items-center gap-1"
          title="Continue turn — send your rolls to AI"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            fill="currentColor"
            className="w-3 h-3"
          >
            <path d="M3 3.732a1.5 1.5 0 012.305-1.265l6.706 4.267a1.5 1.5 0 010 2.531l-6.706 4.268A1.5 1.5 0 013 12.267V3.732z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
