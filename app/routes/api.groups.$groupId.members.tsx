import type { Route } from "./+types/api.groups.$groupId.members";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { requireAuth } = await import("~/.server/auth/session");
  const { requireGroupPermission, getGroupMembers } = await import(
    "~/.server/permissions/group-permissions"
  );

  const session = await requireAuth(request);
  const userId = session.user.id;
  const { groupId } = params;

  // Require at least view permission
  await requireGroupPermission(groupId, userId, "view");

  const members = await getGroupMembers(groupId);

  return Response.json({ members });
}

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const { eq, and } = await import("drizzle-orm");
  const { db } = await import("~/.server/db");
  const { groupMembers, user } = await import("~/.server/db/schema");
  const { requireAuth } = await import("~/.server/auth/session");
  const { requireGroupPermission, getUserGroupCount, MAX_GROUPS_PER_USER } =
    await import("~/.server/permissions/group-permissions");
  const { nanoid } = await import("nanoid");

  const session = await requireAuth(request);
  const userId = session.user.id;
  const { groupId } = params;

  // Require manage_members permission to add members directly
  await requireGroupPermission(groupId, userId, "manage_members");

  const body = await request.json();
  const { email, role = "member" } = body;

  if (!email || typeof email !== "string") {
    return Response.json({ error: "Email is required" }, { status: 400 });
  }

  // Validate role
  if (!["member", "admin"].includes(role)) {
    return Response.json({ error: "Invalid role" }, { status: 400 });
  }

  // Find user by email
  const targetUser = await db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .where(eq(user.email, email.toLowerCase().trim()))
    .limit(1);

  if (targetUser.length === 0) {
    return Response.json(
      {
        error:
          "User not found. They may need to create an account first, or use the invite feature.",
      },
      { status: 404 }
    );
  }

  const targetUserId = targetUser[0].id;

  // Check if user is already a member
  const existingMember = await db
    .select()
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, targetUserId)
      )
    )
    .limit(1);

  if (existingMember.length > 0) {
    return Response.json(
      { error: "User is already a member of this group" },
      { status: 400 }
    );
  }

  // Check if target user has reached group limit
  const targetGroupCount = await getUserGroupCount(targetUserId);
  if (targetGroupCount >= MAX_GROUPS_PER_USER) {
    return Response.json(
      { error: `User has reached the maximum of ${MAX_GROUPS_PER_USER} groups` },
      { status: 400 }
    );
  }

  // Add member
  const memberId = nanoid();
  await db.insert(groupMembers).values({
    id: memberId,
    groupId,
    userId: targetUserId,
    role,
    joinedAt: new Date(),
  });

  return Response.json({
    id: memberId,
    userId: targetUserId,
    role,
    userName: targetUser[0].name,
    userEmail: targetUser[0].email,
  });
}
