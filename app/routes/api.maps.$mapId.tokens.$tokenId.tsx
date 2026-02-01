import type { Route } from "./+types/api.maps.$mapId.tokens.$tokenId";
import { eq } from "drizzle-orm";
import { db } from "~/.server/db";
import { maps } from "~/.server/db/schema";
import { requireAuth } from "~/.server/auth/session";
import { requireMapPermission } from "~/.server/permissions/map-permissions";

interface Token {
  id: string;
  ownerId: string | null;
  [key: string]: unknown;
}

interface MapData {
  tokens: Token[];
  [key: string]: unknown;
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
        .select({ data: maps.data })
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
        const newToken: Token = {
          id: tokenId,
          ownerId: body.ownerId ?? null,
          characterSheet: body.characterSheet ?? null,
          characterId: body.characterId ?? null,
          ...body,
        };

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

      // Update the token
      const updatedToken = { ...currentToken, ...body };
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
