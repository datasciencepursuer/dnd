import { eq, desc } from "drizzle-orm";
import { db } from "~/.server/db";
import { characters } from "~/.server/db/schema";
import { requireAuth } from "~/.server/auth/session";

/**
 * GET /api/characters
 * Returns all of the current user's characters sorted by updatedAt.
 */
export async function loader({ request }: { request: Request }) {
  const session = await requireAuth(request);
  const userId = session.user.id;

  const result = await db
    .select()
    .from(characters)
    .where(eq(characters.userId, userId))
    .orderBy(desc(characters.updatedAt));

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
  const { name, imageUrl, color, size, layer, characterSheet } = body;

  if (!name?.trim()) {
    return Response.json({ error: "Name is required" }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const now = new Date();

  await db.insert(characters).values({
    id,
    userId,
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
