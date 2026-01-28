import type { Route } from "./+types/api.maps.$mapId.tokens.$tokenId.move";
import { eq } from "drizzle-orm";
import { db } from "~/.server/db";
import { maps } from "~/.server/db/schema";
import { requireAuth } from "~/.server/auth/session";
import { requireMapPermission, getEffectivePermissions } from "~/.server/permissions/map-permissions";
import type { DnDMap } from "~/features/map-editor";

export async function action({ request, params }: Route.ActionArgs) {
  const session = await requireAuth(request);
  const { mapId, tokenId } = params;

  if (!mapId || !tokenId) {
    return new Response("Map ID and Token ID required", { status: 400 });
  }

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Check at least view permission
  const access = await requireMapPermission(mapId, session.user.id, "view");
  const permissions = getEffectivePermissions(access);

  // Get the map data
  const mapData = await db
    .select()
    .from(maps)
    .where(eq(maps.id, mapId))
    .limit(1);

  if (mapData.length === 0) {
    return new Response("Map not found", { status: 404 });
  }

  const map = mapData[0].data as DnDMap;
  const token = map.tokens.find((t) => t.id === tokenId);

  if (!token) {
    return new Response("Token not found", { status: 404 });
  }

  // Check if user can move this token
  const canMove =
    permissions.canMoveAllTokens ||
    (permissions.canMoveOwnTokens && token.ownerId === session.user.id);

  if (!canMove) {
    return new Response("You don't have permission to move this token", { status: 403 });
  }

  // Get new position from request body
  const body = await request.json();
  const { col, row } = body;

  if (typeof col !== "number" || typeof row !== "number") {
    return new Response("Invalid position", { status: 400 });
  }

  // Update token position in map data
  const updatedTokens = map.tokens.map((t) =>
    t.id === tokenId ? { ...t, position: { col, row } } : t
  );

  const updatedMap: DnDMap = {
    ...map,
    tokens: updatedTokens,
    updatedAt: new Date().toISOString(),
  };

  // Save to database
  await db
    .update(maps)
    .set({
      data: updatedMap,
      updatedAt: new Date(),
    })
    .where(eq(maps.id, mapId));

  return Response.json({ success: true });
}
