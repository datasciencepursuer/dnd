import type { Route } from "./+types/api.groups.$groupId.invite";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { eq } = await import("drizzle-orm");
  const { db } = await import("~/.server/db");
  const { groupInvitations, user } = await import("~/.server/db/schema");
  const { requireAuth } = await import("~/.server/auth/session");
  const { requireGroupPermission } = await import(
    "~/.server/permissions/group-permissions"
  );

  const session = await requireAuth(request);
  const userId = session.user.id;
  const { groupId } = params;

  // Require invite permission to view invitations
  await requireGroupPermission(groupId, userId, "invite");

  // Get pending invitations
  const invitations = await db
    .select({
      id: groupInvitations.id,
      email: groupInvitations.email,
      token: groupInvitations.token,
      expiresAt: groupInvitations.expiresAt,
      createdAt: groupInvitations.createdAt,
      invitedBy: groupInvitations.invitedBy,
      invitedByName: user.name,
    })
    .from(groupInvitations)
    .innerJoin(user, eq(groupInvitations.invitedBy, user.id))
    .where(eq(groupInvitations.groupId, groupId));

  return Response.json({ invitations });
}

export async function action({ request, params }: Route.ActionArgs) {
  const { eq, and } = await import("drizzle-orm");
  const { db } = await import("~/.server/db");
  const { groupInvitations, groupMembers, user } = await import(
    "~/.server/db/schema"
  );
  const { requireAuth } = await import("~/.server/auth/session");
  const { requireGroupPermission } = await import(
    "~/.server/permissions/group-permissions"
  );
  const { nanoid } = await import("nanoid");

  const session = await requireAuth(request);
  const userId = session.user.id;
  const { groupId } = params;

  if (request.method === "POST") {
    // Create invitation
    await requireGroupPermission(groupId, userId, "invite");

    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== "string") {
      return Response.json({ error: "Email is required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if email is already a member
    const existingUser = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, normalizedEmail))
      .limit(1);

    if (existingUser.length > 0) {
      const existingMember = await db
        .select()
        .from(groupMembers)
        .where(
          and(
            eq(groupMembers.groupId, groupId),
            eq(groupMembers.userId, existingUser[0].id)
          )
        )
        .limit(1);

      if (existingMember.length > 0) {
        return Response.json(
          { error: "User is already a member of this group" },
          { status: 400 }
        );
      }
    }

    // Check if there's already a pending invitation for this email
    const existingInvitation = await db
      .select()
      .from(groupInvitations)
      .where(
        and(
          eq(groupInvitations.groupId, groupId),
          eq(groupInvitations.email, normalizedEmail)
        )
      )
      .limit(1);

    if (existingInvitation.length > 0) {
      return Response.json(
        { error: "An invitation has already been sent to this email" },
        { status: 400 }
      );
    }

    // Create invitation
    const invitationId = nanoid();
    const token = nanoid(32);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await db.insert(groupInvitations).values({
      id: invitationId,
      groupId,
      email: normalizedEmail,
      invitedBy: userId,
      token,
      expiresAt,
      createdAt: new Date(),
    });

    return Response.json({
      id: invitationId,
      email: normalizedEmail,
      token,
      expiresAt,
      inviteUrl: `/invite/group/${token}`,
    });
  }

  if (request.method === "DELETE") {
    // Cancel invitation
    await requireGroupPermission(groupId, userId, "invite");

    const body = await request.json();
    const { invitationId } = body;

    if (!invitationId) {
      return Response.json(
        { error: "Invitation ID is required" },
        { status: 400 }
      );
    }

    await db
      .delete(groupInvitations)
      .where(
        and(
          eq(groupInvitations.id, invitationId),
          eq(groupInvitations.groupId, groupId)
        )
      );

    return Response.json({ success: true });
  }

  return new Response("Method not allowed", { status: 405 });
}
