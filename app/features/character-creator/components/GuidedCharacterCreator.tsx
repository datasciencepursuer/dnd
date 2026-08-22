import { useMemo, useState } from "react";
import { DND_2024_BASIC_CATALOG } from "../data/dnd-2024-basic/catalog";
import {
  ABILITY_NAMES,
  type AbilityName,
  type AbilityScoreMethod,
  type CatalogChoice,
  type CatalogClass,
  type CatalogEquipmentPackage,
  type CharacterCreationBuild,
  type CharacterCreationChoices,
} from "../rules/types";
import {
  createPointBuyAssignments,
  createRollingAssignments,
  createStandardArrayAssignments,
  getPointBuyTotal,
  POINT_BUY_MAX,
  POINT_BUY_MIN,
  rollAbilityScores,
  STANDARD_ARRAY,
  swapStandardArrayScore,
} from "../rules/ability-scores";
import { deriveCharacterSheet } from "../rules/derive-sheet";
import { validateCharacterBuild } from "../rules/validate-build";
import { CHARACTER_CREATOR_BUILD_VERSION, CHARACTER_CREATOR_RULESET } from "../rules/types";
import {
  getArtisanToolOrMusicalInstrumentOptions,
  getEquipmentChoiceKey,
  getEquipmentChoiceOptions,
  getMusicalInstrumentOptions,
  getProficientWeaponOptions,
} from "../rules/equipment-choices";

interface GuidedCharacterCreatorProps {
  initialName?: string;
  initialBuild?: CharacterCreationBuild | null;
  heading?: string;
  completeLabel?: string;
  onCancel: () => void;
  onComplete: (build: CharacterCreationBuild) => void | Promise<void>;
  onSaveProgress?: (build: CharacterCreationBuild) => void | Promise<void>;
  onUseManual?: () => void;
}

const ABILITY_LABELS: Record<AbilityName, string> = {
  strength: "Strength",
  dexterity: "Dexterity",
  constitution: "Constitution",
  intelligence: "Intelligence",
  wisdom: "Wisdom",
  charisma: "Charisma",
};

const SKILLS = [
  "athletics", "acrobatics", "sleight-of-hand", "stealth", "arcana", "history", "investigation", "nature", "religion",
  "animal-handling", "insight", "medicine", "perception", "survival", "deception", "intimidation", "performance", "persuasion",
];

const STEPS = ["Details", "Origin", "Scores", "Choices", "Equipment", "Review"];

function label(value: string): string {
  return value
    .replace(/^dnd-2024-basic:(?:class|background|species|feat|spell|equipment|language|invocation):/, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function initialBuild(name: string, build?: CharacterCreationBuild | null): CharacterCreationBuild {
  return build ?? {
    version: CHARACTER_CREATOR_BUILD_VERSION,
    mode: "guided",
    ruleset: CHARACTER_CREATOR_RULESET,
    level: 1,
    name,
    classId: "",
    backgroundId: "",
    speciesId: "",
    abilityScores: {
      method: "standard-array",
      assignments: createStandardArrayAssignments(),
    },
    choices: {},
  };
}

function optionsForChoice(choice: CatalogChoice, classDefinition?: CatalogClass): Array<{ id: string; label: string }> {
  if (Array.isArray(choice.options)) {
    return (choice.options as readonly (string | { id: string; label: string })[]).map((option) =>
      typeof option === "string" ? { id: option, label: label(option) } : option,
    );
  }
  if (choice.options === "all-skills" || choice.options === "selected-skills") {
    return SKILLS.map((id) => ({ id, label: label(id) }));
  }
  if (choice.options === "standard-languages") {
    return DND_2024_BASIC_CATALOG.languages
      .filter((entry) => entry.category === "standard" && !DND_2024_BASIC_CATALOG.languagePolicy.fixed.includes(entry.id))
      .map((entry) => ({ id: entry.id, label: entry.displayName }));
  }
  if (choice.options === "all-languages" || choice.options === "standard-or-rare-languages") {
    return DND_2024_BASIC_CATALOG.languages.map((entry) => ({ id: entry.id, label: entry.displayName }));
  }
  if (choice.options === "origin-feats") {
    return DND_2024_BASIC_CATALOG.feats.filter((entry) => entry.category === "origin").map((entry) => ({ id: entry.id, label: entry.displayName }));
  }
  if (choice.options === "proficient-weapons") {
    return getProficientWeaponOptions(classDefinition, DND_2024_BASIC_CATALOG).map((entry) => ({ id: entry.id, label: entry.displayName }));
  }
  if (choice.options === "musical-instruments") {
    return getMusicalInstrumentOptions(DND_2024_BASIC_CATALOG).map((entry) => ({ id: entry.id, label: entry.displayName }));
  }
  if (choice.options === "artisan-tools-or-musical-instruments") {
    return getArtisanToolOrMusicalInstrumentOptions(DND_2024_BASIC_CATALOG).map((entry) => ({ id: entry.id, label: entry.displayName }));
  }
  if (choice.options === "gaming-sets") {
    return DND_2024_BASIC_CATALOG.equipment.filter((entry) => (entry.kind === "tool" || entry.kind === "tool-choice") && /gaming set/i.test(entry.displayName)).map((entry) => ({ id: entry.id, label: entry.displayName }));
  }
  if (choice.options === "intelligence-wisdom-charisma") {
    return (["intelligence", "wisdom", "charisma"] as const).map((id) => ({ id, label: ABILITY_LABELS[id] }));
  }
  if (choice.options === "level-one-invocations") {
    return ["armor-of-shadows", "eldritch-mind", "pact-of-the-blade", "pact-of-the-chain", "pact-of-the-tome"].map((id) => ({ id: `dnd-2024-basic:invocation:${id}`, label: label(id) }));
  }
  return [];
}

function toggleValue(values: readonly string[], value: string, count: number): string[] {
  if (values.includes(value)) return values.filter((entry) => entry !== value);
  if (values.length >= count) return count === 1 ? [value] : [...values];
  return [...values, value];
}

export function GuidedCharacterCreator({
  initialName = "",
  initialBuild,
  heading = "Create your character",
  completeLabel = "Save character",
  onCancel,
  onComplete,
  onSaveProgress,
  onUseManual,
}: GuidedCharacterCreatorProps) {
  const [build, setBuild] = useState(() => initialBuild ?? initialBuildFactory(initialName));
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const validation = useMemo(() => validateCharacterBuild(build), [build]);
  const preview = useMemo(() => {
    if (!validation.valid) return null;
    return deriveCharacterSheet(validation.build, {
      generatedAt: new Date().toISOString(),
      rulesComplete: validation.rulesComplete,
      unresolvedChoices: validation.unresolvedChoices,
    });
  }, [validation]);

  const classDefinition = DND_2024_BASIC_CATALOG.classes.find((entry) => entry.id === build.classId);
  const backgroundDefinition = DND_2024_BASIC_CATALOG.backgrounds.find((entry) => entry.id === build.backgroundId);
  const speciesDefinition = DND_2024_BASIC_CATALOG.species.find((entry) => entry.id === build.speciesId);
  const choices = build.choices ?? {};

  const patchBuild = (patch: Partial<CharacterCreationBuild>) => {
    setBuild((current) => {
      if (!patch.backgroundId || patch.backgroundId === current.backgroundId) return { ...current, ...patch };
      const preset = backgroundPreset(patch.backgroundId);
      return {
        ...current,
        ...patch,
        abilityScores: { ...current.abilityScores, ...patch.abilityScores, backgroundAdjustments: preset },
        choices: { ...current.choices, ...patch.choices, backgroundAbilityIncrease: preset },
      };
    });
    setSubmissionError(null);
  };

  const patchChoices = (patch: Partial<CharacterCreationChoices>) => {
    const hasBackgroundIncrease = Object.prototype.hasOwnProperty.call(patch, "backgroundAbilityIncrease");
    setBuild((current) => ({
      ...current,
      choices: { ...(current.choices ?? {}), ...patch },
      ...(hasBackgroundIncrease && patch.backgroundAbilityIncrease !== undefined
        ? { abilityScores: { ...current.abilityScores, backgroundAdjustments: patch.backgroundAbilityIncrease } }
        : {}),
    }));
    setSubmissionError(null);
  };

  const backgroundPreset = (backgroundId: string) => {
    const background = DND_2024_BASIC_CATALOG.backgrounds.find((entry) => entry.id === backgroundId);
    if (!background) return {};
    const preferred = classDefinition?.primaryAbilities.find((ability) => background.abilityScores.includes(ability));
    const [first, second] = background.abilityScores.filter((ability) => ability !== preferred);
    const primary = preferred ?? background.abilityScores[0];
    return primary && second ? { [primary]: 2, [second]: 1 } : {};
  };

  const selectBackground = (backgroundId: string) => {
    const preset = backgroundPreset(backgroundId);
    patchBuild({
      backgroundId,
      abilityScores: { ...build.abilityScores, backgroundAdjustments: preset },
      choices: { ...choices, backgroundAbilityIncrease: preset },
    });
  };

  const setBackgroundAbilityIncrease = (ability: AbilityName, increase: number) => {
    const next = { ...(choices.backgroundAbilityIncrease ?? {}) };
    if (increase === 0) delete next[ability];
    else next[ability] = increase;
    patchBuild({
      abilityScores: { ...build.abilityScores, backgroundAdjustments: next },
      choices: { ...choices, backgroundAbilityIncrease: next },
    });
  };

  const setScoreMethod = (method: AbilityScoreMethod) => {
    const rolls = method === "rolling" ? rollAbilityScores() : undefined;
    patchBuild({
      abilityScores: {
        method,
        assignments: method === "standard-array"
          ? createStandardArrayAssignments()
          : method === "point-buy"
            ? createPointBuyAssignments()
            : createRollingAssignments(rolls),
        backgroundAdjustments: build.abilityScores.backgroundAdjustments ?? choices.backgroundAbilityIncrease,
        ...(rolls ? { rolls } : {}),
      },
    });
  };

  const reroll = () => {
    const rolls = rollAbilityScores();
    patchBuild({ abilityScores: { method: "rolling", rolls, assignments: createRollingAssignments(rolls), backgroundAdjustments: build.abilityScores.backgroundAdjustments ?? choices.backgroundAbilityIncrease } });
  };

  const setScore = (ability: AbilityName, score: number) => {
    const current = build.abilityScores;
    const assignments = current.method === "standard-array"
      ? swapStandardArrayScore(current.assignments, ability, score)
      : { ...current.assignments, [ability]: score };
    patchBuild({ abilityScores: { ...current, assignments } });
  };

  const setClassChoice = (kind: string, values: string[], count: number) => {
    const next = { ...(choices.classChoices ?? {}) };
    if (values.length === 0) delete next[kind];
    else next[kind] = count === 1 ? values[0] : values;
    patchChoices({ classChoices: next });
  };

  const setSpeciesChoice = (kind: string, values: string[], count: number) => {
    const next = { ...(choices.speciesChoices ?? {}) };
    if (values.length === 0) delete next[kind];
    else next[kind] = count === 1 ? values[0] : values;
    patchChoices({
      speciesChoices: next,
      ...(kind === "originFeat" ? { originFeatId: values[0] } : {}),
    });
  };

  const handleComplete = async () => {
    if (!validation.valid || !build.name.trim() || isSubmitting) return;
    setIsSubmitting(true);
    setSubmissionError(null);
    try {
      await onComplete(validation.build);
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : "Could not save this character.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContinue = async () => {
    if (isSubmitting) return;
    if (onSaveProgress && validation.valid && build.name.trim()) {
      setIsSubmitting(true);
      setSubmissionError(null);
      try {
        await onSaveProgress(validation.build);
      } catch (error) {
        setSubmissionError(error instanceof Error ? error.message : "Could not save this character yet.");
        setIsSubmitting(false);
        return;
      }
      setIsSubmitting(false);
    }
    setStep((current) => Math.min(STEPS.length - 1, current + 1));
  };

  const renderChoiceGroup = (
    choice: CatalogChoice,
    selectedValue: string | string[] | undefined,
    onChange: (values: string[]) => void,
    choiceClass?: CatalogClass,
  ) => {
    const selected = Array.isArray(selectedValue) ? selectedValue : selectedValue ? [selectedValue] : [];
    const options = optionsForChoice(choice, choiceClass);
    return (
      <section key={choice.id} className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">{choice.label}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{choice.explanation} · {choice.count} required</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
          {options.map((option) => {
            const checked = selected.includes(option.id);
            return (
              <label key={option.id} className={`flex items-center gap-2 rounded-lg border p-2 text-sm cursor-pointer ${checked ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30" : "border-gray-200 dark:border-gray-700"}`}>
                <input type="checkbox" checked={checked} onChange={() => onChange(toggleValue(selected, option.id, choice.count))} />
                <span className="text-gray-800 dark:text-gray-200">{option.label}</span>
              </label>
            );
          })}
        </div>
      </section>
    );
  };

  const renderEquipmentChoices = (packageDefinition: CatalogEquipmentPackage | undefined) => {
    if (!packageDefinition) return null;
    return packageDefinition.grants
      .filter((grant) => grant.type === "equipment-choice")
      .map((grant) => {
        const key = getEquipmentChoiceKey(packageDefinition.id, grant);
        const linkedToolChoices = grant.sourceText?.toLowerCase().includes("same as above")
          ? choices.backgroundTools ?? []
          : [];
        const availableOptions = getEquipmentChoiceOptions(grant, DND_2024_BASIC_CATALOG)
          .filter((entry) => linkedToolChoices.length === 0 || linkedToolChoices.includes(entry.id));
        const options = availableOptions.map((entry) => ({
          id: entry.id,
          label: entry.displayName,
        }));
        const choice: CatalogChoice = {
          id: key,
          kind: "equipment-choice",
          label: grant.displayName ?? "Equipment choice",
          count: 1,
          options,
          unique: true,
          required: true,
          explanation: linkedToolChoices.length > 0
            ? "Use the same tool selected for the related proficiency choice."
            : grant.sourceText ?? "Choose the equipment granted by this package.",
        };
        return renderChoiceGroup(choice, choices.equipmentChoices?.[key], (next) => patchChoices({
          equipmentChoices: {
            ...(choices.equipmentChoices ?? {}),
            ...(next[0] ? { [key]: next[0] } : {}),
          },
        }));
      });
  };

  const renderFeatChoice = (featId: string | undefined, bucket: "featChoices" | "originFeatChoices") => {
    const feat = DND_2024_BASIC_CATALOG.feats.find((entry) => entry.id === featId);
    if (!feat) return null;
    if (feat.displayName === "Magic Initiate") {
      const current = choices[bucket]?.magicInitiate;
      const spellList = current?.spellList ?? (backgroundDefinition?.displayName === "Acolyte" ? "cleric" : backgroundDefinition?.displayName === "Sage" ? "wizard" : "wizard");
      const spellOptions = DND_2024_BASIC_CATALOG.spells.filter((spell) => spell.classes.includes(`dnd-2024-basic:class:${spellList}`));
      const cantrips = spellOptions.filter((spell) => spell.level === 0);
      const levelOne = spellOptions.filter((spell) => spell.level === 1);
      const value = current ?? { spellList, spellcastingAbility: "intelligence" as AbilityName, cantrips: [], spell: "" };
      return (
        <section className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
          <h3 className="font-semibold text-gray-900 dark:text-white">{bucket === "featChoices" ? "Background" : "Human"} Magic Initiate</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <select value={value.spellList} onChange={(event) => patchChoices({ [bucket]: { magicInitiate: { ...value, spellList: event.target.value as "cleric" | "druid" | "wizard", cantrips: [], spell: "" } } })} className="field-select">
              <option value="cleric">Cleric list</option><option value="druid">Druid list</option><option value="wizard">Wizard list</option>
            </select>
            <select value={value.spellcastingAbility} onChange={(event) => patchChoices({ [bucket]: { magicInitiate: { ...value, spellcastingAbility: event.target.value as AbilityName } } })} className="field-select">
              <option value="intelligence">Intelligence</option><option value="wisdom">Wisdom</option><option value="charisma">Charisma</option>
            </select>
            <select value={value.spell} onChange={(event) => patchChoices({ [bucket]: { magicInitiate: { ...value, spell: event.target.value } } })} className="field-select">
              <option value="">Choose level-1 spell</option>{levelOne.map((spell) => <option key={spell.id} value={spell.id}>{spell.displayName}</option>)}
            </select>
          </div>
          {renderSpellCheckboxes("Cantrips", cantrips, value.cantrips, 2, (next) => patchChoices({ [bucket]: { magicInitiate: { ...value, cantrips: next } } }))}
        </section>
      );
    }
    if (feat.displayName === "Skilled") {
      const current = choices[bucket]?.skilled?.proficiencies ?? [];
      const toolOptions = DND_2024_BASIC_CATALOG.equipment.filter((entry) => entry.kind === "tool").slice(0, 40).map((entry) => ({ id: entry.id, label: entry.displayName }));
      const skillOptions = SKILLS.map((id) => ({ id, label: label(id) }));
      return renderChoiceGroup({ id: `${bucket}-skilled`, kind: "skilled", label: "Skilled proficiencies", count: 3, unique: true, required: true, options: [...skillOptions, ...toolOptions], explanation: "Choose three skill or tool proficiencies." }, current, (next) => patchChoices({ [bucket]: { skilled: { proficiencies: next } } }));
    }
    return null;
  };

  const renderSpellCheckboxes = (title: string, spells: readonly { id: string; displayName: string }[], selected: string[], count: number, onChange: (next: string[]) => void) => (
    <section className="space-y-2">
      <div className="flex justify-between gap-2"><h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3><span className="text-xs text-gray-500">{selected.length}/{count}</span></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto">
        {spells.map((spell) => <label key={spell.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"><input type="checkbox" checked={selected.includes(spell.id)} onChange={() => onChange(toggleValue(selected, spell.id, count))} />{spell.displayName}</label>)}
      </div>
    </section>
  );

  const renderAdditionalClassCantrip = (title: string, selectedValue: string | undefined, onChange: (value: string | undefined) => void) => (
    <section className="rounded-xl border border-blue-200 dark:border-blue-900 p-4 space-y-3">
      <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
      <p className="text-xs text-gray-500 dark:text-gray-400">Choose one additional cantrip from this class's spell list.</p>
      <select value={selectedValue ?? ""} onChange={(event) => onChange(event.target.value || undefined)} className="field-select">
        <option value="">Choose a cantrip</option>
        {classSpells.filter((spell) => spell.level === 0).map((spell) => <option key={spell.id} value={spell.id}>{spell.displayName}</option>)}
      </select>
    </section>
  );

  const renderClassFeatureSkill = (title: string, options: readonly string[], selectedValue: string | undefined, onChange: (value: string | undefined) => void) => (
    <section className="rounded-xl border border-blue-200 dark:border-blue-900 p-4 space-y-3">
      <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
      <p className="text-xs text-gray-500 dark:text-gray-400">Choose the skill that receives the class feature bonus.</p>
      <select value={selectedValue ?? ""} onChange={(event) => onChange(event.target.value || undefined)} className="field-select">
        <option value="">Choose a skill</option>
        {options.map((skill) => <option key={skill} value={skill}>{label(skill)}</option>)}
      </select>
    </section>
  );

  const renderScores = () => {
    const method = build.abilityScores.method;
    const values = method === "standard-array"
      ? [...STANDARD_ARRAY]
      : method === "point-buy"
        ? Array.from({ length: POINT_BUY_MAX - POINT_BUY_MIN + 1 }, (_, index) => POINT_BUY_MIN + index)
        : build.abilityScores.rolls?.map((roll) => roll.total) ?? [];
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          {DND_2024_BASIC_CATALOG.scoreMethods.map((scoreMethod) => <button key={scoreMethod} type="button" onClick={() => setScoreMethod(scoreMethod)} className={`px-3 py-2 rounded-lg border text-sm ${method === scoreMethod ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200"}`}>{scoreMethod === "standard-array" ? "Standard array" : scoreMethod === "point-buy" ? "Point buy" : "Roll 4d6"}</button>)}
        </div>
        {method === "point-buy" && <p className="text-sm text-gray-500">Spend exactly 27 points. Current total: {getPointBuyTotal(build.abilityScores.assignments) ?? "invalid"}.</p>}
        {method === "rolling" && <div className="flex items-center justify-between gap-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 text-sm"><span>Roll four d6 and keep the highest three for each score.</span><button type="button" onClick={reroll} className="px-3 py-1.5 rounded bg-amber-600 text-white">Roll again</button></div>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ABILITY_NAMES.map((ability) => <label key={ability} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><span className="font-medium text-gray-800 dark:text-gray-200">{ABILITY_LABELS[ability]}</span><select value={build.abilityScores.assignments[ability]} onChange={(event) => setScore(ability, Number(event.target.value))} className="field-select w-28">{values.map((value, index) => <option key={`${value}-${index}`} value={value}>{value}{method === "rolling" && build.abilityScores.rolls?.[index] ? ` (${build.abilityScores.rolls[index].dice.join("/")})` : ""}</option>)}</select></label>)}
        </div>
        {backgroundDefinition && <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3"><h3 className="font-semibold">Background ability increases</h3><p className="text-xs text-gray-500">Choose +2/+1 or +1/+1/+1 among: {backgroundDefinition.abilityScores.map((ability) => ABILITY_LABELS[ability]).join(", ")}.</p><div className="grid grid-cols-1 sm:grid-cols-3 gap-2">{backgroundDefinition.abilityScores.map((ability) => <label key={ability} className="text-sm">{ABILITY_LABELS[ability]}<select value={choices.backgroundAbilityIncrease?.[ability] ?? 0} onChange={(event) => patchChoices({ backgroundAbilityIncrease: { ...(choices.backgroundAbilityIncrease ?? {}), [ability]: Number(event.target.value) } })} className="field-select mt-1"><option value={0}>+0</option><option value={1}>+1</option><option value={2}>+2</option></select></label>)}</div></div>}
      </div>
    );
  };

  const classSkillChoice = classDefinition?.choices?.find((choice) => choice.kind === "skills");
  const classToolChoice = classDefinition?.choices?.find((choice) => choice.kind === "tools");
  const backgroundToolChoice = backgroundDefinition?.choices?.find((choice) => choice.kind === "tools");
  const classMasteryChoice = classDefinition?.choices?.find((choice) => choice.kind === "weapon-mastery");
  const classOtherChoices = classDefinition?.choices?.filter((choice) => !["skills", "tools", "weapon-mastery"].includes(choice.kind)) ?? [];
  const classSpells = classDefinition?.spellcasting ? DND_2024_BASIC_CATALOG.spells.filter((spell) => spell.classes.includes(classDefinition.id)) : [];
  const allCantrips = DND_2024_BASIC_CATALOG.spells.filter((spell) => spell.level === 0);
  const ritualSpells = DND_2024_BASIC_CATALOG.spells.filter((spell) => spell.level === 1 && spell.ritual);
  const isPactOfTheTome = classDefinition?.displayName === "Warlock" && typeof choices.classChoices?.eldritchInvocation === "string" && choices.classChoices.eldritchInvocation.endsWith(":pact-of-the-tome");
  const isPactOfTheBlade = classDefinition?.displayName === "Warlock" && choices.classChoices?.eldritchInvocation === "dnd-2024-basic:invocation:pact-of-the-blade";
  const pactBladeWeaponChoice: CatalogChoice | undefined = isPactOfTheBlade
    ? {
        id: "pact-blade-weapon",
        kind: "pactBladeWeapon",
        label: "Pact weapon",
        count: 1,
        options: DND_2024_BASIC_CATALOG.equipment
          .filter((entry) => entry.kind === "weapon" && entry.weaponCategory?.includes("Melee"))
          .map((entry) => ({ id: entry.id, label: entry.displayName })),
        unique: true,
        required: true,
        explanation: "Choose the Simple or Martial melee weapon you bond as your pact weapon.",
      }
    : undefined;
  const wizardSpellbook = choices.spells?.spellbook ?? [];
  const preparedSpellOptions = classDefinition?.displayName === "Wizard"
    ? classSpells.filter((spell) => spell.level === 1 && wizardSpellbook.includes(spell.id))
    : classSpells.filter((spell) => spell.level === 1);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-50 dark:bg-gray-950">
      <div className="min-h-screen flex flex-col">
        <header className="sticky top-0 z-10 border-b border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur px-4 sm:px-8 py-4">
          <div className="max-w-6xl mx-auto flex items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-wide text-blue-600">D&D 2024 SRD · Level 1</p><h1 className="text-2xl font-bold text-gray-900 dark:text-white">{heading}</h1><p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Build a playable character and resolve the rules choices when you are ready.</p></div><button type="button" onClick={onCancel} className="text-gray-500 hover:text-gray-900 dark:hover:text-white text-2xl" aria-label="Close character creator">×</button></div>
          <div className="max-w-6xl mx-auto grid grid-cols-6 gap-1 mt-4">{STEPS.map((name, index) => <button key={name} type="button" onClick={() => setStep(index)} className={`h-2 rounded-full ${index <= step ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"}`} aria-label={`Go to ${name}`} />)}</div>
          <div className="max-w-6xl mx-auto flex justify-between text-[11px] text-gray-500 mt-1">{STEPS.map((name) => <span key={name}>{name}</span>)}</div>
        </header>
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-8 py-6">
          {step === 0 && <section className="max-w-2xl space-y-5"><h2 className="text-xl font-semibold">Start with the character concept</h2><label className="block text-sm font-medium">Character name<input value={build.name} onChange={(event) => patchBuild({ name: event.target.value })} maxLength={100} className="field-input mt-2" placeholder="e.g. Rowan Thorn" /></label><div className="rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900 p-4 text-sm text-blue-900 dark:text-blue-100">You can save and use the character before every rules choice is resolved. The review step will show exactly what remains.</div></section>}
          {step === 1 && <div className="grid grid-cols-1 lg:grid-cols-3 gap-6"><section><h2 className="text-xl font-semibold mb-3">Class</h2><div className="space-y-2">{DND_2024_BASIC_CATALOG.classes.map((entry) => <button key={entry.id} type="button" onClick={() => patchBuild({ classId: entry.id })} className={`w-full text-left rounded-xl border p-3 ${build.classId === entry.id ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30" : "border-gray-200 dark:border-gray-700"}`}><span className="font-semibold">{entry.displayName}</span><span className="block text-xs text-gray-500 mt-1">d{entry.hitDie} · {entry.primaryAbilities.map((ability) => ABILITY_LABELS[ability]).join(" / ")}</span></button>)}</div></section><section><h2 className="text-xl font-semibold mb-3">Background</h2><div className="space-y-2">{DND_2024_BASIC_CATALOG.backgrounds.map((entry) => <button key={entry.id} type="button" onClick={() => patchBuild({ backgroundId: entry.id })} className={`w-full text-left rounded-xl border p-3 ${build.backgroundId === entry.id ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30" : "border-gray-200 dark:border-gray-700"}`}><span className="font-semibold">{entry.displayName}</span><span className="block text-xs text-gray-500 mt-1">{entry.skillProficiencies.map(label).join(", ")} · {label(entry.originFeatId)}</span></button>)}</div></section><section><h2 className="text-xl font-semibold mb-3">Species</h2><div className="space-y-2">{DND_2024_BASIC_CATALOG.species.map((entry) => <button key={entry.id} type="button" onClick={() => patchBuild({ speciesId: entry.id })} className={`w-full text-left rounded-xl border p-3 ${build.speciesId === entry.id ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30" : "border-gray-200 dark:border-gray-700"}`}><span className="font-semibold">{entry.displayName}</span><span className="block text-xs text-gray-500 mt-1">{entry.speed.walk} ft · {entry.traits.map((trait) => trait.displayName).join(", ")}</span></button>)}</div></section></div>}
          {step === 2 && renderScores()}
          {step === 3 && <div className="space-y-5"><section className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3"><h2 className="text-xl font-semibold">Languages</h2><p className="text-sm text-gray-500">Common is included. Choose two more from the Standard Languages table. Extra class languages are chosen below.</p><div className="grid grid-cols-1 sm:grid-cols-3 gap-2">{DND_2024_BASIC_CATALOG.languages.filter((entry) => entry.category === "standard" && !DND_2024_BASIC_CATALOG.languagePolicy.fixed.includes(entry.id)).map((entry) => { const selected = choices.languages?.includes(entry.id) ?? false; return <label key={entry.id} className="flex gap-2 items-center text-sm"><input type="checkbox" checked={selected} onChange={() => patchChoices({ languages: toggleValue(choices.languages ?? [...DND_2024_BASIC_CATALOG.languagePolicy.fixed], entry.id, DND_2024_BASIC_CATALOG.languagePolicy.choose + DND_2024_BASIC_CATALOG.languagePolicy.fixed.length) })} />{entry.displayName}</label>; })}</div></section>{classSkillChoice && renderChoiceGroup(classSkillChoice, choices.classSkills, (next) => patchChoices({ classSkills: next }))}{classToolChoice && renderChoiceGroup(classToolChoice, choices.classTools, (next) => patchChoices({ classTools: next }))}{backgroundToolChoice && renderChoiceGroup(backgroundToolChoice, choices.backgroundTools, (next) => patchChoices({ backgroundTools: next }))}{classMasteryChoice && renderChoiceGroup(classMasteryChoice, choices.weaponMastery, (next) => patchChoices({ weaponMastery: next }), classDefinition)}{classOtherChoices.map((choice) => renderChoiceGroup(choice, choices.classChoices?.[choice.kind], (next) => setClassChoice(choice.kind, next, choice.count), classDefinition))}{pactBladeWeaponChoice && renderChoiceGroup(pactBladeWeaponChoice, choices.pactBladeWeaponId, (next) => patchChoices({ pactBladeWeaponId: next[0] }))}{classDefinition?.displayName === "Cleric" && choices.classChoices?.divineOrder === "Thaumaturge" && renderAdditionalClassCantrip("Thaumaturge cantrip", choices.divineOrderCantrip, (value) => patchChoices({ divineOrderCantrip: value }))}{classDefinition?.displayName === "Cleric" && choices.classChoices?.divineOrder === "Thaumaturge" && renderClassFeatureSkill("Thaumaturge skill", ["arcana", "religion"], choices.divineOrderSkill, (value) => patchChoices({ divineOrderSkill: value as "arcana" | "religion" }))}{classDefinition?.displayName === "Druid" && choices.classChoices?.primalOrder === "Magician" && renderAdditionalClassCantrip("Magician cantrip", choices.primalOrderCantrip, (value) => patchChoices({ primalOrderCantrip: value }))}{classDefinition?.displayName === "Druid" && choices.classChoices?.primalOrder === "Magician" && renderClassFeatureSkill("Magician skill", ["arcana", "nature"], choices.primalOrderSkill, (value) => patchChoices({ primalOrderSkill: value as "arcana" | "nature" }))}{isPactOfTheTome && <><section className="rounded-xl border border-blue-200 dark:border-blue-900 p-4 space-y-3"><h3 className="font-semibold">Book of Shadows cantrips</h3>{renderSpellCheckboxes("Choose three cantrips", allCantrips, choices.pactTomeCantrips ?? [], 3, (next) => patchChoices({ pactTomeCantrips: next }))}</section><section className="rounded-xl border border-blue-200 dark:border-blue-900 p-4 space-y-3"><h3 className="font-semibold">Book of Shadows rituals</h3>{renderSpellCheckboxes("Choose two level-1 Ritual spells", ritualSpells, choices.pactTomeRituals ?? [], 2, (next) => patchChoices({ pactTomeRituals: next }))}</section></>}{(speciesDefinition?.choices ?? []).map((choice) => renderChoiceGroup(choice, choices.speciesChoices?.[choice.kind], (next) => setSpeciesChoice(choice.kind, next, choice.count)))}{renderFeatChoice(backgroundDefinition?.originFeatId, "featChoices")}{speciesDefinition?.displayName === "Human" && renderFeatChoice(choices.originFeatId, "originFeatChoices")}</div>}
          {step === 4 && <div className="space-y-5"><section className="rounded-xl border border-gray-200 dark:border-gray-700 p-5"><h2 className="text-xl font-semibold">Starting equipment</h2><div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">{classDefinition && <label className="text-sm">{classDefinition.displayName} package<select value={choices.classEquipmentId ?? ""} onChange={(event) => patchChoices({ classEquipmentId: event.target.value })} className="field-select mt-1"><option value="">Choose a package</option>{classDefinition.startingEquipment.packages.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</select></label>}{backgroundDefinition && <label className="text-sm">{backgroundDefinition.displayName} package<select value={choices.backgroundEquipmentId ?? ""} onChange={(event) => patchChoices({ backgroundEquipmentId: event.target.value })} className="field-select mt-1"><option value="">Choose a package</option>{backgroundDefinition.startingEquipment.packages.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</select></label>}</div><div className="space-y-5 mt-5">{renderEquipmentChoices(classDefinition?.startingEquipment.packages.find((entry) => entry.id === choices.classEquipmentId))}{renderEquipmentChoices(backgroundDefinition?.startingEquipment.packages.find((entry) => entry.id === choices.backgroundEquipmentId))}</div></section>{classDefinition?.spellcasting && <section className="rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-5"><h2 className="text-xl font-semibold">Spells</h2>{classDefinition.displayName === "Wizard" && renderSpellCheckboxes("Spellbook · choose six level-1 spells", classSpells.filter((spell) => spell.level === 1), wizardSpellbook, 6, (next) => patchChoices({ spells: { ...(choices.spells ?? { cantrips: [], prepared: [] }), spellbook: next } }))}{renderSpellCheckboxes(`Cantrips · choose ${classDefinition.spellcasting.cantrips}`, classSpells.filter((spell) => spell.level === 0), choices.spells?.cantrips ?? [], classDefinition.spellcasting.cantrips, (next) => patchChoices({ spells: { ...(choices.spells ?? { cantrips: [], prepared: [] }), cantrips: next } }))}{renderSpellCheckboxes(`Level 1 spells · choose ${classDefinition.spellcasting.preparedSpells}`, preparedSpellOptions, choices.spells?.prepared ?? [], classDefinition.spellcasting.preparedSpells, (next) => patchChoices({ spells: { ...(choices.spells ?? { cantrips: [], prepared: [] }), prepared: next } }))}</section>}</div>}
          {step === 5 && <div className="space-y-5"><section className="rounded-xl border border-gray-200 dark:border-gray-700 p-5"><h2 className="text-xl font-semibold">Review {validation.valid && validation.rulesComplete ? "· Rules complete" : "· Choices remain"}</h2><div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">{[["Class", classDefinition?.displayName], ["Background", backgroundDefinition?.displayName], ["Species", speciesDefinition?.displayName]].map(([name, value]) => <div key={name} className="rounded-lg bg-gray-50 dark:bg-gray-900 p-3"><span className="text-xs text-gray-500">{name}</span><strong className="block mt-1">{value || "Not selected"}</strong></div>)}</div>{preview && <p className="text-sm text-gray-600 dark:text-gray-300 mt-4">HP {preview.hpMax} · AC {preview.ac} · Speed {preview.speed.walk} ft · Initiative {preview.initiative >= 0 ? "+" : ""}{preview.initiative}</p>}</section>{validation.unresolvedChoices.length > 0 && <section className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-5"><h3 className="font-semibold">Still to resolve</h3><ul className="list-disc pl-5 mt-2 text-sm space-y-1">{validation.unresolvedChoices.map((entry) => <li key={entry}>{entry}</li>)}</ul></section>}{validation.errors.length > 0 && <section className="rounded-xl border border-red-300 bg-red-50 dark:bg-red-950/30 p-5"><h3 className="font-semibold">Fix before saving</h3><ul className="list-disc pl-5 mt-2 text-sm space-y-1">{validation.errors.map((entry) => <li key={`${entry.path}-${entry.code}`}>{entry.message}</li>)}</ul></section>}{submissionError && <p role="alert" className="text-sm text-red-600">{submissionError}</p>}</div>}
        </main>
        <footer className="sticky bottom-0 border-t border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 px-4 sm:px-8 py-4"><div className="max-w-6xl mx-auto flex flex-wrap justify-between gap-3"><div className="flex gap-2"><button type="button" onClick={onCancel} className="button-secondary">Close</button>{onUseManual && <button type="button" onClick={onUseManual} className="button-secondary">Use manual editor</button>}</div><div className="flex gap-2">{step > 0 && <button type="button" onClick={() => setStep((current) => current - 1)} className="button-secondary">Back</button>}{step < STEPS.length - 1 ? <button type="button" onClick={handleContinue} disabled={isSubmitting} className="button-primary disabled:opacity-50">{isSubmitting ? "Saving..." : "Continue"}</button> : <button type="button" onClick={handleComplete} disabled={!validation.valid || !build.name.trim() || isSubmitting} className="button-primary disabled:opacity-50">{isSubmitting ? "Saving..." : completeLabel}</button>}</div></div></footer>
      </div>
      <style>{`.field-input,.field-select{width:100%;border:1px solid rgb(209 213 219);border-radius:.5rem;padding:.55rem .7rem;background:white;color:rgb(17 24 39);color-scheme:light}.dark .field-input,.dark .field-select{background:rgb(31 41 55);border-color:rgb(75 85 99);color:rgb(248 250 252);color-scheme:dark}.button-primary{border-radius:.5rem;background:rgb(37 99 235);color:white;padding:.55rem 1rem;font-weight:600}.button-secondary{border-radius:.5rem;border:1px solid rgb(209 213 219);padding:.55rem 1rem;color:inherit}`}</style>
    </div>
  );
}

function initialBuildFactory(name: string): CharacterCreationBuild {
  return initialBuild(name);
}
