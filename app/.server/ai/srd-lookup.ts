import { SRD_SOURCE } from "~/features/map-editor/data/monster-types";
import type { SrdMonster } from "~/features/map-editor/data/monster-types";

let monsterCache: Map<string, SrdMonster> | null = null;

async function loadMonsters(): Promise<Map<string, SrdMonster>> {
  if (monsterCache) return monsterCache;

  const data = (await import("~/features/map-editor/data/srd-monsters.json"))
    .default as SrdMonster[];
  if (!Array.isArray(data)) {
    throw new Error(`${SRD_SOURCE.label} monster data must be an array`);
  }

  monsterCache = new Map<string, SrdMonster>();
  for (const monster of data) {
    // Generated indexes are stable kebab-case keys. Normalize the lookup key
    // so persisted map tokens and AI requests remain tolerant of whitespace or
    // casing introduced by older clients.
    const index = monster.index.trim().toLowerCase();
    if (index) monsterCache.set(index, monster);
  }
  return monsterCache;
}

export async function lookupSrdMonsters(
  indices: string[]
): Promise<Map<string, SrdMonster>> {
  if (indices.length === 0) return new Map();

  const allMonsters = await loadMonsters();
  const result = new Map<string, SrdMonster>();
  for (const index of indices) {
    const normalizedIndex = index.trim().toLowerCase();
    const monster = allMonsters.get(normalizedIndex);
    if (monster) {
      result.set(index, monster);
    }
  }
  return result;
}
