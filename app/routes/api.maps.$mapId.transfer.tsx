import type { Route } from "./+types/api.maps.$mapId.transfer";
import { eq, and } from "drizzle-orm";
import { db } from "~/.server/db";
import { maps, mapPermissions, user } from "~/.server/db/schema";
import { requireAuth } from "~/.server/auth/session";
import { requireMapPermission } from "~/.server/permissions/map-permissions";
import { nanoid } from "nanoid";

// POST - Transfer ownership to another user
export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const session = await requireAuth(request);
  const { mapId } = params;

  if (!mapId) {
    return new Response("Map ID required", { status: 400 });
  }

  // Check transfer permission (owner only)
  await requireMapPermission(mapId, session.user.id, "transfer");

  const body = await request.json();
  const { newOwnerId, keepAccess } = body as {
    newOwnerId: string;
    keepAccess?: boolean;
  };

  if (!newOwnerId) {
    return new Response("New owner ID required", { status: 400 });
  }

  // Verify new owner exists
  const newOwner = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, newOwnerId))
    .limit(1);

  if (newOwner.length === 0) {
    return new Response("User not found", { status: 404 });
  }

  // Get the current map
  const currentMap = await db
    .select({ userId: maps.userId })
    .from(maps)
    .where(eq(maps.id, mapId))
    .limit(1);

  if (currentMap.length === 0) {
    return new Response("Map not found", { status: 404 });
  }

  const previousOwnerId = currentMap[0].userId;

  // Start transaction
  // 1. Remove any existing permission for the new owner (since they'll be owner now)
  await db
    .delete(mapPermissions)
    .where(
      and(eq(mapPermissions.mapId, mapId), eq(mapPermissions.userId, newOwnerId))
    );

  // 2. Update map ownership
  await db
    .update(maps)
    .set({ userId: newOwnerId, updatedAt: new Date() })
    .where(eq(maps.id, mapId));

  // 3. Optionally give previous owner edit access
  if (keepAccess) {
    // Check if permission already exists
    const existingPermission = await db
      .select({ id: mapPermissions.id })
      .from(mapPermissions)
      .where(
        and(
          eq(mapPermissions.mapId, mapId),
          eq(mapPermissions.userId, previousOwnerId)
        )
      )
      .limit(1);

    if (existingPermission.length === 0) {
      await db.insert(mapPermissions).values({
        id: nanoid(),
        mapId,
        userId: previousOwnerId,
        permission: "edit",
        grantedBy: newOwnerId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  return Response.json({ success: true });
}
