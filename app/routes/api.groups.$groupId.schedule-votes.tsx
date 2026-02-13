import type { Route } from "./+types/api.groups.$groupId.schedule-votes";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { eq, and, gt } = await import("drizzle-orm");
  const { db } = await import("~/.server/db");
  const { groupScheduleVotes, user } = await import("~/.server/db/schema");
  const { requireAuth } = await import("~/.server/auth/session");
  const { requireGroupPermission } = await import(
    "~/.server/permissions/group-permissions"
  );

  const session = await requireAuth(request);
  const userId = session.user.id;
  const { groupId } = params;

  await requireGroupPermission(groupId, userId, "view");

  // Fetch all future votes (from yesterday onwards)
  const queryStart = new Date(Date.now() - 86400000);

  const votes = await db
    .select({
      id: groupScheduleVotes.id,
      userId: groupScheduleVotes.userId,
      userName: user.name,
      startTime: groupScheduleVotes.startTime,
      endTime: groupScheduleVotes.endTime,
      vote: groupScheduleVotes.vote,
    })
    .from(groupScheduleVotes)
    .innerJoin(user, eq(groupScheduleVotes.userId, user.id))
    .where(
      and(
        eq(groupScheduleVotes.groupId, groupId),
        gt(groupScheduleVotes.endTime, queryStart)
      )
    );

  return Response.json({
    votes: votes.map((v) => ({
      id: v.id,
      userId: v.userId,
      userName: v.userName,
      startTime: v.startTime.toISOString(),
      endTime: v.endTime.toISOString(),
      vote: v.vote,
    })),
  });
}

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const { eq, and } = await import("drizzle-orm");
  const { db } = await import("~/.server/db");
  const { groupScheduleVotes } = await import("~/.server/db/schema");
  const { requireAuth } = await import("~/.server/auth/session");
  const { requireGroupPermission } = await import(
    "~/.server/permissions/group-permissions"
  );

  const session = await requireAuth(request);
  const userId = session.user.id;
  const { groupId } = params;

  await requireGroupPermission(groupId, userId, "view");

  const body = await request.json();
  const { startTime, endTime, vote } = body;

  if (!startTime || !endTime || !vote) {
    return Response.json({ error: "startTime, endTime, and vote are required" }, { status: 400 });
  }

  if (vote !== "local" && vote !== "virtual") {
    return Response.json({ error: "Vote must be 'local' or 'virtual'" }, { status: 400 });
  }

  const start = new Date(startTime);
  const end = new Date(endTime);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return Response.json({ error: "Invalid date" }, { status: 400 });
  }

  // Check if user already has a vote for this exact time range
  const existing = await db
    .select({ id: groupScheduleVotes.id, vote: groupScheduleVotes.vote })
    .from(groupScheduleVotes)
    .where(
      and(
        eq(groupScheduleVotes.groupId, groupId),
        eq(groupScheduleVotes.userId, userId),
        eq(groupScheduleVotes.startTime, start),
        eq(groupScheduleVotes.endTime, end)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    if (existing[0].vote === vote) {
      // Same vote — toggle off (delete)
      await db.delete(groupScheduleVotes).where(eq(groupScheduleVotes.id, existing[0].id));
      return Response.json({ action: "deleted" });
    }
    // Different vote — update
    await db
      .update(groupScheduleVotes)
      .set({ vote })
      .where(eq(groupScheduleVotes.id, existing[0].id));
    return Response.json({ action: "updated", id: existing[0].id });
  }

  // New vote
  const { nanoid } = await import("nanoid");
  const id = nanoid();

  await db.insert(groupScheduleVotes).values({
    id,
    groupId,
    userId,
    startTime: start,
    endTime: end,
    vote,
  });

  return Response.json({ action: "created", id });
}
