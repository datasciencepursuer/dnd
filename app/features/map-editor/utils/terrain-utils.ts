import type {
  AreaShape,
  WallSegment,
  WallType,
  TerrainType,
  CoverType,
  ObscurementLevel,
  HazardInfo,
  TrapEffect,
  Token,
  GridPosition,
  Position,
} from "../types";
import { FEET_PER_CELL } from "../constants";

// ─── Rendering Constants ─────────────────────────────────────────────

/** Fill colors for each terrain type (used by AreaLayer and area tool defaults). Neon palette for build mode visibility. */
export const TERRAIN_COLORS: Record<TerrainType, string> = {
  normal: "#c0c0c0",
  difficult: "#ff8800",
  "water-shallow": "#00eeff",
  "water-deep": "#0066ff",
  ice: "#88ffff",
  lava: "#ff2200",
  pit: "#880088",
  chasm: "#660066",
  elevated: "#66ff00",
  vegetation: "#00ff44",
  darkness: "#bb00ff",
  trap: "#ffee00",
};

/** Default fill opacity per terrain type. */
export const TERRAIN_DEFAULT_OPACITY: Record<TerrainType, number> = {
  normal: 0.15,
  difficult: 0.3,
  "water-shallow": 0.35,
  "water-deep": 0.45,
  ice: 0.3,
  lava: 0.45,
  pit: 0.5,
  chasm: 0.55,
  elevated: 0.25,
  vegetation: 0.3,
  darkness: 0.5,
  trap: 0.3,
};

/** Visual style for each wall type (used by WallLayer). Neon colors for build mode visibility. */
export const WALL_STYLES: Record<WallType, { color: string; width: number; dash: number[] }> = {
  wall: { color: "#ff00ff", width: 5, dash: [] },
  "half-wall": { color: "#ff00aa", width: 4, dash: [] },
  window: { color: "#00ffff", width: 4, dash: [8, 4] },
  "arrow-slit": { color: "#00ccff", width: 3, dash: [3, 5] },
  "door-closed": { color: "#ff6600", width: 5, dash: [] },
  "door-open": { color: "#00ff66", width: 4, dash: [10, 6] },
  "door-locked": { color: "#ff0044", width: 5, dash: [] },
  pillar: { color: "#aa00ff", width: 7, dash: [] },
  fence: { color: "#ffff00", width: 3, dash: [4, 4] },
};

// ─── Wall / Cover Lookups ────────────────────────────────────────────

const WALL_COVER: Record<WallType, CoverType> = {
  wall: "full",
  "half-wall": "half",
  window: "three-quarters",
  "arrow-slit": "three-quarters",
  "door-closed": "full",
  "door-open": "none",
  "door-locked": "full",
  pillar: "half",
  fence: "half",
};

const WALL_PASSABLE: Record<WallType, boolean> = {
  wall: false,
  "half-wall": false,
  window: false,
  "arrow-slit": false,
  "door-closed": false,
  "door-open": true,
  "door-locked": false,
  pillar: false,
  fence: false,
};

/** Does this wall segment provide any cover? */
export function wallProvidesCover(wall: WallSegment): boolean {
  return WALL_COVER[wall.wallType] !== "none";
}

/** What level of cover does this wall type provide? */
export function getWallCoverType(wall: WallSegment): CoverType {
  return WALL_COVER[wall.wallType];
}

/** Can a creature walk through this wall/barrier? */
export function isWallPassable(wall: WallSegment): boolean {
  return WALL_PASSABLE[wall.wallType];
}

// ─── Terrain / Area Lookups ──────────────────────────────────────────

const DIFFICULT_TERRAIN: Set<TerrainType> = new Set([
  "difficult",
  "water-shallow",
  "water-deep",
  "ice",
  "lava",
  "vegetation",
]);

const IMPASSABLE_TERRAIN: Set<TerrainType> = new Set(["pit", "chasm"]);

const HAZARDOUS_TERRAIN: Set<TerrainType> = new Set(["lava", "pit", "chasm"]);

/** Does this area count as D&D 5e difficult terrain (2x movement cost)? */
export function isDifficultTerrain(area: AreaShape): boolean {
  return DIFFICULT_TERRAIN.has(area.terrainType);
}

/** Movement cost multiplier for traversing this area. */
export function getMovementCost(area: AreaShape): number {
  return isDifficultTerrain(area) ? 2 : 1;
}

/** Can a creature enter this terrain? False for pits/chasms without flying. */
export function isPassableTerrain(area: AreaShape): boolean {
  return !IMPASSABLE_TERRAIN.has(area.terrainType);
}

/** Does this area deal damage when entered or at start of turn? */
export function isHazard(area: AreaShape): boolean {
  return area.hazard != null || HAZARDOUS_TERRAIN.has(area.terrainType);
}

/** Get the hazard damage info, or null if not a hazard. */
export function getHazardInfo(area: AreaShape): HazardInfo | null {
  return area.hazard ?? null;
}

/** Is this area a triggered trap? */
export function isTrap(area: AreaShape): boolean {
  return area.terrainType === "trap" && area.trap != null;
}

/** Get trap effect data, or null. */
export function getTrapEffect(area: AreaShape): TrapEffect | null {
  return area.trap ?? null;
}

/** Is the trap still armed? */
export function isTrapArmed(area: AreaShape): boolean {
  return area.trap?.armed ?? false;
}

/** Does this area affect vision? */
export function isObscured(area: AreaShape): boolean {
  return area.obscurement !== "none";
}

/** Get the obscurement level of this area. */
export function getObscurement(area: AreaShape): ObscurementLevel {
  return area.obscurement;
}

/** Does this area represent elevated ground? */
export function isElevated(area: AreaShape): boolean {
  return area.elevation > 0;
}

/** Get the elevation in feet. */
export function getElevation(area: AreaShape): number {
  return area.elevation;
}

// ─── Geometry Helpers ────────────────────────────────────────────────

/** Get the center of a token's footprint in grid coordinates. */
function tokenCenter(token: Token): Position {
  return {
    x: token.position.col + token.size / 2,
    y: token.position.row + token.size / 2,
  };
}

/** Get the pixel center of a grid cell. */
function gridCellCenter(col: number, row: number): Position {
  return { x: col + 0.5, y: row + 0.5 };
}

/**
 * Check if a line segment (p1→p2) intersects another segment (p3→p4).
 * Uses the cross product / parameter method.
 */
export function segmentsIntersect(
  p1: Position,
  p2: Position,
  p3: Position,
  p4: Position
): boolean {
  const d1x = p2.x - p1.x;
  const d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x;
  const d2y = p4.y - p3.y;

  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-10) return false; // Parallel

  const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / denom;
  const u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / denom;

  return t > 0 && t < 1 && u > 0 && u < 1;
}

/**
 * Convert a WallSegment's point list into line segments.
 * Wall points form a polyline (each consecutive pair is a segment).
 */
export function wallToSegments(wall: WallSegment): [Position, Position][] {
  const segs: [Position, Position][] = [];
  for (let i = 0; i < wall.points.length - 1; i++) {
    segs.push([wall.points[i], wall.points[i + 1]]);
  }
  return segs;
}

// ─── Line of Sight & Cover Calculations ──────────────────────────────

/**
 * Get all wall segments that block the line between two grid positions.
 * Returns only non-passable walls that intersect the line.
 */
export function getWallsBetween(
  a: GridPosition,
  b: GridPosition,
  walls: WallSegment[]
): WallSegment[] {
  const p1 = gridCellCenter(a.col, a.row);
  const p2 = gridCellCenter(b.col, b.row);

  return walls.filter((wall) => {
    if (isWallPassable(wall)) return false;
    return wallToSegments(wall).some(([s1, s2]) =>
      segmentsIntersect(p1, p2, s1, s2)
    );
  });
}

/**
 * Check line of sight between two grid positions.
 * Returns true if no blocking walls (full cover) exist between them.
 */
export function checkLineOfSight(
  a: GridPosition,
  b: GridPosition,
  walls: WallSegment[]
): boolean {
  const blocking = getWallsBetween(a, b, walls);
  return !blocking.some((w) => getWallCoverType(w) === "full");
}

/**
 * Calculate the best cover a target has from an attacker, considering walls.
 * Uses the highest cover type among all intersecting wall segments.
 */
export function calculateCover(
  attacker: GridPosition,
  target: GridPosition,
  walls: WallSegment[]
): CoverType {
  const blocking = getWallsBetween(attacker, target, walls);
  if (blocking.length === 0) return "none";

  const priority: Record<CoverType, number> = {
    none: 0,
    half: 1,
    "three-quarters": 2,
    full: 3,
  };

  let best: CoverType = "none";
  for (const wall of blocking) {
    const cover = getWallCoverType(wall);
    if (priority[cover] > priority[best]) {
      best = cover;
    }
  }
  return best;
}

/**
 * Does the attacker have high ground advantage over the target?
 * True if attacker's elevation is higher and they're in melee range.
 */
export function hasHighGroundAdvantage(
  attackerPos: GridPosition,
  targetPos: GridPosition,
  areas: AreaShape[],
  meleeRangeFeet: number = 5
): boolean {
  const attackerElev = getTerrainAtPosition(attackerPos, areas)
    .reduce((max, a) => Math.max(max, a.elevation), 0);
  const targetElev = getTerrainAtPosition(targetPos, areas)
    .reduce((max, a) => Math.max(max, a.elevation), 0);
  // Only relevant for melee — within 5ft default
  return attackerElev > targetElev;
}

// ─── Spatial Queries ─────────────────────────────────────────────────

/**
 * Check if a grid position falls within a rectangular area.
 * Area points define the bounding rectangle (min and max corners).
 */
function positionInRectArea(pos: GridPosition, area: AreaShape): boolean {
  if (area.points.length < 2) return false;
  const minX = Math.min(area.points[0].x, area.points[1].x);
  const maxX = Math.max(area.points[0].x, area.points[1].x);
  const minY = Math.min(area.points[0].y, area.points[1].y);
  const maxY = Math.max(area.points[0].y, area.points[1].y);
  return pos.col >= minX && pos.col <= maxX && pos.row >= minY && pos.row <= maxY;
}

/**
 * Check if a grid position falls within a circular area.
 * points[0] = center, points[1] defines the radius (distance from center).
 */
function positionInCircleArea(pos: GridPosition, area: AreaShape): boolean {
  if (area.points.length < 2) return false;
  const center = area.points[0];
  const radiusPoint = area.points[1];
  const radius = Math.sqrt(
    (radiusPoint.x - center.x) ** 2 + (radiusPoint.y - center.y) ** 2
  );
  const dist = Math.sqrt(
    (pos.col + 0.5 - center.x) ** 2 + (pos.row + 0.5 - center.y) ** 2
  );
  return dist <= radius;
}

/**
 * Point-in-polygon test (ray casting algorithm).
 * Used for polygon-type areas.
 */
function positionInPolygonArea(pos: GridPosition, area: AreaShape): boolean {
  const pts = area.points;
  if (pts.length < 3) return false;
  const px = pos.col + 0.5;
  const py = pos.row + 0.5;
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, yi = pts[i].y;
    const xj = pts[j].x, yj = pts[j].y;
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Check if a grid position falls within an area shape. */
export function isPositionInArea(pos: GridPosition, area: AreaShape): boolean {
  switch (area.type) {
    case "rectangle":
      return positionInRectArea(pos, area);
    case "circle":
      return positionInCircleArea(pos, area);
    case "polygon":
      return positionInPolygonArea(pos, area);
  }
}

/** Get all terrain areas that overlap a grid position. */
export function getTerrainAtPosition(
  pos: GridPosition,
  areas: AreaShape[]
): AreaShape[] {
  return areas.filter((area) => isPositionInArea(pos, area));
}

/** Get all terrain areas that a token's full footprint overlaps. */
export function getTerrainAtToken(
  token: Token,
  areas: AreaShape[]
): AreaShape[] {
  const matched = new Set<string>();
  const results: AreaShape[] = [];

  for (let col = token.position.col; col < token.position.col + token.size; col++) {
    for (let row = token.position.row; row < token.position.row + token.size; row++) {
      for (const area of areas) {
        if (!matched.has(area.id) && isPositionInArea({ col, row }, area)) {
          matched.add(area.id);
          results.push(area);
        }
      }
    }
  }

  return results;
}

/**
 * Get all terrain areas along the path between two positions.
 * Samples points along the line at 1-cell intervals.
 */
export function getTerrainBetween(
  a: GridPosition,
  b: GridPosition,
  areas: AreaShape[]
): AreaShape[] {
  const matched = new Set<string>();
  const results: AreaShape[] = [];

  const dx = b.col - a.col;
  const dy = b.row - a.row;
  const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const col = Math.round(a.col + dx * t);
    const row = Math.round(a.row + dy * t);
    for (const area of areas) {
      if (!matched.has(area.id) && isPositionInArea({ col, row }, area)) {
        matched.add(area.id);
        results.push(area);
      }
    }
  }

  return results;
}

// ─── AI Context Description Helpers ──────────────────────────────────

const TERRAIN_LABELS: Record<TerrainType, string> = {
  normal: "normal ground",
  difficult: "difficult terrain (rubble/debris)",
  "water-shallow": "shallow water (difficult terrain)",
  "water-deep": "deep water (requires swimming)",
  ice: "icy ground (difficult terrain, DEX save or fall prone)",
  lava: "lava",
  pit: "pit",
  chasm: "chasm",
  elevated: "elevated ground",
  vegetation: "dense vegetation (lightly obscured)",
  darkness: "magical darkness (heavily obscured)",
  trap: "trap",
};

const COVER_LABELS: Record<CoverType, string> = {
  none: "",
  half: "half cover (+2 AC, +2 DEX saves)",
  "three-quarters": "three-quarters cover (+5 AC, +5 DEX saves)",
  full: "full cover (can't be targeted directly)",
};

const WALL_TYPE_LABELS: Record<WallType, string> = {
  wall: "solid wall",
  "half-wall": "low wall",
  window: "window",
  "arrow-slit": "arrow slit",
  "door-closed": "closed door",
  "door-open": "open doorway",
  "door-locked": "locked door",
  pillar: "pillar",
  fence: "fence",
};

/** Build a terrain description for a single area. */
function describeArea(area: AreaShape): string {
  const parts: string[] = [];
  const label = area.label ? `"${area.label}"` : "";
  const terrain = TERRAIN_LABELS[area.terrainType];

  parts.push(label ? `${label}: ${terrain}` : terrain);

  if (area.elevation > 0) {
    parts.push(`${area.elevation}ft elevated`);
  }
  if (area.hazard) {
    parts.push(
      `${area.hazard.damage} ${area.hazard.damageType} damage ${area.hazard.trigger === "both" ? "on enter and start of turn" : area.hazard.trigger === "on-enter" ? "on entering" : "at start of turn"}`
    );
    if (area.hazard.saveDC) {
      parts.push(`DC ${area.hazard.saveDC} ${area.hazard.saveAbility ?? "DEX"} save`);
    }
  }
  if (area.trap?.armed) {
    // Don't reveal trap details — just note one exists for the AI to reason about
    parts.push("armed trap");
  }
  if (area.obscurement !== "none") {
    parts.push(`${area.obscurement}ly obscured`);
  }

  return parts.join(", ");
}

/**
 * Generate a natural-language terrain context string for a single token.
 * Designed to be fed into the AI DM's combat context.
 *
 * Example output:
 * "Goblin Archer: standing on elevated ground (10ft high). Half-wall provides
 *  half cover (+2 AC) from the south. Lava (2d10 fire damage on entering) is
 *  10ft to the east."
 */
export function describeTerrainForToken(
  token: Token,
  areas: AreaShape[],
  walls: WallSegment[],
  allTokens: Token[]
): string {
  const parts: string[] = [];

  // What terrain is this token standing in?
  const standing = getTerrainAtToken(token, areas);
  if (standing.length > 0) {
    const nonNormal = standing.filter((a) => a.terrainType !== "normal");
    if (nonNormal.length > 0) {
      parts.push(`standing in: ${nonNormal.map(describeArea).join("; ")}`);
    }
  }

  // What cover does this token have from enemies?
  const enemies = allTokens.filter(
    (t) => t.layer !== token.layer && t.id !== token.id
  );
  for (const enemy of enemies) {
    const cover = calculateCover(enemy.position, token.position, walls);
    if (cover !== "none") {
      parts.push(`${COVER_LABELS[cover]} from ${enemy.name}`);
    }
  }

  // Nearby hazards (within movement range, ~30ft)
  const nearbyRange = 6; // 6 cells = 30ft
  const hazardAreas = areas.filter(
    (a) =>
      isHazard(a) &&
      !standing.includes(a) // already reported above
  );
  for (const ha of hazardAreas) {
    const terrainBetween = getTerrainBetween(
      token.position,
      // Approximate: use first point of the area as reference
      { col: Math.round(ha.points[0]?.x ?? 0), row: Math.round(ha.points[0]?.y ?? 0) },
      []
    );
    // Simple distance check using first point
    const dx = (ha.points[0]?.x ?? 0) - token.position.col;
    const dy = (ha.points[0]?.y ?? 0) - token.position.row;
    const distCells = Math.sqrt(dx * dx + dy * dy);
    if (distCells <= nearbyRange) {
      const distFeet = Math.round(distCells * FEET_PER_CELL);
      parts.push(`${describeArea(ha)} ~${distFeet}ft away`);
    }
  }

  if (parts.length === 0) return "";
  return `${token.name}: ${parts.join(". ")}.`;
}

/**
 * Generate terrain context for all combatants.
 * Returns a block of text suitable for the AI DM system prompt.
 */
export function describeAllTerrainContext(
  tokens: Token[],
  areas: AreaShape[],
  walls: WallSegment[]
): string {
  if (areas.length === 0 && walls.length === 0) return "";

  const lines: string[] = [];

  // Summarize wall/barrier layout
  const nonOpenWalls = walls.filter((w) => w.wallType !== "door-open");
  if (nonOpenWalls.length > 0) {
    const wallSummary = nonOpenWalls.map(
      (w) => WALL_TYPE_LABELS[w.wallType]
    );
    const counts = new Map<string, number>();
    for (const label of wallSummary) {
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    const wallDesc = [...counts.entries()]
      .map(([label, count]) => (count > 1 ? `${count}x ${label}` : label))
      .join(", ");
    lines.push(`Barriers: ${wallDesc}`);
  }

  // Summarize terrain zones
  const nonNormalAreas = areas.filter((a) => a.terrainType !== "normal");
  if (nonNormalAreas.length > 0) {
    lines.push("Terrain zones:");
    for (const area of nonNormalAreas) {
      lines.push(`  - ${describeArea(area)}`);
    }
  }

  // Per-token terrain context
  const tokenContexts = tokens
    .map((t) => describeTerrainForToken(t, areas, walls, tokens))
    .filter(Boolean);
  if (tokenContexts.length > 0) {
    lines.push("Combatant terrain:");
    for (const ctx of tokenContexts) {
      lines.push(`  - ${ctx}`);
    }
  }

  return lines.join("\n");
}
