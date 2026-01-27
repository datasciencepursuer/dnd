import type { Route } from "./+types/api.groups.$groupId.members.$userId";

export async function loader() {
  return new Response("Method not allowed", { status: 405 });
}

export async function action({ request, params }: Route.ActionArgs) {
  const { eq, and } = await import("drizzle-orm");
  const { db } = await import("~/.server/db");
  const { groupMembers } = await import("~/.server/db/schema");
  const { requireAuth } = await import("~/.server/auth/session");
  const { requireGroupPermission, getGroupAccess } = await import(
    "~/.server/permissions/group-permissions"
  );

  const session = await requireAuth(request);
  const actingUserId = session.user.id;
  const { groupId, userId: targetUserId } = params;

  if (request.method === "PUT") {
    // Update member role
    await requireGroupPermission(groupId, actingUserId, "manage_members");

    const body = await request.json();
    const { role } = body;

    if (!["member", "admin"].includes(role)) {
      return Response.json({ error: "Invalid role" }, { status: 400 });
    }

    // Get target user's current role
    const targetAccess = await getGroupAccess(groupId, targetUserId);

    if (!targetAccess.isMember) {
      return Response.json(
        { error: "User is not a member of this group" },
        { status: 404 }
      );
    }

    // Can't change owner's role
    if (targetAccess.role === "owner") {
      return Response.json(
        { error: "Cannot change the owner's role" },
        { status: 400 }
      );
    }

    // Get acting user's role
    const actingAccess = await getGroupAccess(groupId, actingUserId);

    // Admins can't promote others to admin
    if (actingAccess.role === "admin" && role === "admin") {
      return Response.json(
        { error: "Only the owner can promote members to admin" },
        { status: 403 }
      );
    }

    await db
      .update(groupMembers)
      .set({ role })
      .where(
        and(
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.userId, targetUserId)
        )
      );

    return Response.json({ success: true });
  }

  if (request.method === "DELETE") {
    // Remove member
    // Get target user's role first
    const targetAccess = await getGroupAccess(groupId, targetUserId);

    if (!targetAccess.isMember) {
      return Response.json(
        { error: "User is not a member of this group" },
        { status: 404 }
      );
    }

    // Can't remove the owner
    if (targetAccess.role === "owner") {
      return Response.json(
        { error: "Cannot remove the group owner" },
        { status: 400 }
      );
    }

    // Check if acting user has permission (or is removing themselves)
    if (actingUserId !== targetUserId) {
      await requireGroupPermission(groupId, actingUserId, "manage_members");
    }

    // Get acting user's role to prevent admins from removing other admins
    const actingAccess = await getGroupAccess(groupId, actingUserId);
    if (
      actingUserId !== targetUserId &&
      actingAccess.role === "admin" &&
      targetAccess.role === "admin"
    ) {
      return Response.json(
        { error: "Admins cannot remove other admins" },
        { status: 403 }
      );
    }

    await db
      .delete(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.userId, targetUserId)
        )
      );

    return Response.json({ success: true });
  }

  return new Response("Method not allowed", { status: 405 });
}
