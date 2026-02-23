import { GoogleGenAI } from "@google/genai";

// Chroma key color — pure white, universally understood by AI models
export const CHROMA_KEY_R = 255;
export const CHROMA_KEY_G = 255;
export const CHROMA_KEY_B = 255;

export type ArtStyle = "jrpg" | "classic" | "pixel";

const SHARED_REQUIREMENTS = `CRITICAL REQUIREMENTS:
- The background MUST be solid pure white (#FFFFFF). Fill the ENTIRE background with flat white, no gradients, no shadows, no floor, no scenery
- The character must have clear contrast against the white background — avoid white clothing or armor unless it has visible outlines/shading to distinguish it
- ABSOLUTELY NO frames, borders, circles, rings, medallions, pedestals, platforms, or any UI elements around the character. The output must be ONLY the character on solid white. If you are tempted to add a circular token frame — DO NOT. This is not a token with a frame, it is a raw character sprite
- Render a full-body character in a 2D illustrated style — NOT 3D rendered, NOT photorealistic
- Front-facing or slight 3/4 angle, full body visible head to feet, dynamic but readable pose

TOKEN SIZE GUIDELINES (D&D 5e grid, each cell = 5 feet):
- Size 1x1 (Medium, ~5ft): Single humanoid or medium creature. Standard adventurer, human, elf, dwarf, etc.
- Size 2x2 (Large, ~10ft): Large creature — ogre, horse, dire wolf, centaur. Show full imposing body
- Size 3x3 (Huge, ~15ft): Huge creature — giant, young dragon, treant. Massive and powerful
- Size 4x4 (Gargantuan, ~20ft): Colossal creature — ancient dragon, kraken, tarrasque. Epic scale

Generate the character at the appropriate visual scale for the requested size. The image will be placed directly on a grid map as a game token.`;

const STYLE_PARAGRAPHS: Record<ArtStyle, string> = {
  jrpg: `- Clean sharp edges with visible linework, suitable for compositing onto any map background
- Style: Colorful JRPG / MapleStory-inspired 2D sprite art — chibi-proportioned with large expressive heads, big eyes, small bodies, thick clean outlines, cel-shaded flat colors, and a cute but detailed aesthetic. Think MapleStory character art, Ragnarok Online sprites, or chibi Final Fantasy Tactics portraits. Bright saturated candy-like colors, exaggerated accessories and weapons, charming and playful energy. Vibrant saturated colors, chibi/stylized proportions, detailed armor/clothing/features with an adorable flair.`,
  classic: `- Clean sharp edges with strong linework and painterly rendering, suitable for compositing onto any map background
- Style: Bold classic fantasy illustration in the tradition of D&D sourcebook art and Fire Emblem character portraits — detailed hand-painted look with realistic body proportions, rich color palette, dramatic lighting and shading. Think official Player's Handbook artwork, Pathfinder character portraits, or Fire Emblem Heroes full-body art. Heroic poses, intricate armor and clothing details, grounded and serious tone with a sense of epic adventure.`,
  pixel: `- Crisp pixel-perfect outlines with no anti-aliasing on edges, suitable for compositing onto any map background
- Style: HD-2D pixel art inspired by Octopath Traveler and Triangle Strategy — carefully placed pixels with rich sub-pixel shading, limited but expressive color palette, and a nostalgic retro RPG feel elevated by modern lighting techniques. Think classic SNES-era Final Fantasy sprites given HD treatment with soft bloom and depth. Dithering for gradients, detailed but readable at small sizes, charming and evocative.`,
};

const STYLE_PROMPT_HINTS: Record<ArtStyle, string> = {
  jrpg: "in colorful chibi JRPG sprite art style (MapleStory / Fire Emblem chibi)",
  classic: "in detailed classic fantasy illustration style (D&D sourcebook / Fire Emblem portrait)",
  pixel: "in HD-2D pixel art style (Octopath Traveler / Triangle Strategy sprites)",
};

function buildSystemInstruction(artStyle: ArtStyle): string {
  const styleLabel =
    artStyle === "jrpg" ? "a JRPG / MapleStory-inspired style" :
    artStyle === "classic" ? "a classic D&D sourcebook / Fire Emblem portrait style" :
    "an Octopath Traveler / Triangle Strategy HD-2D pixel art style";
  return `You are a 2D fantasy RPG character artist for virtual tabletop (VTT) games, drawing in ${styleLabel}.\n\n${SHARED_REQUIREMENTS}\n\n${STYLE_PARAGRAPHS[artStyle]}`;
}

export interface GeneratedImage {
  imageBase64: string;
  mimeType: string;
}

// --- Battlemap generation ---

export type MapArtStyle = "realistic" | "classic-fantasy" | "hd2d";

// Supported aspect ratios for Gemini imageConfig
const SUPPORTED_RATIOS = [
  { label: "1:1",  w: 1,  h: 1  },
  { label: "4:3",  w: 4,  h: 3  },
  { label: "3:4",  w: 3,  h: 4  },
  { label: "3:2",  w: 3,  h: 2  },
  { label: "2:3",  w: 2,  h: 3  },
  { label: "16:9", w: 16, h: 9  },
  { label: "9:16", w: 9,  h: 16 },
  { label: "21:9", w: 21, h: 9  },
] as const;

/**
 * Maps grid cell dimensions to the closest Gemini-supported aspect ratio.
 * Uses angular distance (atan2) to find the best match regardless of scale.
 */
function gridToAspectRatio(gridWidth: number, gridHeight: number): {
  ratio: string;
  ratioW: number;
  ratioH: number;
  orientation: "landscape" | "portrait" | "square";
} {
  const gridAngle = Math.atan2(gridHeight, gridWidth);

  let best: (typeof SUPPORTED_RATIOS)[number] = SUPPORTED_RATIOS[0]!;
  let bestDist = Infinity;

  for (const r of SUPPORTED_RATIOS) {
    const angle = Math.atan2(r.h, r.w);
    const dist = Math.abs(angle - gridAngle);
    if (dist < bestDist) {
      bestDist = dist;
      best = r;
    }
  }

  const orientation =
    best.w > best.h ? "landscape" : best.w < best.h ? "portrait" : "square";

  return { ratio: best.label, ratioW: best.w, ratioH: best.h, orientation };
}

const MAP_SHARED_REQUIREMENTS = `CRITICAL REQUIREMENTS:
- This is a 2D board game battlemap — bird's-eye view looking straight down, like a tabletop game board
- Objects like furniture, walls, trees, and terrain features CAN have stylized perspective and visual height — this is encouraged for readability. But the overall image must read as a flat 2D game board, NOT a 3D-rendered scene. No true 3D depth rendering, no raytracing, no photorealistic 3D
- Think of classic VTT (virtual tabletop) battlemaps — they show objects with slight artistic perspective for clarity while remaining fundamentally a flat 2D playing surface

SCALE IS CRITICAL — each grid cell = 5 feet:
- A human-sized creature occupies 1 cell (5ft). A door is about 1 cell wide. A standard table is 2-3 cells long. A large tree canopy is 2-4 cells across. A horse is about 2 cells long
- Buildings, rooms, corridors, and objects MUST be sized realistically relative to 5ft grid cells. A 10ft-wide corridor is 2 cells. A 20ft×30ft room is 4×6 cells. A tavern bar is 1 cell deep and several cells long
- Do NOT make buildings or objects unrealistically large or small — a tiny hut should NOT fill the entire map, and city blocks should have appropriately sized streets (2-4 cells wide) between them
- The total map area is specified in feet — use this to judge how much terrain fits. A 150ft×100ft map is a small encounter area (a building interior or small courtyard), while a 500ft×500ft map could show a village square

- Fill the ENTIRE image edge-to-edge — NO borders, margins, frames, UI elements, text labels, compass roses, or legends
- ABSOLUTELY NO grid lines, grid squares, grid overlay, hexagonal grid, or any visible grid pattern — the application overlays its own grid digitally, so the image must be a clean uninterrupted scene with NO drawn grid whatsoever
- Include natural environmental variation and interesting terrain features
- Lighting and shadows are fine for atmosphere and readability, but should serve the 2D board game aesthetic, not simulate a 3D environment`;

const MAP_STYLE_PARAGRAPHS: Record<MapArtStyle, string> = {
  realistic: `- Style: Photorealistic bird's-eye view — natural textures (stone, wood, grass, water), atmospheric lighting
- Think high-quality VTT battlemaps with photo-sourced textures — rich and detailed but still a 2D game board
- Rich detail in materials (cracked stone, wood grain, moss, rippling water)
- Objects and walls can show height and shadow for visual clarity`,
  "classic-fantasy": `- Style: Painted fantasy battlemap — soft watercolor washes, warm tones, subtle ink outlines
- Think official D&D adventure module maps or Roll20/Foundry premium map packs — painterly, atmospheric, colorful
- Rich color palette with soft edges, visible brushstrokes, warm lighting with gentle shadows
- Objects and terrain have a hand-painted quality but remain clear and readable for gameplay`,
  hd2d: `- Style: HD-2D pixel art battlemap — crisp pixel tiles with modern lighting, bloom, and depth-of-field effects layered on top
- Think Octopath Traveler or Triangle Strategy overworld maps — retro pixel foundations enhanced with contemporary rendering
- Limited but vibrant color palette, clear tile structure, pixel-perfect details with soft atmospheric glow
- Nostalgic 16-bit charm elevated by modern visual polish`,
};

const MAP_STYLE_PROMPT_HINTS: Record<MapArtStyle, string> = {
  realistic: "in photorealistic bird's-eye view with natural textures and atmospheric lighting",
  "classic-fantasy": "in painted fantasy watercolor style, bird's-eye view, soft washes and warm tones like a D&D adventure module map",
  hd2d: "in HD-2D pixel art style (Octopath Traveler / Triangle Strategy), bird's-eye view, retro pixel tiles with modern lighting",
};

function buildMapSystemInstruction(artStyle: MapArtStyle, gridWidth: number, gridHeight: number, cellSizeFt: number, aspect: { ratio: string; orientation: string }): string {
  const totalW = gridWidth * cellSizeFt;
  const totalH = gridHeight * cellSizeFt;
  return `You are a bird's-eye battlemap artist for tabletop RPGs (D&D 5e). You produce 2D game board surfaces suitable for placing tokens on.

Scale context: ${gridWidth}×${gridHeight} grid, ${cellSizeFt}ft per cell, covering ${totalW}ft × ${totalH}ft total area.
The image is ${aspect.ratio} ${aspect.orientation} format — fill the entire canvas edge-to-edge with the scene.

${MAP_SHARED_REQUIREMENTS}

${MAP_STYLE_PARAGRAPHS[artStyle]}`;
}

export async function generateBattlemap(
  apiKey: string,
  userPrompt: string,
  gridWidth: number,
  gridHeight: number,
  cellSizeFt: number = 5,
  artStyle: MapArtStyle = "realistic"
): Promise<GeneratedImage> {
  const ai = new GoogleGenAI({ apiKey });

  const totalW = gridWidth * cellSizeFt;
  const totalH = gridHeight * cellSizeFt;
  const aspect = gridToAspectRatio(gridWidth, gridHeight);
  const fullPrompt = `Generate a ${aspect.orientation} (${aspect.ratio}) bird's-eye 2D battlemap ${MAP_STYLE_PROMPT_HINTS[artStyle]}, representing ${totalW}ft × ${totalH}ft. This is a tabletop game board — not a 3D render. Do NOT draw any grid lines or grid overlay. Description: ${userPrompt}`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: fullPrompt,
    config: {
      systemInstruction: buildMapSystemInstruction(artStyle, gridWidth, gridHeight, cellSizeFt, aspect),
      responseModalities: ["image", "text"],
      imageConfig: {
        aspectRatio: aspect.ratio,
      },
    },
  });

  const part = response.candidates?.[0]?.content?.parts?.find(
    (p) => p.inlineData?.mimeType?.startsWith("image/")
  );

  if (!part?.inlineData?.data) {
    throw new Error("SAFETY_FILTER");
  }

  return {
    imageBase64: part.inlineData.data,
    mimeType: part.inlineData.mimeType ?? "image/png",
  };
}

export async function generateCharacterPortrait(
  apiKey: string,
  userPrompt: string,
  tokenSize: number = 1,
  artStyle: ArtStyle = "jrpg"
): Promise<GeneratedImage> {
  const ai = new GoogleGenAI({ apiKey });

  const sizeLabel =
    tokenSize >= 4 ? "4x4 Gargantuan" :
    tokenSize >= 3 ? "3x3 Huge" :
    tokenSize >= 2 ? "2x2 Large" :
    "1x1 Medium";

  const fullPrompt = `Generate a full-body character sprite (${sizeLabel} size) ${STYLE_PROMPT_HINTS[artStyle]} on a plain white (#FFFFFF) background, no frames or borders: ${userPrompt}`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: fullPrompt,
    config: {
      systemInstruction: buildSystemInstruction(artStyle),
      responseModalities: ["image", "text"],
    },
  });

  const part = response.candidates?.[0]?.content?.parts?.find(
    (p) => p.inlineData?.mimeType?.startsWith("image/")
  );

  if (!part?.inlineData?.data) {
    throw new Error("SAFETY_FILTER");
  }

  return {
    imageBase64: part.inlineData.data,
    mimeType: part.inlineData.mimeType ?? "image/png",
  };
}
