import { eq } from "drizzle-orm";
import { db } from "~/.server/db";
import { characters } from "~/.server/db/schema";
import { requireAuth } from "~/.server/auth/session";
import { validateOwnedImageUrls } from "~/.server/uploads/image-validation";
import { cleanupDeletedRecordImages } from "~/.server/uploads/lifecycle";
import { compileCharacterBuild } from "~/features/character-creator/rules/compile-build";
import { preserveRuntimeSheetState } from "~/features/character-creator/rules/recompile-token";
import { hasRulesDerivedManualChanges, invalidateGuidedSheet } from "~/features/character-creator/rules/provenance";
import type { CharacterSheet } from "~/features/map-editor/types";

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

    const imageUrl = access.character?.imageUrl;
    const ownerId = access.character?.userId;
    await db.delete(characters).where(eq(characters.id, characterId));

    if (imageUrl && ownerId) {
      try {
        await cleanupDeletedRecordImages([imageUrl], ownerId);
      } catch (error) {
        console.error("Character deleted, but image cleanup failed:", error);
      }
    }

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

    const hasGuidedBuild = body.guidedBuild !== undefined;

    // Only allow updating certain fields
    if (!hasGuidedBuild && body.name !== undefined) updates.name = body.name;
    if (body.imageUrl !== undefined) {
      const imageValidation = await validateOwnedImageUrls(userId, [body.imageUrl], {
        allowedExistingUrls: access.character?.imageUrl ? [access.character.imageUrl] : [],
        type: "token",
      });
      if (!imageValidation.valid) {
        return Response.json({ error: imageValidation.error }, { status: 400 });
      }
      updates.imageUrl = body.imageUrl || null;
    }
    if (body.color !== undefined) updates.color = body.color;
    if (body.size !== undefined) updates.size = body.size;
    if (body.layer !== undefined) {
      if (hasGuidedBuild && body.layer !== "character") {
        return Response.json(
          { error: "Guided player characters must use the character layer." },
          { status: 400 },
        );
      }
      updates.layer = body.layer;
    }
    if (hasGuidedBuild) {
      if (access.character?.layer !== "character") {
        return Response.json(
          { error: "Guided builds can only update character-layer records." },
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
      // Never trust a client-provided sheet when a guided build is submitted.
      // The validated build is also authoritative for the stored name.
      updates.name = compiled.build.name;
      // Preserve runtime-only state while replacing the rules-derived sheet.
      updates.characterSheet = preserveRuntimeSheetState(
        compiled.sheet,
        access.character?.characterSheet,
      );
    } else if (body.characterSheet !== undefined) {
      // Preserve the existing manual/import/monster compatibility path.
      const previousSheet = access.character?.characterSheet as CharacterSheet | null | undefined;
      if (
        previousSheet?.creationBuild &&
        body.characterSheet &&
        typeof body.characterSheet === "object" &&
        !Array.isArray(body.characterSheet)
      ) {
        const changedFields = Object.fromEntries(
          Object.keys(body.characterSheet).filter((fieldName) =>
            JSON.stringify((body.characterSheet as Record<string, unknown>)[fieldName]) !== JSON.stringify((previousSheet as unknown as Record<string, unknown>)[fieldName]),
          ).map((fieldName) => [fieldName, (body.characterSheet as Record<string, unknown>)[fieldName]]),
        ) as Partial<CharacterSheet>;
        updates.characterSheet = hasRulesDerivedManualChanges(changedFields, previousSheet)
          ? invalidateGuidedSheet(body.characterSheet as CharacterSheet)
          : body.characterSheet;
      } else {
        updates.characterSheet = body.characterSheet;
      }
    }

    await db.update(characters).set(updates).where(eq(characters.id, characterId));

    const [updated] = await db.select().from(characters).where(eq(characters.id, characterId));

    return Response.json({ character: updated });
  }

  return new Response("Method not allowed", { status: 405 });
}
