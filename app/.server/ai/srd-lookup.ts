import type { SrdMonster } from "~/features/map-editor/data/monster-types";

let monsterCache: Map<string, SrdMonster> | null = null;

async function loadMonsters(): Promise<Map<string, SrdMonster>> {
  if (monsterCache) return monsterCache;

  const data = (await import("~/features/map-editor/data/srd-monsters.json"))
    .default as SrdMonster[];

  monsterCache = new Map<string, SrdMonster>();
  for (const monster of data) {
    monsterCache.set(monster.index, monster);
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
    const monster = allMonsters.get(index);
    if (monster) {
      result.set(index, monster);
    }
  }
  return result;
}
