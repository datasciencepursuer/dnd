import { GoogleGenAI } from "@google/genai";
import type { WallType, TerrainType, Position } from "~/features/map-editor/types";

const VALID_WALL_TYPES: Set<string> = new Set([
  "wall", "half-wall", "window", "arrow-slit",
  "door-closed", "door-open", "door-locked", "pillar", "fence",
]);

const VALID_TERRAIN_TYPES: Set<string> = new Set([
  "normal", "difficult", "water-shallow", "water-deep",
  "ice", "lava", "pit", "chasm", "elevated", "vegetation", "darkness", "trap",
]);

export interface AutoDrawResult {
  walls: Array<{ points: Position[]; wallType: WallType }>;
  areas: Array<{ points: [Position, Position]; terrainType: TerrainType; label?: string }>;
}

const AUTO_DRAW_SYSTEM_PROMPT = `You are a D&D map analysis assistant. You analyze top-down dungeon/battlemap images and identify walls, doors, and terrain areas.

OUTPUT FORMAT: You MUST return valid JSON with this exact structure:
{
  "walls": [
    { "points": [{"x": 0, "y": 0}, {"x": 5, "y": 0}], "wallType": "wall" }
  ],
  "areas": [
    { "points": [{"x": 1, "y": 1}, {"x": 4, "y": 4}], "terrainType": "water-shallow", "label": "Pool" }
  ]
}

COORDINATE SYSTEM:
- All coordinates are in GRID UNITS (integers), not pixels
- The grid is {WIDTH} cells wide and {HEIGHT} cells tall
- (0,0) is the top-left corner
- Walls snap to grid INTERSECTIONS (corners between cells)
- Areas use cell boundaries: points[0] is the top-left cell, points[1] is the bottom-right cell (exclusive)
- Clamp all coordinates: x in [0, {WIDTH}], y in [0, {HEIGHT}]

WALLS:
- Each wall is a polyline of 2+ points along grid intersections
- wallType options: "wall", "half-wall", "window", "arrow-slit", "door-closed", "door-open", "door-locked", "pillar", "fence"
- Trace the major structural walls visible in the image
- Identify doors (closed, open, locked) as short wall segments (typically 1 cell wide)
- Use "pillar" for columns/pillars
- Use "fence" for low barriers, railings
- Connect walls that form continuous structures into single polylines where possible

AREAS:
- Each area is an axis-aligned rectangle defined by two corner points
- terrainType options: "normal", "difficult", "water-shallow", "water-deep", "ice", "lava", "pit", "chasm", "elevated", "vegetation", "darkness", "trap"
- Identify water features (pools, rivers, streams)
- Identify elevation changes (platforms, stairs → "elevated")
- Identify hazardous terrain (lava, pits, chasms)
- Identify vegetation (dense bushes, trees)
- Identify difficult terrain (rubble, debris, rough ground)
- Add a short label for each area (e.g. "River", "Lava Pit", "Raised Platform")
- Do NOT create "normal" terrain areas — only mark special terrain

GUIDELINES:
- Return at most 25 wall segments and 8 terrain areas. Prioritize the most prominent structural features (outer walls, doors, major terrain). Skip minor details.
- Prefer fewer, accurate walls over many approximate ones
- Keep wall polylines simple — use straight segments along grid lines
- If unsure about a feature, skip it rather than guessing wrong`;

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(val)));
}

interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

function validateAndClamp(
  raw: unknown,
  gridWidth: number,
  gridHeight: number,
  region?: Region
): AutoDrawResult {
  const result: AutoDrawResult = { walls: [], areas: [] };

  if (!raw || typeof raw !== "object") return result;
  const data = raw as Record<string, unknown>;

  // Determine clamping bounds (region or full grid)
  const minX = region ? region.x : 0;
  const maxX = region ? region.x + region.width : gridWidth;
  const minY = region ? region.y : 0;
  const maxY = region ? region.y + region.height : gridHeight;

  // Validate walls
  if (Array.isArray(data.walls)) {
    for (const w of data.walls) {
      if (result.walls.length >= 25) break;
      if (!w || typeof w !== "object") continue;
      const wall = w as Record<string, unknown>;
      if (!Array.isArray(wall.points) || wall.points.length < 2) continue;

      const wallType = VALID_WALL_TYPES.has(String(wall.wallType))
        ? (String(wall.wallType) as WallType)
        : "wall";

      const points: Position[] = [];
      for (const p of wall.points) {
        if (!p || typeof p !== "object") continue;
        const pt = p as Record<string, unknown>;
        if (typeof pt.x !== "number" || typeof pt.y !== "number") continue;
        points.push({
          x: clamp(pt.x, minX, maxX),
          y: clamp(pt.y, minY, maxY),
        });
      }
      if (points.length >= 2) {
        result.walls.push({ points, wallType });
      }
    }
  }

  // Validate areas
  if (Array.isArray(data.areas)) {
    for (const a of data.areas) {
      if (result.areas.length >= 8) break;
      if (!a || typeof a !== "object") continue;
      const area = a as Record<string, unknown>;
      if (!Array.isArray(area.points) || area.points.length < 2) continue;

      const terrainType = VALID_TERRAIN_TYPES.has(String(area.terrainType))
        ? (String(area.terrainType) as TerrainType)
        : "normal";

      // Skip normal terrain (no need to create those)
      if (terrainType === "normal") continue;

      const p0 = area.points[0] as Record<string, unknown> | null;
      const p1 = area.points[1] as Record<string, unknown> | null;
      if (!p0 || !p1) continue;
      if (typeof p0.x !== "number" || typeof p0.y !== "number") continue;
      if (typeof p1.x !== "number" || typeof p1.y !== "number") continue;

      const points: [Position, Position] = [
        { x: clamp(p0.x, minX, maxX), y: clamp(p0.y, minY, maxY) },
        { x: clamp(p1.x, minX, maxX), y: clamp(p1.y, minY, maxY) },
      ];

      // Ensure non-zero area
      if (points[0].x === points[1].x || points[0].y === points[1].y) continue;

      const label = typeof area.label === "string" ? area.label.slice(0, 50) : undefined;
      result.areas.push({ points, terrainType, label });
    }
  }

  return result;
}

/**
 * Strip markdown code fences from a response string.
 * Gemini often wraps JSON in ```json ... ``` when not using responseMimeType.
 */
function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  // Match ```json ... ``` or ``` ... ```
  const match = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
  if (match) return match[1].trim();
  return trimmed;
}

export async function analyzeMapBackground(
  apiKey: string,
  imageUrl: string,
  gridWidth: number,
  gridHeight: number,
  region?: Region
): Promise<AutoDrawResult> {
  // Fetch image and convert to base64
  console.log("[AI Auto-Draw] Fetching image:", imageUrl.slice(0, 100));
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to fetch background image: ${imageResponse.status}`);
  }

  const imageBuffer = await imageResponse.arrayBuffer();
  const base64Image = Buffer.from(imageBuffer).toString("base64");
  console.log("[AI Auto-Draw] Image size:", Math.round(imageBuffer.byteLength / 1024), "KB");

  // Determine MIME type from content-type header or URL
  const contentType = imageResponse.headers.get("content-type") || "image/png";
  const mimeType = contentType.split(";")[0].trim();
  console.log("[AI Auto-Draw] MIME type:", mimeType);

  const systemPrompt = AUTO_DRAW_SYSTEM_PROMPT
    .replace(/\{WIDTH\}/g, String(gridWidth))
    .replace(/\{HEIGHT\}/g, String(gridHeight));

  const ai = new GoogleGenAI({ apiKey });

  // NOTE: Do NOT use responseMimeType with vision/multimodal — it can cause
  // empty responses on Gemini 2.5 Flash. Instead, we instruct the model in the
  // prompt and strip code fences from the response manually.
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64Image,
            },
          },
          {
            text: region
              ? `Analyze this D&D battlemap image. The grid is ${gridWidth} cells wide and ${gridHeight} cells tall. Focus ONLY on the region from grid cell (${region.x},${region.y}) to (${region.x + region.width},${region.y + region.height}) — a ${region.width}x${region.height} cell area. Only return walls and areas within this region. Return ONLY valid JSON — no markdown, no explanation, no code fences.`
              : `Analyze this D&D battlemap image. The grid is ${gridWidth} cells wide and ${gridHeight} cells tall. Identify all walls, doors, and terrain features. Return ONLY valid JSON — no markdown, no explanation, no code fences.`,
          },
        ],
      },
    ],
    config: {
      systemInstruction: systemPrompt,
      maxOutputTokens: 65536,
      temperature: 0.2,
      thinkingConfig: {
        thinkingBudget: 8192,
      },
    },
  });

  const rawText = response.text ?? "";
  console.log("[AI Auto-Draw] Raw response length:", rawText.length);
  if (rawText.length > 0) {
    console.log("[AI Auto-Draw] Response preview:", rawText.slice(0, 300));
  }

  if (rawText.trim().length === 0) {
    console.warn("[AI Auto-Draw] Empty response from Gemini");
    return { walls: [], areas: [] };
  }

  const jsonText = stripCodeFences(rawText);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    console.error("[AI Auto-Draw] Failed to parse JSON response:", jsonText.slice(0, 500));
    return { walls: [], areas: [] };
  }

  const result = validateAndClamp(parsed, gridWidth, gridHeight, region);
  console.log("[AI Auto-Draw] Result:", result.walls.length, "walls,", result.areas.length, "areas");
  return result;
}
