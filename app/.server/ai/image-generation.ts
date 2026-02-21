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
