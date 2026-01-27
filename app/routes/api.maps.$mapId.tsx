import type { Route } from "./+types/api.maps.$mapId";
import { eq } from "drizzle-orm";
import { db } from "~/.server/db";
import { maps } from "~/.server/db/schema";
import { requireAuth } from "~/.server/auth/session";
import {
  requireMapPermission,
  getEffectivePermissions,
} from "~/.server/permissions/map-permissions";

export async function loader({ request, params }: Route.LoaderArgs) {
  const session = await requireAuth(request);
  const { mapId } = params;

  if (!mapId) {
    return new Response("Map ID required", { status: 400 });
  }

  // Check permission
  const access = await requireMapPermission(mapId, session.user.id, "view");

  // Get map data
  const mapData = await db
    .select()
    .from(maps)
    .where(eq(maps.id, mapId))
    .limit(1);

  if (mapData.length === 0) {
    return new Response("Map not found", { status: 404 });
  }

  return Response.json({
    ...mapData[0],
    permission: access.isOwner ? "owner" : access.permission,
    customPermissions: getEffectivePermissions(access),
  });
}

export async function action({ request, params }: Route.ActionArgs) {
  const session = await requireAuth(request);
  const { mapId } = params;

  if (!mapId) {
    return new Response("Map ID required", { status: 400 });
  }

  switch (request.method) {
    case "PUT": {
      // Check edit permission
      await requireMapPermission(mapId, session.user.id, "edit");

      const body = await request.json();
      const { name, data } = body;

      const updateData: { name?: string; data?: unknown; updatedAt: Date } = {
        updatedAt: new Date(),
      };

      if (name !== undefined) {
        updateData.name = name;
      }
      if (data !== undefined) {
        updateData.data = data;
      }

      await db.update(maps).set(updateData).where(eq(maps.id, mapId));

      return Response.json({ success: true });
    }

    case "DELETE": {
      // Check delete permission (owner only)
      await requireMapPermission(mapId, session.user.id, "delete");

      await db.delete(maps).where(eq(maps.id, mapId));

      return Response.json({ success: true });
    }

    default:
      return new Response("Method not allowed", { status: 405 });
  }
}
