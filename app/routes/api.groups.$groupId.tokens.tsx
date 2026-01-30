import { eq, and } from "drizzle-orm";
import { db } from "~/.server/db";
import { maps, groupMembers, characters } from "~/.server/db/schema";
import { requireAuth } from "~/.server/auth/session";

interface TokenData {
  id: string;
  name: string;
  imageUrl: string | null;
  color: string;
  size: number;
  layer: string;
  characterSheet: unknown;
  characterId?: string | null;
}

interface MapData {
  tokens: TokenData[];
}

interface ImportableToken {
  id: string;
  name: string;
  imageUrl: string | null;
  color: string;
  size: number;
  layer: string;
  characterSheet: unknown;
  characterId: string | null;
  source: "library" | "map";
  sourceMapId?: string;
  sourceMapName?: string;
}

/**
 * GET /api/groups/:groupId/tokens
 * Returns importable tokens from:
 * 1. Character library (shared characters in this group)
 * 2. Embedded tokens from maps (fallback for non-library tokens)
 *
 * Query params:
 *   - layer: Filter by token layer (character, monster, object). Default: character only
 *   - all: If "true", returns all tokens regardless of layer
 *   - source: "library" for library only, "maps" for map tokens only, default both
 */
export async function loader({ request, params }: { request: Request; params: { groupId: string } }) {
  const session = await requireAuth(request);
  const userId = session.user.id;
  const { groupId } = params;

  // Verify user is a member of this group
  const membership = await db
    .select()
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .limit(1);

  if (membership.length === 0) {
    return Response.json({ error: "Not a member of this group" }, { status: 403 });
  }

  // Parse query params
  const url = new URL(request.url);
  const layerFilter = url.searchParams.get("layer") || "character";
  const includeAll = url.searchParams.get("all") === "true";
  const sourceFilter = url.searchParams.get("source"); // "library", "maps", or null (both)

  const importableTokens: ImportableToken[] = [];
  const seenNames = new Set<string>();

  // 1. Get characters from the library (priority)
  if (sourceFilter !== "maps") {
    const libraryCharacters = await db
      .select()
      .from(characters)
      .where(eq(characters.groupId, groupId));

    for (const char of libraryCharacters) {
      if (!includeAll && char.layer !== layerFilter) continue;

      const normalizedName = char.name.toLowerCase().trim();
      seenNames.add(normalizedName);

      importableTokens.push({
        id: char.id,
        name: char.name,
        imageUrl: char.imageUrl,
        color: char.color,
        size: char.size,
        layer: char.layer,
        characterSheet: char.characterSheet,
        characterId: char.id, // Link to this library character
        source: "library",
      });
    }
  }

  // 2. Get embedded tokens from maps (only ones not already in library)
  if (sourceFilter !== "library") {
    const groupMaps = await db
      .select({
        id: maps.id,
        name: maps.name,
        data: maps.data,
      })
      .from(maps)
      .where(eq(maps.groupId, groupId));

    for (const map of groupMaps) {
      const mapData = map.data as MapData | null;
      if (!mapData?.tokens) continue;

      for (const token of mapData.tokens) {
        if (!includeAll && token.layer !== layerFilter) continue;

        // Skip if already have a library character with same name
        const normalizedName = token.name.toLowerCase().trim();
        if (seenNames.has(normalizedName)) continue;
        seenNames.add(normalizedName);

        // Skip if this token is already linked to a library character
        if (token.characterId) continue;

        importableTokens.push({
          id: token.id,
          name: token.name,
          imageUrl: token.imageUrl,
          color: token.color,
          size: token.size,
          layer: token.layer,
          characterSheet: token.characterSheet || null,
          characterId: null,
          source: "map",
          sourceMapId: map.id,
          sourceMapName: map.name,
        });
      }
    }
  }

  // Sort: library first, then by name
  importableTokens.sort((a, b) => {
    if (a.source !== b.source) {
      return a.source === "library" ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  return Response.json({ tokens: importableTokens });
}
