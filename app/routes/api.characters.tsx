import { eq, isNull, and, desc } from "drizzle-orm";
import { db } from "~/.server/db";
import { characters, groupMembers } from "~/.server/db/schema";
import { requireAuth } from "~/.server/auth/session";

/**
 * GET /api/characters
 * Returns only the current user's characters:
 * - Personal characters (groupId is null)
 * - Group characters (assigned to a group)
 *
 * Users can only see their own characters, not other group members' characters.
 *
 * Query params:
 *   - groupId: Filter by specific group (or "personal" for personal only)
 */
export async function loader({ request }: { request: Request }) {
  const session = await requireAuth(request);
  const userId = session.user.id;

  const url = new URL(request.url);
  const groupIdFilter = url.searchParams.get("groupId");

  let query;

  if (groupIdFilter === "personal") {
    // Only personal characters (no group)
    query = db
      .select()
      .from(characters)
      .where(and(eq(characters.userId, userId), isNull(characters.groupId)))
      .orderBy(desc(characters.updatedAt));
  } else if (groupIdFilter) {
    // Specific group's characters owned by this user
    query = db
      .select()
      .from(characters)
      .where(and(eq(characters.userId, userId), eq(characters.groupId, groupIdFilter)))
      .orderBy(desc(characters.updatedAt));
  } else {
    // All of this user's characters (personal + all groups)
    query = db
      .select()
      .from(characters)
      .where(eq(characters.userId, userId))
      .orderBy(desc(characters.updatedAt));
  }

  const result = await query;

  return Response.json({ characters: result });
}

/**
 * POST /api/characters
 * Create a new character
 */
export async function action({ request }: { request: Request }) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const session = await requireAuth(request);
  const userId = session.user.id;

  const body = await request.json();
  const { name, imageUrl, color, size, layer, characterSheet, groupId } = body;

  if (!name?.trim()) {
    return Response.json({ error: "Name is required" }, { status: 400 });
  }

  // If groupId is provided, verify user is a member
  if (groupId) {
    const membership = await db
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
      .limit(1);

    if (membership.length === 0) {
      return Response.json({ error: "Not a member of this group" }, { status: 403 });
    }
  }

  const id = crypto.randomUUID();
  const now = new Date();

  await db.insert(characters).values({
    id,
    userId,
    groupId: groupId || null,
    name: name.trim(),
    imageUrl: imageUrl || null,
    color: color || "#ef4444",
    size: size || 1,
    layer: layer || "character",
    characterSheet: characterSheet || null,
    createdAt: now,
    updatedAt: now,
  });

  const [created] = await db.select().from(characters).where(eq(characters.id, id));

  return Response.json({ character: created });
}
