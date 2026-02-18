import type { Route } from "./+types/api.maps";
import { eq, desc, inArray, and, ne, sql } from "drizzle-orm";
import { db } from "~/.server/db";
import { maps, groups, groupMembers } from "~/.server/db/schema";
import { requireAuth } from "~/.server/auth/session";
import { nanoid } from "nanoid";
import { isGroupMember } from "~/.server/permissions/group-permissions";
import { getUserTierLimits } from "~/.server/subscription";

export async function loader({ request }: Route.LoaderArgs) {
  const session = await requireAuth(request);
  const userId = session.user.id;

  // Get user's group IDs
  const userGroups = await db
    .select({ groupId: groupMembers.groupId })
    .from(groupMembers)
    .where(eq(groupMembers.userId, userId));

  const groupIds = userGroups.map((g) => g.groupId);

  // Get maps where user is owner (including maps not in a group for backwards compatibility)
  const ownedMaps = await db
    .select({
      id: maps.id,
      name: maps.name,
      userId: maps.userId,
      groupId: maps.groupId,
      createdAt: maps.createdAt,
      updatedAt: maps.updatedAt,
    })
    .from(maps)
    .where(eq(maps.userId, userId))
    .orderBy(desc(maps.updatedAt));

  // Get maps from user's groups (where user is not the owner)
  let groupMaps: typeof ownedMaps = [];
  if (groupIds.length > 0) {
    groupMaps = await db
      .select({
        id: maps.id,
        name: maps.name,
        userId: maps.userId,
        groupId: maps.groupId,
        createdAt: maps.createdAt,
        updatedAt: maps.updatedAt,
      })
      .from(maps)
      .where(
        and(
          inArray(maps.groupId, groupIds),
          ne(maps.userId, userId)
        )
      )
      .orderBy(desc(maps.updatedAt));
  }

  // Get groups info for the response
  const groupsData =
    groupIds.length > 0
      ? await db
          .select({
            id: groups.id,
            name: groups.name,
          })
          .from(groups)
          .where(inArray(groups.id, groupIds))
      : [];

  // Build a map of group id to name
  const groupNameMap = Object.fromEntries(
    groupsData.map((g) => [g.id, g.name])
  );

  return Response.json({
    owned: ownedMaps.map((m) => ({
      ...m,
      permission: "dm" as const, // Map creator is the Dungeon Master
      groupName: m.groupId ? groupNameMap[m.groupId] : null,
    })),
    group: groupMaps.map((m) => ({
      ...m,
      permission: "player" as const, // Group members are Players
      groupName: m.groupId ? groupNameMap[m.groupId] : null,
    })),
    groups: groupsData,
  });
}

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const session = await requireAuth(request);
  const userId = session.user.id;
  const body = await request.json();

  const { name, data, groupId } = body;

  if (!name || !data) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Check map creation limit
  const limits = await getUserTierLimits(userId);
  if (limits.maxMaps !== Infinity) {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(maps)
      .where(eq(maps.userId, userId));

    if (count >= limits.maxMaps) {
      return Response.json(
        { error: `You've reached the limit of ${limits.maxMaps} maps. Upgrade your plan to create more.`, upgrade: true },
        { status: 403 }
      );
    }
  }

  // If groupId is provided, verify user is a member of the group
  if (groupId) {
    const isMember = await isGroupMember(groupId, userId);
    if (!isMember) {
      return Response.json(
        { error: "You must be a member of the group to create maps in it" },
        { status: 403 }
      );
    }
  }

  const id = nanoid();
  const now = new Date();

  await db.insert(maps).values({
    id,
    name,
    userId,
    groupId: groupId || null,
    data,
    createdAt: now,
    updatedAt: now,
  });

  return Response.json({ id, name, userId, groupId, createdAt: now, updatedAt: now });
}
