import type { CharacterSheet } from "~/features/map-editor/types";
import type { SrdMonster } from "~/features/map-editor/data/monster-types";

export interface AbilityDescription {
  name: string;
  category: "special" | "action" | "legendary" | "reaction";
  desc: string;
}

/**
 * Strip prefixes like "[Legendary] " and suffix descriptions like ": The goblin can..."
 * from feature names to get the base ability name for matching.
 */
function extractFeatureBaseName(featureName: string): string {
  let name = featureName;
  // Strip [Prefix] prefix
  name = name.replace(/^\[[\w]+\]\s*/, "");
  // Strip ": description..." suffix (abilityToFeature embeds desc after colon)
  const colonIdx = name.indexOf(": ");
  if (colonIdx > 0) {
    name = name.substring(0, colonIdx);
  }
  return name.trim();
}

/**
 * Match character sheet abilities against SRD monster data to produce
 * rich descriptions for abilities the DM has kept on the sheet.
 */
export function matchAbilityDescriptions(
  sheet: CharacterSheet,
  srdMonster: SrdMonster
): AbilityDescription[] {
  const results: AbilityDescription[] = [];

  // Collect base names from features
  const featureBaseNames = new Set(
    sheet.classFeatures.map((f) => extractFeatureBaseName(f.name))
  );

  // Collect weapon names
  const weaponNames = new Set(sheet.weapons.map((w) => w.name));

  // All names we want to match against
  const allNames = new Set([...featureBaseNames, ...weaponNames]);

  // Match special_abilities
  for (const ability of srdMonster.special_abilities ?? []) {
    if (featureBaseNames.has(ability.name)) {
      results.push({
        name: ability.name,
        category: "special",
        desc: ability.desc,
      });
    }
  }

  // Match actions (against both weapon names and feature names)
  for (const action of srdMonster.actions ?? []) {
    if (allNames.has(action.name)) {
      results.push({
        name: action.name,
        category: "action",
        desc: action.desc,
      });
    }
  }

  // Match legendary_actions
  for (const action of srdMonster.legendary_actions ?? []) {
    if (featureBaseNames.has(action.name)) {
      results.push({
        name: action.name,
        category: "legendary",
        desc: action.desc,
      });
    }
  }

  // Match reactions
  for (const reaction of srdMonster.reactions ?? []) {
    if (featureBaseNames.has(reaction.name)) {
      results.push({
        name: reaction.name,
        category: "reaction",
        desc: reaction.desc,
      });
    }
  }

  return results;
}
