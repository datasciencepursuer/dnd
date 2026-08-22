import type { CharacterSheet, CharacterSheetProvenance } from "~/features/map-editor/types";

export function markManualSheetOverrides(
  provenance: CharacterSheetProvenance,
  updates: Partial<CharacterSheet>,
): CharacterSheetProvenance {
  const fields = { ...provenance.fields };
  for (const fieldName of Object.keys(updates)) {
    if (fieldName === "lastModified" || fieldName === "creationProvenance") continue;
    fields[fieldName] = {
      source: "manual-override",
      note: "Edited in the general-purpose sheet editor; the original guided derivation no longer claims this field.",
    };
  }

  return { ...provenance, fields, rulesComplete: false };
}

const RUNTIME_ONLY_FIELDS = new Set<keyof CharacterSheet>([
  "lastModified",
  "hpCurrent",
  "condition",
  "deathSaves",
  "shield",
  "heroicInspiration",
  "auraCircleEnabled",
  "auraCircleRange",
  "auraSquareEnabled",
  "auraSquareRange",
  "creationProvenance",
  "creationBuild",
]);

const SPELL_SLOT_LEVELS = [
  "level1",
  "level2",
  "level3",
  "level4",
  "level5",
  "level6",
  "level7",
  "level8",
  "level9",
] as const;

/**
 * Spending or restoring a spell slot is runtime state. Changing a slot's
 * maximum is still a rules-derived edit and must invalidate a guided recipe.
 */
function isSpellSlotUsageOnly(
  updates: Partial<CharacterSheet>,
  currentSheet: CharacterSheet | null | undefined,
): boolean {
  const nextSlots = updates.spellSlots;
  if (!nextSlots || !currentSheet?.spellSlots) return false;
  if (Object.keys(nextSlots).some((key) => !SPELL_SLOT_LEVELS.includes(key as typeof SPELL_SLOT_LEVELS[number]))) {
    return false;
  }
  return Object.entries(nextSlots).every(([level, nextSlot]) => {
    const currentSlot = currentSheet.spellSlots[level as keyof CharacterSheet["spellSlots"]];
    return Boolean(currentSlot && nextSlot && nextSlot.max === currentSlot.max);
  });
}

/** Clear the guided recipe when a manual edit changes a rules-derived field. */
export function invalidateGuidedSheet(
  sheet: CharacterSheet,
  reason = "Manual edits changed rules-derived fields; rebuild the guided choices to restore provenance.",
): CharacterSheet {
  const { creationBuild: _creationBuild, creationProvenance, ...runtimeSheet } = sheet;
  if (!creationProvenance) return runtimeSheet;
  return {
    ...runtimeSheet,
    creationProvenance: {
      ...creationProvenance,
      mode: "manual",
      rulesComplete: false,
      unresolvedChoices: [reason],
      fields: Object.fromEntries(
        Object.entries(creationProvenance.fields).map(([fieldName, field]) => [
          fieldName,
          RUNTIME_ONLY_FIELDS.has(fieldName as keyof CharacterSheet)
            ? field
            : { source: "manual-override", note: reason },
        ]),
      ),
    },
  };
}

export function hasRulesDerivedManualChanges(
  updates: Partial<CharacterSheet>,
  currentSheet?: CharacterSheet | null,
): boolean {
  return Object.keys(updates).some((field) => {
    if (field === "spellSlots") return !isSpellSlotUsageOnly(updates, currentSheet);
    return !RUNTIME_ONLY_FIELDS.has(field as keyof CharacterSheet);
  });
}
