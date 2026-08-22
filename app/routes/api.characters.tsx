import { eq, desc } from "drizzle-orm";
import { db } from "~/.server/db";
import { characters } from "~/.server/db/schema";
import { requireAuth } from "~/.server/auth/session";
import { getUserTierLimits } from "~/.server/subscription";
import { validateOwnedImageUrls } from "~/.server/uploads/image-validation";
import { compileCharacterBuild } from "~/features/character-creator/rules/compile-build";

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

  // Check tier permission
  const limits = await getUserTierLimits(userId);
  if (!limits.characterLibrary) {
    return Response.json(
      { error: "Character sheet library requires a paid subscription.", upgrade: true },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { name, imageUrl, color, size, layer, characterSheet } = body;

  let persistedCharacterSheet = characterSheet || null;
  let persistedName = typeof name === "string" ? name.trim() : "";
  let persistedLayer = layer || "character";
  if (body.guidedBuild !== undefined) {
    if (layer !== undefined && layer !== "character") {
      return Response.json(
        { error: "Guided player characters must use the character layer." },
        { status: 400 },
      );
    }

    const compiled = compileCharacterBuild(body.guidedBuild, new Date().toISOString());
    if (!compiled.valid) {
      return Response.json(
        { error: "Invalid guided character build", errors: compiled.errors },
        { status: 400 },
      );
    }
    // The validated build is authoritative for guided metadata. Ignore any
    // conflicting top-level name supplied by the caller.
    persistedName = compiled.build.name;
    persistedLayer = "character";
    persistedCharacterSheet = compiled.sheet;
  }

  if (!persistedName) {
    return Response.json({ error: "Name is required" }, { status: 400 });
  }

  const imageValidation = await validateOwnedImageUrls(userId, [imageUrl], { type: "token" });
  if (!imageValidation.valid) {
    return Response.json({ error: imageValidation.error }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const now = new Date();

  await db.insert(characters).values({
    id,
    userId,
    name: persistedName,
    imageUrl: imageUrl || null,
    color: color || "#ef4444",
    size: size || 1,
    layer: persistedLayer,
    characterSheet: persistedCharacterSheet,
    createdAt: now,
    updatedAt: now,
  });

  const [created] = await db.select().from(characters).where(eq(characters.id, id));

  return Response.json({ character: created });
}
