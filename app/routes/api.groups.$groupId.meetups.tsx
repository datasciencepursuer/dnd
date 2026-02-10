import type { Route } from "./+types/api.groups.$groupId.meetups";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { eq, gt, asc } = await import("drizzle-orm");
  const { db } = await import("~/.server/db");
  const { meetupProposals, meetupRsvps, user } = await import("~/.server/db/schema");
  const { requireAuth } = await import("~/.server/auth/session");
  const { requireGroupPermission } = await import(
    "~/.server/permissions/group-permissions"
  );

  const session = await requireAuth(request);
  const userId = session.user.id;
  const { groupId } = params;

  await requireGroupPermission(groupId, userId, "view");

  // Get future proposals for this group
  const proposals = await db
    .select({
      id: meetupProposals.id,
      proposedDate: meetupProposals.proposedDate,
      proposedEndDate: meetupProposals.proposedEndDate,
      note: meetupProposals.note,
      createdAt: meetupProposals.createdAt,
      proposedBy: meetupProposals.proposedBy,
      proposerName: user.name,
    })
    .from(meetupProposals)
    .innerJoin(user, eq(meetupProposals.proposedBy, user.id))
    .where(
      eq(meetupProposals.groupId, groupId),
    )
    .orderBy(asc(meetupProposals.proposedDate));

  // Filter to future proposals in JS (avoids SQL now() timezone issues)
  const now = new Date();
  const futureProposals = proposals.filter((p) => p.proposedDate > now);

  // Get RSVPs for all future proposals
  const proposalIds = futureProposals.map((p) => p.id);
  let rsvpsByProposal: Record<string, Array<{ userId: string; status: string; userName: string; updatedAt: string }>> = {};

  if (proposalIds.length > 0) {
    const { inArray } = await import("drizzle-orm");
    const allRsvps = await db
      .select({
        proposalId: meetupRsvps.proposalId,
        userId: meetupRsvps.userId,
        status: meetupRsvps.status,
        userName: user.name,
        updatedAt: meetupRsvps.updatedAt,
      })
      .from(meetupRsvps)
      .innerJoin(user, eq(meetupRsvps.userId, user.id))
      .where(inArray(meetupRsvps.proposalId, proposalIds));

    for (const rsvp of allRsvps) {
      if (!rsvpsByProposal[rsvp.proposalId]) {
        rsvpsByProposal[rsvp.proposalId] = [];
      }
      rsvpsByProposal[rsvp.proposalId].push({
        userId: rsvp.userId,
        status: rsvp.status,
        userName: rsvp.userName,
        updatedAt: rsvp.updatedAt.toISOString(),
      });
    }
  }

  return Response.json({
    proposals: futureProposals.map((p) => ({
      id: p.id,
      proposedDate: p.proposedDate.toISOString(),
      proposedEndDate: p.proposedEndDate.toISOString(),
      note: p.note,
      createdAt: p.createdAt.toISOString(),
      proposedBy: p.proposedBy,
      proposerName: p.proposerName,
      rsvps: rsvpsByProposal[p.id] || [],
    })),
    currentUserId: userId,
  });
}

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const { eq, sql } = await import("drizzle-orm");
  const { db } = await import("~/.server/db");
  const { meetupProposals } = await import("~/.server/db/schema");
  const { requireAuth } = await import("~/.server/auth/session");
  const { requireGroupPermission } = await import(
    "~/.server/permissions/group-permissions"
  );

  const session = await requireAuth(request);
  const userId = session.user.id;
  const { groupId } = params;

  await requireGroupPermission(groupId, userId, "view");

  const body = await request.json();
  const { proposedDate, proposedEndDate, note } = body;

  if (!proposedDate || !proposedEndDate) {
    return Response.json({ error: "Start and end times are required" }, { status: 400 });
  }

  const startDate = new Date(proposedDate);
  const endDate = new Date(proposedEndDate);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return Response.json({ error: "Invalid date" }, { status: 400 });
  }

  if (startDate <= new Date()) {
    return Response.json({ error: "Start time must be in the future" }, { status: 400 });
  }

  if (endDate <= startDate) {
    return Response.json({ error: "End time must be after start time" }, { status: 400 });
  }

  if (note && typeof note === "string" && note.length > 200) {
    return Response.json({ error: "Note must be 200 characters or less" }, { status: 400 });
  }

  // Count active (future) proposals for this group
  const now = new Date();
  const allProposals = await db
    .select({ id: meetupProposals.id, proposedDate: meetupProposals.proposedDate })
    .from(meetupProposals)
    .where(eq(meetupProposals.groupId, groupId));

  const futureCount = allProposals.filter((p) => p.proposedDate > now).length;

  if (futureCount >= 5) {
    return Response.json(
      { error: "Maximum of 5 active proposals per group" },
      { status: 400 }
    );
  }

  const { nanoid } = await import("nanoid");
  const id = nanoid();

  await db.insert(meetupProposals).values({
    id,
    groupId,
    proposedBy: userId,
    proposedDate: startDate,
    proposedEndDate: endDate,
    note: note?.trim() || null,
  });

  return Response.json({ id, success: true });
}
