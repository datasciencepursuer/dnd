import type { Route } from "./+types/api.maps.$mapId";
import { eq } from "drizzle-orm";
import { db } from "~/.server/db";
import { maps, groupMembers, user } from "~/.server/db/schema";
import { requireAuth } from "~/.server/auth/session";
import {
  requireMapPermission,
  getEffectivePermissions,
} from "~/.server/permissions/map-permissions";

interface GroupMemberInfo {
  id: string;
  name: string;
}

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

  // Get group members if map belongs to a group (for token owner assignment)
  let groupMembersData: GroupMemberInfo[] = [];
  if (mapData[0].groupId) {
    const members = await db
      .select({
        id: user.id,
        name: user.name,
      })
      .from(groupMembers)
      .innerJoin(user, eq(groupMembers.userId, user.id))
      .where(eq(groupMembers.groupId, mapData[0].groupId));

    groupMembersData = members;
  }

  return Response.json({
    ...mapData[0],
    permission: access.permission,
    customPermissions: getEffectivePermissions(access),
    groupMembers: groupMembersData,
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
      // Check at least view permission (all group members can view)
      const access = await requireMapPermission(mapId, session.user.id, "view");
      // DM can edit everything, players have limited edit
      const isDM = access.isDungeonMaster;

      const body = await request.json();
      const { name, data, newDmId } = body;

      // Handle DM transfer
      if (newDmId !== undefined) {
        if (!isDM) {
          return new Response("Only the DM can transfer ownership", { status: 403 });
        }

        // Get current map to check group
        const currentMap = await db
          .select({ groupId: maps.groupId })
          .from(maps)
          .where(eq(maps.id, mapId))
          .limit(1);

        if (currentMap.length === 0) {
          return new Response("Map not found", { status: 404 });
        }

        // Verify new DM is a group member (if map belongs to a group)
        if (currentMap[0].groupId) {
          const memberCheck = await db
            .select({ userId: groupMembers.userId })
            .from(groupMembers)
            .where(eq(groupMembers.groupId, currentMap[0].groupId));

          const memberIds = memberCheck.map(m => m.userId);
          if (!memberIds.includes(newDmId)) {
            return new Response("New DM must be a group member", { status: 400 });
          }
        }

        // Transfer DM by updating map owner
        await db.update(maps).set({
          userId: newDmId,
          updatedAt: new Date()
        }).where(eq(maps.id, mapId));

        return Response.json({ success: true, transferred: true });
      }

      // Players can only delete tokens they own
      if (!isDM && data) {
        // Get current map data to validate changes
        const currentMap = await db
          .select({ data: maps.data })
          .from(maps)
          .where(eq(maps.id, mapId))
          .limit(1);

        if (currentMap.length === 0) {
          return new Response("Map not found", { status: 404 });
        }

        const currentData = currentMap[0].data as { tokens?: Array<{ id: string; ownerId: string | null }> };
        const newData = data as { tokens?: Array<{ id: string; ownerId: string | null }> };

        // Check that player only deleted their own tokens
        const currentTokens = currentData.tokens || [];
        const newTokens = newData.tokens || [];

        // Find deleted tokens - must be owned by this user
        const newTokenIds = new Set(newTokens.map(t => t.id));
        for (const token of currentTokens) {
          if (!newTokenIds.has(token.id)) {
            // Token was deleted - check if user owns it
            if (token.ownerId !== session.user.id) {
              return new Response("Cannot delete tokens you don't own", { status: 403 });
            }
          }
        }
        // Note: All players can edit any token, so no edit restriction needed
      }

      const updateData: { name?: string; data?: unknown; updatedAt: Date } = {
        updatedAt: new Date(),
      };

      // Only DM can change map name
      if (name !== undefined && isDM) {
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
