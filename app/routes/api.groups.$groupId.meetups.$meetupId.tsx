import type { Route } from "./+types/api.groups.$groupId.meetups.$meetupId";

export async function action({ request, params }: Route.ActionArgs) {
  const { eq, and } = await import("drizzle-orm");
  const { db } = await import("~/.server/db");
  const { meetupProposals, meetupRsvps } = await import("~/.server/db/schema");
  const { requireAuth } = await import("~/.server/auth/session");
  const { requireGroupPermission, getGroupAccess } = await import(
    "~/.server/permissions/group-permissions"
  );

  const session = await requireAuth(request);
  const userId = session.user.id;
  const { groupId, meetupId } = params;

  await requireGroupPermission(groupId, userId, "view");

  // Verify proposal exists in this group
  const proposal = await db
    .select()
    .from(meetupProposals)
    .where(
      and(eq(meetupProposals.id, meetupId), eq(meetupProposals.groupId, groupId))
    )
    .limit(1);

  if (proposal.length === 0) {
    return Response.json({ error: "Proposal not found" }, { status: 404 });
  }

  if (request.method === "DELETE") {
    // Allow delete if user is the proposer or an owner/admin
    const access = await getGroupAccess(groupId, userId);
    const isProposer = proposal[0].proposedBy === userId;
    const isAdminOrOwner = access.role === "owner" || access.role === "admin";

    if (!isProposer && !isAdminOrOwner) {
      return Response.json({ error: "Not authorized to delete this proposal" }, { status: 403 });
    }

    await db.delete(meetupProposals).where(eq(meetupProposals.id, meetupId));
    return Response.json({ success: true });
  }

  if (request.method === "POST") {
    // RSVP to a proposal
    const body = await request.json();
    const { status } = body;

    if (status !== "available" && status !== "unavailable") {
      return Response.json({ error: "Status must be 'available' or 'unavailable'" }, { status: 400 });
    }

    const { nanoid } = await import("nanoid");

    await db
      .insert(meetupRsvps)
      .values({
        id: nanoid(),
        proposalId: meetupId,
        userId,
        status,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [meetupRsvps.proposalId, meetupRsvps.userId],
        set: {
          status,
          updatedAt: new Date(),
        },
      });

    return Response.json({ success: true });
  }

  return new Response("Method not allowed", { status: 405 });
}
