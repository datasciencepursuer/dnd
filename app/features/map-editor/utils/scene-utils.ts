import type { DnDMap, MapScene } from "../types";

/** Pack the active scene's per-scene fields into a MapScene object */
export function packActiveScene(map: DnDMap): MapScene {
  return {
    id: map.activeSceneId,
    name: map.activeSceneName,
    grid: map.grid,
    background: map.background,
    tokens: map.tokens,
    walls: map.walls,
    areas: map.areas,
    labels: map.labels,
    freehand: map.freehand,
    fogOfWar: map.fogOfWar,
    monsterGroups: map.monsterGroups,
  };
}

/** Write a scene's fields into the flat map fields, updating activeSceneId/Name */
export function unpackSceneIntoMap(map: DnDMap, scene: MapScene): DnDMap {
  return {
    ...map,
    activeSceneId: scene.id,
    activeSceneName: scene.name,
    grid: scene.grid,
    background: scene.background,
    tokens: scene.tokens,
    walls: scene.walls,
    areas: scene.areas,
    labels: scene.labels,
    freehand: scene.freehand,
    fogOfWar: scene.fogOfWar,
    monsterGroups: scene.monsterGroups,
    updatedAt: new Date().toISOString(),
  };
}

export interface SceneInfo {
  id: string;
  name: string;
  isActive: boolean;
  backgroundUrl: string | null;
  tokenCount: number;
}

/** Returns a unified list of all scenes (active + inactive) for the UI */
export function getAllScenes(map: DnDMap): SceneInfo[] {
  const activeScene: SceneInfo = {
    id: map.activeSceneId,
    name: map.activeSceneName,
    isActive: true,
    backgroundUrl: map.background?.imageUrl ?? null,
    tokenCount: map.tokens.length,
  };

  const inactiveScenes: SceneInfo[] = (map.scenes || []).map((s) => ({
    id: s.id,
    name: s.name,
    isActive: false,
    backgroundUrl: s.background?.imageUrl ?? null,
    tokenCount: s.tokens.length,
  }));

  return [activeScene, ...inactiveScenes];
}
