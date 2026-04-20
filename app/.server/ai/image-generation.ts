import { GoogleGenAI } from "@google/genai";
import type { PortraitArtStyle } from "~/features/map-editor/portrait-styles";

// Chroma key color — pure white, universally understood by AI models
export const CHROMA_KEY_R = 255;
export const CHROMA_KEY_G = 255;
export const CHROMA_KEY_B = 255;

export type ArtStyle = PortraitArtStyle;

const SHARED_REQUIREMENTS = `CRITICAL REQUIREMENTS:
- The background MUST be solid pure white (#FFFFFF). Fill the ENTIRE background with flat white, no gradients, no shadows, no floor, no scenery
- The character must have clear contrast against the white background — avoid white clothing or armor unless it has visible outlines/shading to distinguish it
- ABSOLUTELY NO frames, borders, circles, rings, medallions, pedestals, platforms, or any UI elements around the character. The output must be ONLY the character on solid white. If you are tempted to add a circular token frame — DO NOT. This is not a token with a frame, it is a raw character sprite
- Render a full-body character in a 2D illustrated style — NOT 3D rendered, NOT photorealistic
- Front-facing or slight 3/4 angle, full body visible head to feet, dynamic but readable pose
- ANATOMY RULE: Unless the prompt explicitly states otherwise, assume the character is a standard humanoid with exactly 2 arms and 2 legs. Do NOT add extra limbs, tails, wings, tentacles, or other additional body parts unless the prompt specifically requests them

TOKEN SIZE GUIDELINES (D&D 5e grid, each cell = 5 feet):
- Size 1x1 (Medium, ~5ft): Single humanoid or medium creature. Standard adventurer, human, elf, dwarf, etc.
- Size 2x2 (Large, ~10ft): Large creature — ogre, horse, dire wolf, centaur. Show full imposing body
- Size 3x3 (Huge, ~15ft): Huge creature — giant, young dragon, treant. Massive and powerful
- Size 4x4 (Gargantuan, ~20ft): Colossal creature — ancient dragon, kraken, tarrasque. Epic scale

Generate the character at the appropriate visual scale for the requested size. The image will be placed directly on a grid map as a game token.`;

const STYLE_PARAGRAPHS: Record<ArtStyle, string> = {
  chibi: `- Clean sharp edges with visible linework, suitable for compositing onto any map background
- Style: Colorful JRPG / MapleStory-inspired 2D chibi sprite art — cute and rounded. The HEAD is large, round, and soft with big expressive eyes, small rounded nose/mouth, and soft chubby cheeks — face roundness is important, do NOT make the face angular or sharp-jawed. The BODY is compact and chibi-proportioned at roughly 2–3 heads tall total (including the head) — small but clearly readable torso, arms, and legs with gentle articulation. Limbs can be slightly stubby/rounded (chibi charm) but still show shape — NOT a blob, NOT stick-thin, and NOT adult-proportioned. Think MapleStory player sprites, Fire Emblem Heroes chibi portraits, Granblue Fantasy chibi art, or Disgaea sprites — adorably small bodies under a big round head. Thick clean outlines, cel-shaded flat colors, bright saturated candy-like palette, soft highlights on cheeks/hair for extra cuteness, exaggerated accessories and weapons. Overall vibe: charming, huggable, playful — maximum cute factor while staying readable as a game token.`,
  fantasy: `- Clean sharp edges with crisp anime linework and cel-shaded rendering, suitable for compositing onto any map background
- Style: Modern anime and Chinese manhua (donghua) fantasy illustration — sharp confident line art, cel-shaded lighting with clean highlight/shadow separation, xianxia/wuxia-inflected character design with anime-proportioned bodies (tall, slender, stylized but not chibi), expressive faces, and elaborate flowing hair. Think Mo Dao Zu Shi (Grandmaster of Demonic Cultivation), Heaven Official's Blessing, Soul Land (Douluo Dalu), Battle Through the Heavens (Doupo Cangqiong), and modern Chinese 3D donghua character art. Rich saturated colors with dramatic rim lighting, ornate cultivator robes and intricate fantasy armor with flowing cloth and ribbons, heroic dynamic poses, cool and cinematic tone with a sense of epic cultivation-era adventure.`,
  pixel: `- CHUNKY VISIBLE PIXELS — every edge, shadow, and color transition must be made of clearly readable square pixels. NO smooth anti-aliased curves. NO painterly brushwork. NO airbrushed gradients. If you zoom in you should see individual pixel tiles
- Style: 16-bit JRPG sprite art in the HD-2D tradition of Octopath Traveler, Triangle Strategy, and SNES-era Final Fantasy / Chrono Trigger character sprites. Strict pixel art discipline — limited indexed palette (roughly 16-32 colors per character), hand-placed dithering for any gradients, hard pixel edges on outlines and shading. The "HD" in HD-2D refers ONLY to soft ambient lighting and gentle bloom around the silhouette — the character itself remains unmistakably pixelated sprite art, not painted illustration. Think of a high-resolution screenshot of a SNES sprite — readable, iconic, blocky, nostalgic.`,
};

const STYLE_PROMPT_HINTS: Record<ArtStyle, string> = {
  chibi: "in cute colorful chibi JRPG sprite art (MapleStory / Fire Emblem Heroes / Disgaea) — large round soft face with big expressive eyes and chubby cheeks, compact chibi body roughly 2–3 heads tall with small but readable torso and limbs",
  fantasy: "in modern anime / Chinese manhua (donghua) fantasy illustration style (Mo Dao Zu Shi / Heaven Official's Blessing / Soul Land / Battle Through the Heavens), sharp cel-shaded line art with xianxia flair",
  pixel: "as a chunky 16-bit pixel-art sprite (HD-2D / Octopath Traveler / SNES Final Fantasy), visible square pixels, no painterly rendering",
};

function buildSystemInstruction(artStyle: ArtStyle): string {
  const styleLabel =
    artStyle === "chibi" ? "a cute chibi / MapleStory-inspired style — large round soft face with big eyes and chubby cheeks, compact chibi body roughly 2–3 heads tall" :
    artStyle === "fantasy" ? "a modern anime / Chinese manhua (donghua) fantasy portrait style (Mo Dao Zu Shi / Heaven Official's Blessing / Soul Land / Battle Through the Heavens)" :
    "an Octopath Traveler / Triangle Strategy HD-2D pixel art style";
  return `You are a 2D fantasy RPG character artist for virtual tabletop (VTT) games, drawing in ${styleLabel}.\n\n${SHARED_REQUIREMENTS}\n\n${STYLE_PARAGRAPHS[artStyle]}`;
}

export interface GeneratedImage {
  imageBase64: string;
  mimeType: string;
}

export interface ReferenceImage {
  base64: string;
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
- Lighting and shadows are fine for atmosphere and readability, but should serve the 2D board game aesthetic, not simulate a 3D environment

DUNGEON CRAWLING LAYOUT RULES (apply unless the prompt explicitly describes an open/outdoor area):
- Default to dungeon interiors — stone corridors, underground passages, cave tunnels, castle hallways, crypt passages, or similar enclosed spaces
- Corridors should be NARROW: typically 2-3 cells (10-15ft) wide. Avoid wide open hallways — tight spaces create tension and tactical decisions
- Include winding pathways, T-junctions, forks, and dead ends to create exploration and navigational choices
- Scatter 2-4 encounter chambers along the corridors — these can range from 3×3 cells (small skirmish) up to 7×7 cells (medium encounter), sized to fit the dungeon's scale
- Include at least one boss chamber: 8×8 to 12×12 cells, with distinct visual features (pillars, elevated platform, ritual circle, throne, etc.)
- Room shapes should VARY — don't make every room a plain box. Use rectangles, L-shapes, and irregular outlines. Visually, rooms can appear as octagons, circles, cavern shapes, or any organic form — but the actual walkable floor area should resolve to a square or rectangular footprint for grid-based token movement
- Mix room sizes and proportions: some tall-narrow (3×6), some wide (6×4), some roughly square — variety makes exploration feel rewarding
- Walls should be clearly visible and distinct from floor — use strong contrast between walkable floor and solid walls/rock
- Add environmental details that reward exploration: alcoves, collapsed sections, rubble, cracks, dripping water, torches, scattered bones, broken furniture, or dungeon dressing appropriate to the theme
- Corridors should connect rooms meaningfully — avoid isolated rooms floating in empty space. The layout should feel like a cohesive underground structure
- If the prompt mentions "open area", "outdoor", "forest", "field", "village", "town", "city", or similar outdoor/open themes, IGNORE these dungeon rules and generate an appropriate open environment instead`;

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
  artStyle: MapArtStyle = "realistic",
  referenceImage?: ReferenceImage
): Promise<GeneratedImage> {
  const ai = new GoogleGenAI({ apiKey });

  const totalW = gridWidth * cellSizeFt;
  const totalH = gridHeight * cellSizeFt;
  const aspect = gridToAspectRatio(gridWidth, gridHeight);

  const isEdit = !!referenceImage;
  const fullPrompt = isEdit
    ? `Edit this existing battlemap image based on the following instructions. Keep the overall composition, layout, and style consistent with the original. Apply these changes: ${userPrompt}. Output a ${aspect.orientation} (${aspect.ratio}) bird's-eye 2D battlemap ${MAP_STYLE_PROMPT_HINTS[artStyle]}, representing ${totalW}ft × ${totalH}ft. Do NOT draw any grid lines or grid overlay.`
    : `Generate a ${aspect.orientation} (${aspect.ratio}) bird's-eye 2D battlemap ${MAP_STYLE_PROMPT_HINTS[artStyle]}, representing ${totalW}ft × ${totalH}ft. This is a tabletop game board — not a 3D render. Do NOT draw any grid lines or grid overlay. Description: ${userPrompt}`;

  // Build multimodal content when reference image is provided
  const contents = referenceImage
    ? [
        { inlineData: { mimeType: referenceImage.mimeType, data: referenceImage.base64 } },
        { text: fullPrompt },
      ]
    : fullPrompt;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents,
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
  artStyle: ArtStyle = "chibi",
  referenceImage?: ReferenceImage
): Promise<GeneratedImage> {
  const ai = new GoogleGenAI({ apiKey });

  const sizeLabel =
    tokenSize >= 4 ? "4x4 Gargantuan" :
    tokenSize >= 3 ? "3x3 Huge" :
    tokenSize >= 2 ? "2x2 Large" :
    "1x1 Medium";

  const isEdit = !!referenceImage;
  const fullPrompt = isEdit
    ? `Edit this existing character image based on the following instructions. CRITICAL: You MUST preserve the character's facial features — face shape, eye color, eye shape, nose, mouth, hair color, hairstyle, skin tone, and any distinctive facial marks (scars, tattoos, freckles). The edited character must be clearly recognizable as the same person. Apply these changes: ${userPrompt}. Output a full-body character sprite (${sizeLabel} size) ${STYLE_PROMPT_HINTS[artStyle]} on a plain white (#FFFFFF) background, no frames or borders.`
    : `Generate a full-body character sprite (${sizeLabel} size) ${STYLE_PROMPT_HINTS[artStyle]} on a plain white (#FFFFFF) background, no frames or borders: ${userPrompt}`;

  // Build multimodal content when reference image is provided
  const contents = referenceImage
    ? [
        { inlineData: { mimeType: referenceImage.mimeType, data: referenceImage.base64 } },
        { text: fullPrompt },
      ]
    : fullPrompt;

  const systemInstruction = isEdit
    ? buildSystemInstruction(artStyle) + `\n\nEDITING MODE: A reference image of an existing character is provided. You MUST preserve the character's identity — their facial features (face shape, eyes, nose, mouth, hair, skin tone, distinguishing marks) must remain recognizable in the output. Only modify what the user explicitly requests. Everything else — especially the face — should stay as close to the original as possible.`
    : buildSystemInstruction(artStyle);

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents,
    config: {
      systemInstruction,
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
