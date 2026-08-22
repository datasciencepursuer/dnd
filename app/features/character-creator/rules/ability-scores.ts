import {
  ABILITY_NAMES,
  type AbilityName,
  type AbilityScoreAdjustments,
  type AbilityScoreAssignments,
  type AbilityScoreRoll,
} from "./types";

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const;
export const POINT_BUY_BUDGET = 27;
export const POINT_BUY_MIN = 8;
export const POINT_BUY_MAX = 15;
export const ROLLING_DICE_COUNT = 6;
export const ROLLING_DIE_COUNT = 4;
export const ROLLING_DIE_SIDES = 6;

const POINT_BUY_COSTS: Readonly<Record<number, number>> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9,
};

export function getPointBuyCost(score: number): number | null {
  return POINT_BUY_COSTS[score] ?? null;
}

export function getPointBuyTotal(assignments: AbilityScoreAssignments): number | null {
  const costs = Object.values(assignments).map(getPointBuyCost);
  if (costs.some((cost) => cost === null)) return null;
  return costs.reduce<number>((total, cost) => total + (cost ?? 0), 0);
}

export function sortedScores(assignments: AbilityScoreAssignments): number[] {
  return Object.values(assignments).sort((a, b) => b - a);
}

export function hasStandardArray(assignments: AbilityScoreAssignments): boolean {
  return sortedScores(assignments).every((score, index) => score === STANDARD_ARRAY[index]);
}

export function hasValidPointBuy(assignments: AbilityScoreAssignments): boolean {
  return getPointBuyTotal(assignments) === POINT_BUY_BUDGET;
}

export function rollFourD6DropLowest(random: () => number = Math.random): AbilityScoreRoll {
  const dice = [0, 0, 0, 0].map(() => Math.floor(random() * ROLLING_DIE_SIDES) + 1) as [number, number, number, number];
  const total = dice
    .slice()
    .sort((a, b) => b - a)
    .slice(0, 3)
    .reduce((sum, value) => sum + value, 0);
  return { dice, total };
}

export function rollAbilityScores(random: () => number = Math.random): AbilityScoreRoll[] {
  return Array.from({ length: ROLLING_DICE_COUNT }, () => rollFourD6DropLowest(random));
}

export function rollTotals(rolls: readonly AbilityScoreRoll[]): number[] {
  return rolls.map((roll) => roll.total);
}

export function isValidRoll(roll: AbilityScoreRoll): boolean {
  if (!Array.isArray(roll.dice) || roll.dice.length !== ROLLING_DIE_COUNT) return false;
  if (!roll.dice.every((die) => Number.isInteger(die) && die >= 1 && die <= ROLLING_DIE_SIDES)) return false;
  const expected = roll.dice
    .slice()
    .sort((a, b) => b - a)
    .slice(0, 3)
    .reduce((sum, value) => sum + value, 0);
  return roll.total === expected;
}

/** Reassign a standard-array score while keeping every score used exactly once. */
export function swapStandardArrayScore(
  assignments: AbilityScoreAssignments,
  ability: AbilityName,
  score: number,
): AbilityScoreAssignments {
  const otherAbility = ABILITY_NAMES.find(
    (candidate) => candidate !== ability && assignments[candidate] === score,
  );

  return {
    ...assignments,
    ...(otherAbility ? { [otherAbility]: assignments[ability] } : {}),
    [ability]: score,
  };
}

export function applyAbilityScoreAdjustments(
  assignments: AbilityScoreAssignments,
  adjustments: AbilityScoreAdjustments = {},
): AbilityScoreAssignments {
  return {
    strength: assignments.strength + (adjustments.strength ?? 0),
    dexterity: assignments.dexterity + (adjustments.dexterity ?? 0),
    constitution: assignments.constitution + (adjustments.constitution ?? 0),
    intelligence: assignments.intelligence + (adjustments.intelligence ?? 0),
    wisdom: assignments.wisdom + (adjustments.wisdom ?? 0),
    charisma: assignments.charisma + (adjustments.charisma ?? 0),
  };
}

export function createStandardArrayAssignments(): AbilityScoreAssignments {
  return {
    strength: 15,
    dexterity: 14,
    constitution: 13,
    intelligence: 12,
    wisdom: 10,
    charisma: 8,
  };
}

export function createPointBuyAssignments(): AbilityScoreAssignments {
  return {
    strength: 8,
    dexterity: 8,
    constitution: 8,
    intelligence: 8,
    wisdom: 8,
    charisma: 8,
  };
}

export function createRollingAssignments(rolls: readonly AbilityScoreRoll[] = rollAbilityScores()): AbilityScoreAssignments {
  const values = rolls.map((roll) => roll.total);
  return {
    strength: values[0] ?? 8,
    dexterity: values[1] ?? 8,
    constitution: values[2] ?? 8,
    intelligence: values[3] ?? 8,
    wisdom: values[4] ?? 8,
    charisma: values[5] ?? 8,
  };
}

export function isAbilityName(value: string): value is AbilityName {
  return ABILITY_NAMES.includes(value as AbilityName);
}
