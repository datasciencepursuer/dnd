import type { Route } from "./+types/api.groups.$groupId";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { eq, sql } = await import("drizzle-orm");
  const { db } = await import("~/.server/db");
  const { groups, maps, groupInvitations } = await import("~/.server/db/schema");
  const { requireAuth } = await import("~/.server/auth/session");
  const { requireGroupPermission, getGroupMembers } = await import(
    "~/.server/permissions/group-permissions"
  );
  const session = await requireAuth(request);
  const userId = session.user.id;
  const { groupId } = params;

  // Require at least view permission
  const access = await requireGroupPermission(groupId, userId, "view");

  // Get group details
  const groupData = await db
    .select()
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);

  if (groupData.length === 0) {
    return new Response("Group not found", { status: 404 });
  }

  const group = groupData[0];

  // Get members, map count, and pending invitations count
  const [members, mapCount, invitationCount] = await Promise.all([
    getGroupMembers(groupId),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(maps)
      .where(eq(maps.groupId, groupId)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(groupInvitations)
      .where(eq(groupInvitations.groupId, groupId)),
  ]);

  return Response.json({
    group: {
      ...group,
      memberCount: members.length,
      mapCount: mapCount[0]?.count ?? 0,
      pendingInvitations: invitationCount[0]?.count ?? 0,
    },
    members,
    userRole: access.role,
    canEdit: ["owner", "admin"].includes(access.role!),
    canDelete: access.role === "owner",
  });
}

export async function action({ request, params }: Route.ActionArgs) {
  const { eq, sql } = await import("drizzle-orm");
  const { db } = await import("~/.server/db");
  const { groups, maps } = await import("~/.server/db/schema");
  const { requireAuth } = await import("~/.server/auth/session");
  const { requireGroupPermission } = await import(
    "~/.server/permissions/group-permissions"
  );

  const session = await requireAuth(request);
  const userId = session.user.id;
  const { groupId } = params;

  if (request.method === "PUT") {
    // Update group details
    await requireGroupPermission(groupId, userId, "edit");

    const body = await request.json();
    const { name, description, timezone } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return Response.json({ error: "Group name is required" }, { status: 400 });
    }

    if (name.length > 100) {
      return Response.json(
        { error: "Group name must be 100 characters or less" },
        { status: 400 }
      );
    }

    // Validate timezone if provided
    if (timezone !== undefined) {
      if (typeof timezone !== "string" || !timezone) {
        return Response.json({ error: "Invalid timezone" }, { status: 400 });
      }
      try {
        Intl.DateTimeFormat(undefined, { timeZone: timezone });
      } catch {
        return Response.json({ error: "Invalid timezone" }, { status: 400 });
      }
    }

    await db
      .update(groups)
      .set({
        name: name.trim(),
        description: description?.trim() || null,
        ...(timezone !== undefined && { timezone }),
        updatedAt: new Date(),
      })
      .where(eq(groups.id, groupId));

    return Response.json({ success: true });
  }

  if (request.method === "DELETE") {
    // Delete group - only owners can do this
    await requireGroupPermission(groupId, userId, "delete");

    // Check if group has maps
    const mapCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(maps)
      .where(eq(maps.groupId, groupId));

    if ((mapCount[0]?.count ?? 0) > 0) {
      return Response.json(
        { error: "Cannot delete a group that contains maps. Delete or move all maps first." },
        { status: 400 }
      );
    }

    // Delete group (cascade will handle members and invitations)
    await db.delete(groups).where(eq(groups.id, groupId));

    return Response.json({ success: true });
  }

  return new Response("Method not allowed", { status: 405 });
}
