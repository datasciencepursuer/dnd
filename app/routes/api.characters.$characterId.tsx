import { eq } from "drizzle-orm";
import { db } from "~/.server/db";
import { characters } from "~/.server/db/schema";
import { requireAuth } from "~/.server/auth/session";

async function canAccessCharacter(userId: string, characterId: string) {
  // Get the character
  const [character] = await db
    .select()
    .from(characters)
    .where(eq(characters.id, characterId))
    .limit(1);

  if (!character) {
    return { allowed: false, character: null, reason: "not_found" };
  }

  // Only owner has access
  if (character.userId === userId) {
    return { allowed: true, character };
  }

  return { allowed: false, character: null, reason: "forbidden" };
}

/**
 * GET /api/characters/:characterId
 * Get a single character
 */
export async function loader({ request, params }: { request: Request; params: { characterId: string } }) {
  const session = await requireAuth(request);
  const { characterId } = params;

  const access = await canAccessCharacter(session.user.id, characterId);

  if (!access.allowed) {
    if (access.reason === "not_found") {
      return Response.json({ error: "Character not found" }, { status: 404 });
    }
    return Response.json({ error: "Access denied" }, { status: 403 });
  }

  return Response.json({ character: access.character });
}

/**
 * PUT /api/characters/:characterId
 * Update a character
 */
export async function action({ request, params }: { request: Request; params: { characterId: string } }) {
  const session = await requireAuth(request);
  const userId = session.user.id;
  const { characterId } = params;

  if (request.method === "DELETE") {
    const access = await canAccessCharacter(userId, characterId);

    if (!access.allowed) {
      if (access.reason === "not_found") {
        return Response.json({ error: "Character not found" }, { status: 404 });
      }
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    await db.delete(characters).where(eq(characters.id, characterId));

    return Response.json({ success: true });
  }

  if (request.method === "PUT") {
    const access = await canAccessCharacter(userId, characterId);

    if (!access.allowed) {
      if (access.reason === "not_found") {
        return Response.json({ error: "Character not found" }, { status: 404 });
      }
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    // Only allow updating certain fields
    if (body.name !== undefined) updates.name = body.name;
    if (body.imageUrl !== undefined) updates.imageUrl = body.imageUrl;
    if (body.color !== undefined) updates.color = body.color;
    if (body.size !== undefined) updates.size = body.size;
    if (body.layer !== undefined) updates.layer = body.layer;
    if (body.characterSheet !== undefined) updates.characterSheet = body.characterSheet;

    await db.update(characters).set(updates).where(eq(characters.id, characterId));

    const [updated] = await db.select().from(characters).where(eq(characters.id, characterId));

    return Response.json({ character: updated });
  }

  return new Response("Method not allowed", { status: 405 });
}
