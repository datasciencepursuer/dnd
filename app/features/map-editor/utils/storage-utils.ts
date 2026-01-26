import type { DnDMap } from "../types";

const MAPS_INDEX_KEY = "dnd-maps-index";
const MAP_PREFIX = "dnd-map-";

export interface MapIndexEntry {
  id: string;
  name: string;
  updatedAt: string;
}

export function getMapIndex(): MapIndexEntry[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(MAPS_INDEX_KEY);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function saveMapIndex(index: MapIndexEntry[]): void {
  localStorage.setItem(MAPS_INDEX_KEY, JSON.stringify(index));
}

export function saveMap(map: DnDMap): void {
  if (typeof window === "undefined") return;

  // Save map data
  localStorage.setItem(MAP_PREFIX + map.id, JSON.stringify(map));

  // Update index
  const index = getMapIndex();
  const existingIdx = index.findIndex((m) => m.id === map.id);
  const entry: MapIndexEntry = {
    id: map.id,
    name: map.name,
    updatedAt: map.updatedAt,
  };

  if (existingIdx >= 0) {
    index[existingIdx] = entry;
  } else {
    index.push(entry);
  }

  saveMapIndex(index);
}

export function loadMap(id: string): DnDMap | null {
  if (typeof window === "undefined") return null;
  const data = localStorage.getItem(MAP_PREFIX + id);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function deleteMap(id: string): void {
  if (typeof window === "undefined") return;

  localStorage.removeItem(MAP_PREFIX + id);

  const index = getMapIndex().filter((m) => m.id !== id);
  saveMapIndex(index);
}

export function exportMapToJson(map: DnDMap): void {
  const json = JSON.stringify(map, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${map.name}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importMapFromJson(file: File): Promise<DnDMap> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const map = JSON.parse(reader.result as string);
        resolve(map);
      } catch (e) {
        reject(new Error("Invalid map file"));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}
