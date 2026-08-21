---
id: PRD-0001
title: Guided D&D Character Creator
status: Draft — approval required before implementation
owner: Product / Engineering
created: 2026-08-21
updated: 2026-08-21
proposedRuleset: D&D 2024 is canonical; 2014 content is deprecated legacy data only
---

# Guided D&D Character Creator

## 1. Executive summary

The product currently has a flexible character-sheet editor, but it does not have a guided character-creation flow. Users can create a library character, create a map token, import a library character, or select a monster template. Those paths currently converge on a permissive `CharacterSheet` object and allow users to enter values directly, without enforcing the relationships between class, background, species, ability scores, proficiencies, feats, spells, equipment, and level.

This PRD proposes a ruleset-aware character creator that:

- guides users through valid choices and explains why choices are available or unavailable;
- calculates derived values deterministically from the selected rules and inputs;
- persists the selected rule definitions and choices as provenance, rather than only storing display strings;
- compiles into the existing runtime `CharacterSheet` format so the map, library, and combat UI can continue to consume a sheet;
- keeps player-character rules separate from the monster knowledge base;
- validates on both client and server; and
- keeps the rules catalog in Git-backed application data, not Redis.

Recommended initial scope: a level-1 player-character flow based on the canonical D&D 2024 Basic Rules, for the 12 Basic Rules classes. The flow should be available from the character library and from character-layer map tokens. Monster templates, importing an existing character, and duplicating a token should not unexpectedly launch this flow.

Product direction recorded in this revision: D&D 2024 is the canonical ruleset for all new character creation. The active character and monster catalogs are now refreshed to the 2024 SRD 5.2.1 scope; historical documentation and persisted sheets may still reference 2014 values for compatibility, but those values are not new choices or an equally supported ruleset.

This document is an analysis and decision record. It is not authorization to implement the feature yet.

## 2. Repository findings

### 2.1 Current entry points

| Entry point | Current behavior | Character-creator recommendation |
| --- | --- | --- |
| `/characters` → `+ New Character` | Creates a name/color/size/image shell. The sheet is created later from `CharacterSheetPanel`. | **Yes. Primary entry point.** Replace or extend the shell modal with the guided creator, or create a resumable draft. |
| Existing library character → `Create Sheet` | Opens an empty/default sheet. | **Yes, when the character has no sheet.** Open the creator in resume mode. |
| Map → custom unit → character layer | Creates a token with `characterSheet: null`. | **Yes, but with an explicit choice between “Guided Player Character” and “Quick/Manual Token.”** Map users may need NPCs or temporary tokens that should not require the full player flow. |
| Map → custom unit → object/other layer | Creates a non-character token. | **No.** Keep the existing token editor. |
| Map → Monster Templates / monster compendium | Imports a monster stat block into a token. | **No.** This is a separate monster-template path, not player-character creation. |
| Map → Import Character | Links an existing library character to a token. | **No.** Reuse the existing character and show a summary of its rule metadata. |
| Token duplication / monster duplication | Copies the current sheet and preserves clone semantics. | **No.** Do not rerun creation rules on a duplicate. A future “rebuild as new character” action can be separate. |
| Token → Save to Library | Saves the current token sheet as a new library character. | **No new wizard by default.** Preserve the current sheet, validate what can be validated, and mark incomplete/manual data explicitly. |
| Editing an existing populated sheet | Opens the general-purpose sheet editor. | **No automatic rerun.** Keep manual editing. A later “rebuild choices” workflow can be added after the rules model is stable. |

The important product decision is not whether every path can technically reach the creator. It is whether the user is creating a new player character or merely creating/linking a combat token. The UI should make that distinction visible.

### 2.2 Current data and persistence

- `CharacterSheet` is a large JSON-compatible runtime object containing both identity and derived/combat state. Class, subclass, background, race, feats, traits, weapons, equipment, and proficiencies are mostly strings or lightly structured values.
- `createDefaultCharacterSheet()` creates a blank level-1 sheet, but it does not derive values from a class, background, or species.
- `AbilityScoreCard` accepts arbitrary manual scores from 0–30. It does not enforce standard array, point buy, rolling, ability assignment, or background adjustment rules.
- `CharacterSheetPanel` supports both standalone library characters and map tokens. It also supports importing/linking a library character and saving a token back to the library.
- Library characters persist the sheet in a JSONB `characterSheet` column. The character API currently accepts an arbitrary sheet payload; it does not perform ruleset-aware validation.
- Map tokens can contain an inline sheet or a `characterId` pointing to a library character. A linked token fetches the library sheet, while an unlinked token owns its inline sheet.
- `character-options.ts` is now a generated 2024 SRD 5.2.1 UI catalog with structured source metadata, but it is still not a rules engine. It retains string-compatible exports for the existing sheet editor; feats and traits remain display-oriented, and class/spell prerequisites are not yet enforced.
- `srd-monsters.json` and `SrdMonster` describe monster templates and stat blocks. They should not become the input model for player-character creation.
- Redis is currently an optional Upstash client used by the AI rate limiter. There are no catalog cache helpers, versioned catalog keys, or invalidation rules. It should not be the authoritative store for character rules.

Relevant implementation locations:

- [characters route](../../../app/routes/characters.tsx)
- [map token creation and monster-template UI](../../../app/features/map-editor/components/Sidebar/TokenPanel.tsx)
- [shared sheet editor](../../../app/features/map-editor/components/CharacterSheet/CharacterSheetPanel.tsx)
- [map integration](../../../app/features/map-editor/components/MapEditor.tsx)
- [character sheet types](../../../app/features/map-editor/types.ts)
- [current option lists](../../../app/features/map-editor/data/character-options.ts)
- [character creation API](../../../app/routes/api.characters.tsx)
- [character update API](../../../app/routes/api.characters.$characterId.tsx)
- [character database schema](../../../app/.server/db/schema.ts)
- [Redis client](../../../app/.server/redis.ts)

## 3. Problem statement

The current editor makes it possible to create a sheet that looks complete but is not necessarily a legal or reproducible character. For example:

- a class can be selected without applying its proficiencies, hit die, spellcasting rules, starting features, or level gates;
- a background can be selected without applying its ability-score choices, origin feat, skills, tool, or equipment;
- a species can be selected without applying its size, speed, languages, or trait choices;
- a feat or species trait can require nested choices, but the current data is primarily prose in a string list;
- ability scores and saving throws can be edited directly, independent of the chosen creation method;
- spells are name/level suggestions rather than a class-aware legal selection;
- 2014 and 2024 options can appear in the same arrays without a source or edition boundary; and
- the same JSON shape is used for player characters, manually authored NPCs, and monsters.

The result is high cognitive load for new users, inconsistent derived values, and no safe way to expand the rules without adding conditionals directly to UI components.

## 4. Goals

1. Let a user create a valid level-1 player character through a sequence of understandable decisions.
2. Model class, background, species, feats, spells, equipment, and their choices as structured, versioned content.
3. Calculate derived sheet values from the selections rather than asking the user to enter every result manually.
4. Explain prerequisites, conflicts, and remaining choices in the UI.
5. Validate the same build on the server before persistence.
6. Preserve existing manually edited sheets and monster-token workflows.
7. Make the ruleset and source of every generated value identifiable.
8. Keep static rule data maintainable in Git and deployable as application content without requiring a runtime data service.

## 5. Non-goals for the first implementation

- Replacing the general-purpose sheet editor.
- Building a full campaign management or encounter-building system.
- Treating a monster template as a player character.
- Supporting every third-party or homebrew option in the first release.
- Making Redis the source of truth for rule definitions.
- Automatically converting every existing 2014/manual sheet into a 2024 rules-compliant sheet.
- Offering new 2014 character creation or maintaining a parallel 2014 rules catalog.
- Supporting multiclassing in the first level-1 flow.
- Implementing every high-level feature before the underlying content and validation model are proven.

## 6. Ruleset and content policy

The repository now labels its active option file as a generated D&D 2024 SRD 5.2.1 catalog. The guided creator still needs a rules engine and per-definition prerequisites; those are separate from the static catalog refresh.

### Recommendation

Use a separately identified `dnd-2024-basic` ruleset and the source-verified 2024 SRD 5.2.1 catalog now checked into the repository. Do not maintain a parallel active `dnd-2014` adapter/catalog. Existing 2014 or provenance-free sheets should be treated as legacy/manual data, remain readable and editable, and never be silently recalculated. Any future 2014-to-2024 conversion must be an explicit, user-approved migration.

The full Handbook can remain the human reference for requirements analysis, but the application should only distribute rule text and structured content that the project is permitted to use. The first catalog should therefore be limited to the selected Basic Rules/SRD/licensed scope. A content-source and licensing decision is a product gate, not an implementation detail.

Each definition should carry at least:

```ts
type RulesetId = "dnd-2024-basic" | "dnd-2014-legacy" | string;

interface RuleDefinitionMetadata {
  id: string;
  ruleset: RulesetId;
  sourceBook: string;
  sourceVersion: string;
  displayName: string;
}
```

The exact type can evolve, but a stable ID, ruleset, source, and version are required for reproducibility and future migrations.

## 7. Proposed user flow

The official 2024 character-creation guidance establishes class, origin (background, species, and languages), ability scores, and character details as connected parts of creation. The UI can present these in a more helpful order as long as dependencies and validation remain explicit.

### Proposed level-1 flow

1. **Choose creation mode and ruleset**
   - Player Character / Guided Creation
   - Quick or Manual Token, where applicable
   - Ruleset and content scope, initially fixed to the enabled 2024 catalog rather than asking casual users to understand source-book configuration.
2. **Choose level**
   - MVP recommendation: level 1 only.
   - If higher levels are enabled later, the flow must show every prior level’s choices and level-gated features.
3. **Choose class**
   - Explain primary ability, hit die, saving throws, skills, armor, weapons, tools, spellcasting, and level-1 features.
   - Do not show a subclass choice at level 1 unless the selected ruleset/source explicitly grants one at that level.
4. **Choose background**
   - Apply the background’s skill proficiencies, tool, origin feat, ability-score choices, and equipment options.
5. **Choose species**
   - Apply creature type, size, speed, languages, traits, and any species-specific choices.
6. **Choose languages**
   - Enforce the languages granted by the selected ruleset and prevent duplicate selections where the rules disallow them.
7. **Generate and assign ability scores**
   - Offer only the score-generation methods enabled by the campaign/product decision: standard array, point buy, and/or rolling.
   - Apply background adjustments and enforce the ruleset’s cap and assignment constraints.
8. **Resolve class choices**
   - Examples include class skill choices, tool/weapon choices, fighting style or equivalent class choice, class-specific orders, and class-specific starting features.
9. **Resolve spells and feat choices**
   - For a spellcasting class, choose the permitted cantrips/spells using class and level metadata.
   - For an origin feat with a choice, collect the nested spell, ability, or proficiency choices.
10. **Choose starting equipment**
    - Support equipment packages first; support gold/equipment alternatives only if the selected ruleset scope includes them.
11. **Enter character details**
    - Name, portrait, appearance, personality, alignment, backstory, and other narrative fields.
12. **Review and save**
    - Show a source-aware summary of selections, derived values, unresolved choices, and warnings.
    - Save only when required decisions are valid, or explicitly save as a draft if draft persistence is approved.

The order should be treated as a dependency graph rather than a hard-coded list of UI pages. A background can expose a feat; the feat can expose a spell choice; the spell choice can depend on a class list; the final sheet can depend on all of them.

## 8. Rules walkthrough and requirements

### 8.1 Class model

Every class definition needs structured data for:

| Area | Required data |
| --- | --- |
| Identity | Stable ID, display name, ruleset/source, description, primary ability or abilities, and class tags. |
| Core proficiencies | Saving throws, skills with allowed choices, armor training, weapon proficiencies, tools, and other granted proficiencies. |
| Hit points | Hit die, level-1 HP rule, and level-up rule for future higher-level support. |
| Progression | Level table, proficiency-bonus interaction, features, feats/ability-score improvements, subclass gates, and resource progression. |
| Choices | A typed choice definition with an ID, allowed values, prerequisites, number of selections, replacement/conflict behavior, and level/source gate. |
| Spellcasting | Spellcasting ability, cantrips, prepared/known rules, spell list, spell slots, rituals, focus/material rules as applicable, and class-specific exceptions. |
| Starting equipment | Package choices, gold alternatives, granted equipment, and conflict/replacement rules. |
| Feature effects | Structured grants and derived effects. A feature should not be represented only as display prose if it changes validation or calculations. |

The 2024 Basic Rules class roster is 12 classes. The current local list also contains Artificer; Artificer must therefore be excluded from the first canonical catalog unless a separately verified 2024 source is approved.

The creator must support a data-driven choice point for each class, even where the level-1 choice is simple. The following is a requirements checklist, not a replacement for source verification:

| Class | Creation-specific requirements to model | Later or conditional requirements |
| --- | --- | --- |
| Barbarian | Hit die, primal class features, weapon mastery choices, saving throws, skill choices, armor/weapon grants. | Rage/resource progression and subclass features. |
| Bard | Skill/tool choices, spellcasting, bardic resource, weapon/armor grants. | Expertise, spell progression, subclass features, and any additional skill/resource choices. |
| Cleric | Spellcasting, saving throws, class proficiencies, and the class-specific level-1 order choice. | Divine resource progression and subclass features. |
| Druid | Spellcasting, saving throws, class proficiencies, and the class-specific early choice. | Wild Shape/other resource progression and subclass features. |
| Fighter | Fighting-style or equivalent choice, weapon mastery choices, second-wind/resource features, saving throws, skill choices, armor/weapons. | Action/resource progression and subclass features. |
| Monk | Unarmored/monk core rules, saving throws, skill choices, weapon choices, and focus/resource setup. | Focus progression and subclass features. |
| Paladin | Core proficiencies, weapon/armor grants, level-1 features, and spellcasting setup where applicable. | Smite/resource progression and subclass features. |
| Ranger | Core enemy/exploration choices, weapon mastery, skill choices, spellcasting setup where applicable, armor/weapons. | Hunter/resource progression and subclass features. |
| Rogue | Expertise choices, sneak-attack prerequisites, weapon choices, saving throws, skill choices, and tool grants. | Cunning-action progression and subclass features. |
| Sorcerer | Spellcasting ability, cantrips/spells, saving throws, and innate class-resource setup. | Sorcery/resource progression and subclass features. |
| Warlock | Pact-magic setup, spell choices, invocation choices where granted, saving throws, skills, and patron/source gate. | Invocation progression and subclass/patron features. |
| Wizard | Spellbook/spellcasting setup, cantrips/spells, saving throws, skills, and starting spell/equipment choices. | Spellbook/resource progression and subclass features. |

The table intentionally describes the shape of the rule engine rather than hard-coding prose from a book. Exact names, counts, prerequisites, and level gates must come from the selected catalog source.

### 8.2 Background model

For the 2024-style background model, a background definition needs:

- three eligible ability scores for the background adjustment;
- the allowed adjustment patterns, such as +2/+1 or +1/+1/+1, and the applicable cap;
- one origin feat;
- two skill proficiencies;
- one tool proficiency;
- equipment package A/B or other source-defined alternatives;
- any language or choice grants in the selected source;
- stable IDs for every granted option; and
- display text separate from the machine-readable grants.

Background is not just flavor text. It affects the final ability scores, proficiencies, feat selection, and equipment. The UI should show those consequences before confirmation.

Deprecated 2014 backgrounds must not be offered as new choices. If a legacy sheet references one, preserve its display and stored values under `dnd-2014-legacy`; do not reinterpret its ability-score increases, background features, or class progression as 2024 rules. A future conversion, if desired, should be an explicit migration project rather than a background adapter in the canonical creator.

### 8.3 Species model

A species definition needs:

- creature type;
- allowed size values or size choices;
- speed and movement choices;
- languages and language choices;
- traits, including level-gated traits;
- nested choices such as ancestry, lineage, damage type, or spell-like options;
- ruleset/source/version; and
- structured effects for any trait that changes validation or derived values.

The 2024 and deprecated 2014 approaches must not be merged by simply reusing the same display name. A species option must identify its ruleset and source. Legacy species ability-score adjustments remain attached to legacy records and must never be applied to a new 2024 build.

### 8.4 Ability-score generation and derived values

The creator needs a first-class ability-score state, not only six final numbers:

```ts
interface AbilityScoreBuild {
  method: "standard-array" | "point-buy" | "rolled" | "manual";
  pool?: number[];
  assignments: Record<string, number>;
  backgroundAdjustments: Record<string, number>;
  finalScores: Record<string, number>;
}
```

The final sheet should derive, at minimum:

- modifiers;
- proficiency bonus from total level;
- saving throws from class and other grants;
- skill modifiers and expertise;
- hit points from class hit die, level, Constitution, and later level choices;
- initiative and passive perception;
- armor class from equipment and class/species features; and
- spellcasting ability, spell attack, prepared/known spells, and slots where applicable.

The existing sheet stores some of these values directly. The creator should calculate them from canonical inputs and record the calculation/provenance. Manual overrides may remain available in the general editor, but they should be visibly marked as overrides rather than indistinguishable from rules-derived values.

### 8.5 Interaction examples that the model must support

These are the types of combinations the creator must represent:

1. A class grants a number of skill choices from a permitted list; the selected background also grants skills. The validator must define how duplicate grants are handled and the UI must not silently discard a user’s choice.
2. A background grants an origin feat. The feat may grant a spellcasting choice, which then requires a permitted class spell list, cantrip choices, and a level-1 spell choice.
3. A species trait may expose an ancestry or lineage choice, which can change a damage type, movement option, language, or granted spell/feature.
4. A class or species may grant a choice only at a specific level. The choice must be hidden, deferred, or required based on the selected level and ruleset.
5. A class’s spellcasting ability drives spell attack and save DC. A generic spell list is not enough to validate this.
6. Background ability adjustments interact with the six score assignments and the ruleset’s maximum. The UI should show before/after values.
7. Equipment package choices change the initial weapon, armor, tool, and coin state. The derived armor class and available actions may depend on those choices.
8. A feature may grant a proficiency already granted elsewhere. The content model needs a typed conflict/replacement policy rather than a string merge.
9. Higher-level creation would require all prior class choices, subclass gates, feats/ability-score improvements, spell progression, and resource progression. This is why level 1 is the recommended MVP.

## 9. Data and rules architecture

### 9.1 Recommended separation of concerns

Use four layers:

1. **Rule content** — versioned classes, backgrounds, species, feats, spells, equipment, and effects.
2. **Creation build state** — the user’s selections and unresolved choices while using the wizard.
3. **Rule engine** — pure validation and derivation functions that consume a ruleset and build state.
4. **Runtime sheet** — the existing `CharacterSheet` shape used by the library, map, and combat UI.

The rule engine should compile a valid build into a runtime sheet. The existing sheet should not be the place where all rule logic lives.

```text
ruleset catalog + creation selections
                |
                v
     validateCharacterBuild()
                |
                v
      deriveCharacterSheet()
                |
                v
     persisted runtime CharacterSheet
```

### 9.2 Proposed application structure

This is a proposed target structure; it is not yet an implementation task:

```text
app/features/character-creator/
  components/
  data/
    dnd-2024-basic/
      classes/
      backgrounds/
      species/
      feats/
      spells/
      equipment/
      languages/
    legacy/                    # compatibility metadata only; not a new-choice catalog
  rules/
    types.ts
    validate-build.ts
    derive-sheet.ts
    choice-resolution.ts
  schemas/
    creation-build.ts
    persisted-sheet.ts
  state/
```

`character-options.ts` can remain temporarily as a UI compatibility index, but new creation logic should consume structured definitions from the creator domain. A future shared rules package is possible; it should not be created by blending monster and player-character records.

### 9.3 Content definition shape

Content should be declarative where possible. A definition should describe grants, choices, prerequisites, and effects with typed operations. Avoid putting arbitrary executable code in JSON or encoding rule behavior in component conditionals.

Illustrative shape:

```ts
interface CharacterDefinition {
  id: string;
  ruleset: RulesetId;
  sourceBook: string;
  sourceVersion: string;
  displayName: string;
  grants?: Grant[];
  choices?: ChoiceDefinition[];
  prerequisites?: Predicate[];
  effects?: Effect[];
}
```

The exact `Grant`, `ChoiceDefinition`, `Predicate`, and `Effect` types require a design spike. The key requirement is that a choice has identity, scope, allowed values, cardinality, prerequisites, and conflict behavior.

### 9.4 Relationship to the monster knowledge base

Do not merge player-character rules into `SrdMonster` or use monster records as a generic creature schema. They have different purposes:

- monster records are stat blocks/templates used by the compendium, map tokens, and AI combat context;
- player-character rules are a choice/progression system that generates a sheet from origin, class, level, and selections;
- a map token is an integration object that can point to either a library character or a monster template.

The safe integration is at the map boundary:

```text
player build -> CharacterSheet -> library character -> map token
monster definition -> monster CharacterSheet/template -> map token
```

If a monster-derived sheet is stored, retain its `srdMonsterIndex`/template provenance. If a player character is stored, retain its ruleset and selected definition IDs. This prevents a later editor or AI context from confusing a monster with a player character.

### 9.5 Redis and static data

Keep the authoritative rule catalog in the repository and bundle/import it as application data. Redis is not a good primary store for this content in the current architecture because:

- the current Redis integration is optional and exists for distributed AI rate limiting;
- rule content needs code review, versioning, reproducible builds, and migrations;
- Redis introduces an availability/configuration dependency for data that is static;
- a cache hit still requires a source of truth and invalidation/versioning strategy; and
- catalog data may be shipped to the browser for the wizard regardless of whether Redis holds a copy.

An optional future Redis cache could cache a compiled catalog or an external/dynamic catalog, keyed by ruleset and content version. It must be a rebuildable optimization, never the only copy. For the first implementation, repository-backed JSON/TypeScript with shared server/client imports is the recommended approach.

## 10. Persistence and API decisions

### 10.1 Build state versus sheet state

Add a distinction between an in-progress creation build and a completed/runtime sheet. The persisted representation should eventually include fields equivalent to:

```ts
interface CharacterCreationMetadata {
  mode: "guided" | "manual" | "monster-template" | "imported";
  ruleset?: RulesetId;
  rulesVersion?: string;
  status: "draft" | "complete" | "legacy";
  definitionIds?: string[];
  choices?: Record<string, unknown>;
}
```

The exact database shape is a schema-design task. The current JSONB sheet can be extended during a migration, but existing records must remain readable.

### 10.2 Draft strategy

Two viable approaches exist:

| Approach | Benefits | Costs |
| --- | --- | --- |
| Save only at completion | Simple persistence and fewer partial records. | Users lose progress if they leave; map/library resume is harder. |
| Create a draft at the beginning | Supports resume, crash recovery, and multi-step editing. | Requires draft status, partial validation, cleanup, and UI for incomplete records. |

Recommendation: support resumable drafts for the library flow if the product expects a multi-step creator. For a first technical slice, local draft state plus an explicit final save is acceptable, but the data model should not make server drafts impossible.

### 10.3 Server validation

The client should provide immediate feedback, but the server must validate the submitted build against the same ruleset catalog before writing a completed character. The API should reject:

- unknown or cross-ruleset definition IDs;
- missing required choices;
- invalid level gates;
- illegal score-generation results;
- invalid spell, feat, equipment, language, or proficiency selections; and
- derived fields that do not match canonical calculation, unless an explicit manual override is allowed.

This is necessary because the current character API accepts a caller-provided JSON sheet without these guarantees.

## 11. Decisions required before implementation

The following decisions should be confirmed. Recommendations are included to make approval concrete.

| Priority | Decision | Recommendation |
| --- | --- | --- |
| P0 | Which ruleset is the first implementation for? | **D&D 2024 is canonical.** Mark 2014 as `dnd-2014-legacy` for compatibility only; do not offer new 2014 creation or maintain a parallel 2014 catalog. |
| P0 | What content may be distributed? | Start with Basic Rules/SRD or content the project has rights to use; do not silently treat the full Handbook as an application data license. |
| P0 | What starting levels are supported? | Level 1 only for the first flow. Add higher-level creation after progression is modeled. |
| P0 | Is multiclassing in scope? | No for MVP. Model the build so a future multiclass adapter is possible. |
| P0 | Which entry points launch the guided flow? | Library creation and character-layer creation. Existing empty character sheets may resume it. Monster templates, imports, duplicates, and object tokens do not. |
| P0 | What should a custom map character token create? | Recommended: offer “Guided Player Character” or “Quick/Manual Token”; do not force every NPC/token through the wizard. |
| P0 | Which ability-score methods are enabled? | Recommended: standard array and point buy first; allow rolling only if campaign/DM policy is defined. |
| P0 | Are rules violations blocked or merely warned? | Block invalid guided builds; keep explicit manual overrides in the general editor and mark them as overrides. |
| P0 | Are equipment packages and starting spell choices required in MVP? | Yes for a complete level-1 character, but scope the catalog to the chosen source. If delayed, save a clearly incomplete draft rather than fabricating values. |
| P0 | Should the wizard create a library character before completion? | Recommended: resumable draft for library creation; map-only quick tokens can remain inline until the user chooses to save/link. |
| P1 | Are homebrew/custom options supported? | Not in the first catalog. Define an extension boundary after the official rules path works. |
| P1 | How are legacy/manual sheets handled? | Preserve them as `legacy`/`manual`; do not silently migrate or recalculate. Hide deprecated 2014 choices from new creation and offer an explicit 2024 rebuild/migration only as later approved work. |
| P1 | How are duplicate proficiencies handled? | Follow the selected source’s rule, represented as an explicit conflict policy in the catalog. Never silently drop a selection. |
| P1 | When should subclass selection appear? | At the ruleset-defined level. For a level-1-only flow, show “subclass later” without asking for a value. |
| P1 | Can users override derived values? | Yes in the general editor if required for homebrew/manual play, but record the override and show that it is not rules-derived. |

Approval should answer the P0 rows before implementation begins. P1 rows can be resolved during the data-contract design spike if they do not change the MVP boundary.

## 12. Acceptance criteria for the requirements

The implementation should not be considered complete unless:

1. A user can complete a level-1 build with a supported class, background, species, languages, scores, equipment, and any required spell/feat choices.
2. The creator prevents invalid combinations and explains the reason in user-facing language.
3. The same build produces the same derived values in the client preview and server result.
4. The persisted character records its ruleset/version and the source IDs used to create it.
5. Existing manual library sheets continue to open and edit.
6. Importing, duplicating, and monster-template flows retain their existing semantics.
7. A character-layer map token can either use the guided creator or remain a quick/manual token according to the approved UX decision.
8. Monster data remains in the monster domain and is not required for player-character rule validation.
9. No runtime Redis dependency is required to load the authoritative static rules catalog.
10. The feature has a migration/compatibility story for sheets created before the ruleset metadata exists.

## 13. Suggested delivery phases

### Phase 0 — decisions and contract

- Confirm the P0 decisions above.
- Confirm the content source and permitted catalog scope.
- Define the ruleset IDs, build-state schema, effect/choice vocabulary, and persistence metadata.
- Inventory the exact 2024 source data required for level 1.

### Phase 1 — rule engine and catalog

- Add the versioned 2024 catalog for the selected classes, backgrounds, species, feats, spells, equipment, and languages.
- Implement pure validation and derivation functions.
- Add server validation and unit-level tests for score generation, prerequisites, grants, and derived values.

### Phase 2 — library creator

- Add the guided wizard to `/characters`.
- Add draft/resume behavior if approved.
- Compile valid builds into the existing sheet and preserve provenance.

### Phase 3 — map integration

- Add the guided/manual choice for character-layer custom tokens.
- Link completed library characters to tokens without duplicating rule state.
- Keep monster-template and object-token paths unchanged.

### Phase 4 — breadth and migration

- Add higher-level creation, subclass progression, richer spell/equipment choices, and homebrew extension points as separately approved work.
- Preserve the invariant that no deprecated 2014 entries can appear in new 2024 creation; future catalog updates must pass the source-manifest and generator verification checks.
- Add explicit 2024 rebuild/migration tooling for legacy sheets only if separately approved.

## 14. Implementation workflow after approval

No implementation or Herdr orchestration is part of this draft. After the requirements and P0 decisions are approved, the implementation workflow should use separate Herdr instances for:

1. feature development;
2. code review focused on rules/data integrity and regression risk; and
3. QA focused on wizard combinations, persistence, map integration, mobile behavior, and legacy/monster flows.

Each instance should receive the approved PRD, the agreed ruleset/content scope, and a clear handoff artifact. Final merge or release remains subject to the user’s final approval after development, review, and QA reports are complete.

## 15. Reference material

Official rules references consulted for this analysis:

- [D&D 2024 Basic Rules — Creating a Character](https://www.dndbeyond.com/sources/dnd/br-2024/creating-a-character)
- [D&D 2024 Basic Rules — Character Origins](https://www.dndbeyond.com/sources/dnd/br-2024/character-origins)
- [D&D 2024 Basic Rules — Character Classes](https://www.dndbeyond.com/sources/dnd/br-2024/character-classes)
- [D&D 2014 Basic Rules — Step-by-Step Characters](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/step-by-step-characters) — retained only as a legacy-data reference
- [D&D 2014 Basic Rules — Customization Options](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/customization-options) — retained only as a legacy-data reference

The documentation is stored under `docs/`, which is already excluded from the Vercel upload by the repository’s `.vercelignore`. It remains available in Git for review and change history without becoming a deployed application asset.
