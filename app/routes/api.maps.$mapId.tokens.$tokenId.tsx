import type { Route } from "./+types/api.maps.$mapId.tokens.$tokenId";
import { eq } from "drizzle-orm";
import { db } from "~/.server/db";
import { characters, maps } from "~/.server/db/schema";
import { requireAuth } from "~/.server/auth/session";
import { requireMapPermission } from "~/.server/permissions/map-permissions";
import { validateOwnedImageUrls } from "~/.server/uploads/image-validation";
import { recompileGuidedToken } from "~/features/character-creator/rules/recompile-token";

interface Token {
  id: string;
  ownerId: string | null;
  [key: string]: unknown;
}

interface MapData {
  tokens: Token[];
  [key: string]: unknown;
}

async function canLinkCharacter(userId: string, characterId: unknown): Promise<boolean> {
  if (characterId === undefined || characterId === null) return true;
  if (typeof characterId !== "string" || !characterId) return false;
  const [character] = await db
    .select({ userId: characters.userId })
    .from(characters)
    .where(eq(characters.id, characterId))
    .limit(1);
  return character?.userId === userId;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function recompilePersistedToken(
  token: Token,
  existingToken: Token | undefined,
  generatedAt: string,
) {
  // Older clients may omit the optional build while updating a guided token.
  // Keep the stored source build authoritative unless it is explicitly null.
  const hasSubmittedBuild = Object.prototype.hasOwnProperty.call(token, "characterCreationBuild");
  const tokenForCompilation = !hasSubmittedBuild && existingToken?.characterCreationBuild !== undefined
    ? { ...token, characterCreationBuild: existingToken.characterCreationBuild }
    : token;

  return recompileGuidedToken(tokenForCompilation, generatedAt);
}

export async function action({ request, params }: Route.ActionArgs) {
  const session = await requireAuth(request);
  const { mapId, tokenId } = params;

  if (!mapId || !tokenId) {
    return new Response("Map ID and Token ID required", { status: 400 });
  }

  switch (request.method) {
    case "DELETE": {
      // Check at least view permission (all group members can access)
      const access = await requireMapPermission(mapId, session.user.id, "view");
      const isDM = access.isDungeonMaster;

      // Get current map data
      const mapData = await db
        .select({ data: maps.data })
        .from(maps)
        .where(eq(maps.id, mapId))
        .limit(1);

      if (mapData.length === 0) {
        return new Response("Map not found", { status: 404 });
      }

      const currentData = mapData[0].data as MapData;
      const token = currentData.tokens.find((t) => t.id === tokenId);

      if (!token) {
        return new Response("Token not found", { status: 404 });
      }

      // Check permission to delete this token
      // DM can delete any token, players can only delete their own
      const isOwner = token.ownerId === session.user.id || (token.ownerId === null && isDM);
      if (!isDM && !isOwner) {
        return new Response("Cannot delete tokens you don't own", { status: 403 });
      }

      // Remove the token
      const updatedTokens = currentData.tokens.filter((t) => t.id !== tokenId);
      const updatedData = {
        ...currentData,
        tokens: updatedTokens,
        updatedAt: new Date().toISOString(),
      };

      await db
        .update(maps)
        .set({ data: updatedData, updatedAt: new Date() })
        .where(eq(maps.id, mapId));

      return Response.json({ success: true });
    }

    case "PUT": {
      // Check at least view permission (all group members can access)
      const access = await requireMapPermission(mapId, session.user.id, "view");
      const isDM = access.isDungeonMaster;

      const body = await request.json();

      // Get current map data
      const mapData = await db
        .select({ data: maps.data, userId: maps.userId, groupId: maps.groupId })
        .from(maps)
        .where(eq(maps.id, mapId))
        .limit(1);

      if (mapData.length === 0) {
        return new Response("Map not found", { status: 404 });
      }

      const currentData = mapData[0].data as MapData;
      const tokenIndex = currentData.tokens.findIndex((t) => t.id === tokenId);

      if (tokenIndex === -1) {
        // Token doesn't exist - this is a create operation
        // All users can create tokens, but players must set themselves as owner
        if (!isDM && body.ownerId !== session.user.id) {
          return new Response("Cannot create tokens for other users", { status: 403 });
        }

        // Create new token with the provided ID
        const rawNewToken: Token = {
          id: tokenId,
          ownerId: body.ownerId ?? null,
          characterSheet: body.characterSheet ?? null,
          characterId: body.characterId ?? null,
          monsterGroupId: body.monsterGroupId ?? null,
          ...body,
        };

        if (!(await canLinkCharacter(session.user.id, rawNewToken.characterId))) {
          return Response.json({ error: "Character link is not valid" }, { status: 403 });
        }

        const compiledToken = recompilePersistedToken(rawNewToken, undefined, new Date().toISOString());
        if (!compiledToken.valid) {
          return Response.json(
            { error: "Invalid guided token build", errors: compiledToken.errors },
            { status: 400 },
          );
        }
        const newToken = compiledToken.token as Token;

        const imageValidation = await validateOwnedImageUrls(session.user.id, [newToken.imageUrl], {
          type: "token",
          ...(mapData[0].groupId ? { groupId: mapData[0].groupId } : {}),
        });
        if (!imageValidation.valid) {
          return Response.json({ error: imageValidation.error }, { status: 400 });
        }
        if (newToken.imageUrl === "") newToken.imageUrl = null;

        const updatedData = {
          ...currentData,
          tokens: [...currentData.tokens, newToken],
          updatedAt: new Date().toISOString(),
        };

        await db
          .update(maps)
          .set({ data: updatedData, updatedAt: new Date() })
          .where(eq(maps.id, mapId));

        return Response.json({ success: true, created: true });
      }

      const currentToken = currentData.tokens[tokenIndex];

      // Check permission to edit this token
      // DM can edit any token, players can only edit their own
      const isOwner = currentToken.ownerId === session.user.id || (currentToken.ownerId === null && isDM);
      if (!isDM && !isOwner) {
        return new Response("Cannot edit tokens you don't own", { status: 403 });
      }

      // Only DM can change token ownership
      if (!isDM && body.ownerId !== undefined && body.ownerId !== currentToken.ownerId) {
        return new Response("Only the DM can change token ownership", { status: 403 });
      }

      if (body.characterId !== undefined && !(await canLinkCharacter(session.user.id, body.characterId))) {
        return Response.json({ error: "Character link is not valid" }, { status: 403 });
      }

      // Update the token
      let rawUpdatedToken: Token = { ...currentToken, ...body };
      if (
        rawUpdatedToken.characterCreationBuild !== undefined &&
        rawUpdatedToken.characterCreationBuild !== null &&
        currentToken.characterSheet !== undefined
      ) {
        const existingSheet = isRecord(currentToken.characterSheet) ? currentToken.characterSheet : {};
        const submittedSheet = isRecord(rawUpdatedToken.characterSheet)
          ? rawUpdatedToken.characterSheet
          : {};
        rawUpdatedToken = {
          ...rawUpdatedToken,
          characterSheet: { ...existingSheet, ...submittedSheet },
        };
      }
      const compiledToken = recompilePersistedToken(rawUpdatedToken, currentToken, new Date().toISOString());
      if (!compiledToken.valid) {
        return Response.json(
          { error: "Invalid guided token build", errors: compiledToken.errors },
          { status: 400 },
        );
      }
      const updatedToken = compiledToken.token as Token;
      const currentImageUrl = typeof currentToken.imageUrl === "string" ? currentToken.imageUrl : null;
      const imageValidation = await validateOwnedImageUrls(session.user.id, [updatedToken.imageUrl], {
        allowedExistingUrls: currentImageUrl ? [currentImageUrl] : [],
        type: "token",
        ...(mapData[0].groupId ? { groupId: mapData[0].groupId } : {}),
      });
      if (!imageValidation.valid) {
        return Response.json({ error: imageValidation.error }, { status: 400 });
      }
      if (updatedToken.imageUrl === "") updatedToken.imageUrl = null;
      const updatedTokens = [...currentData.tokens];
      updatedTokens[tokenIndex] = updatedToken;

      const updatedData = {
        ...currentData,
        tokens: updatedTokens,
        updatedAt: new Date().toISOString(),
      };

      await db
        .update(maps)
        .set({ data: updatedData, updatedAt: new Date() })
        .where(eq(maps.id, mapId));

      return Response.json({ success: true });
    }

    default:
      return new Response("Method not allowed", { status: 405 });
  }
}
