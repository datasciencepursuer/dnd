import type { Route } from "./+types/api.groups.$groupId.availability";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { eq, and, gt, lt } = await import("drizzle-orm");
  const { db } = await import("~/.server/db");
  const { groupAvailabilities, user } = await import("~/.server/db/schema");
  const { requireAuth } = await import("~/.server/auth/session");
  const { requireGroupPermission } = await import(
    "~/.server/permissions/group-permissions"
  );

  const session = await requireAuth(request);
  const userId = session.user.id;
  const { groupId } = params;

  await requireGroupPermission(groupId, userId, "view");

  // Parse week query param (ISO Monday date, e.g. 2026-02-09)
  const url = new URL(request.url);
  const weekParam = url.searchParams.get("week");

  let weekStart: Date;
  if (weekParam) {
    weekStart = new Date(weekParam + "T00:00:00Z");
    if (isNaN(weekStart.getTime())) {
      return Response.json({ error: "Invalid week parameter" }, { status: 400 });
    }
  } else {
    // Default to current week's Monday
    const now = new Date();
    const day = now.getUTCDay();
    const diff = day === 0 ? 6 : day - 1;
    weekStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diff));
  }

  // Add ±1 day buffer to catch blocks near week boundaries across timezones
  const queryStart = new Date(weekStart);
  queryStart.setUTCDate(queryStart.getUTCDate() - 1);
  const queryEnd = new Date(weekStart);
  queryEnd.setUTCDate(queryEnd.getUTCDate() + 8);

  // Fetch all availability blocks for this group that overlap with the week
  // Uses overlap logic (startTime < queryEnd AND endTime > queryStart) to handle
  // blocks whose UTC times cross the week boundary due to timezone offsets.
  const blocks = await db
    .select({
      id: groupAvailabilities.id,
      userId: groupAvailabilities.userId,
      userName: user.name,
      startTime: groupAvailabilities.startTime,
      endTime: groupAvailabilities.endTime,
      createdAt: groupAvailabilities.createdAt,
    })
    .from(groupAvailabilities)
    .innerJoin(user, eq(groupAvailabilities.userId, user.id))
    .where(
      and(
        eq(groupAvailabilities.groupId, groupId),
        lt(groupAvailabilities.startTime, queryEnd),
        gt(groupAvailabilities.endTime, queryStart)
      )
    );

  return Response.json({
    availabilities: blocks.map((b) => ({
      id: b.id,
      userId: b.userId,
      userName: b.userName,
      startTime: b.startTime.toISOString(),
      endTime: b.endTime.toISOString(),
    })),
    currentUserId: userId,
  });
}

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const { eq, and } = await import("drizzle-orm");
  const { db } = await import("~/.server/db");
  const { groupAvailabilities } = await import("~/.server/db/schema");
  const { requireAuth } = await import("~/.server/auth/session");
  const { requireGroupPermission } = await import(
    "~/.server/permissions/group-permissions"
  );

  const session = await requireAuth(request);
  const userId = session.user.id;
  const { groupId } = params;

  await requireGroupPermission(groupId, userId, "view");

  const body = await request.json();
  const { startTime, endTime } = body;

  if (!startTime || !endTime) {
    return Response.json({ error: "Start and end times are required" }, { status: 400 });
  }

  const start = new Date(startTime);
  const end = new Date(endTime);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return Response.json({ error: "Invalid date" }, { status: 400 });
  }

  if (end <= start) {
    return Response.json({ error: "End time must be after start time" }, { status: 400 });
  }

  // Block creation of availability that's entirely in the past
  if (end <= new Date()) {
    return Response.json({ error: "Cannot create availability in the past" }, { status: 400 });
  }

  // Duration validation: 30min to 24h
  const durationMs = end.getTime() - start.getTime();
  const thirtyMin = 30 * 60 * 1000;
  const twentyFourH = 24 * 60 * 60 * 1000;

  if (durationMs < thirtyMin) {
    return Response.json({ error: "Block must be at least 30 minutes" }, { status: 400 });
  }

  if (durationMs > twentyFourH) {
    return Response.json({ error: "Block cannot exceed 24 hours" }, { status: 400 });
  }

  // Find existing blocks from this user in the same group
  const { inArray } = await import("drizzle-orm");
  const existing = await db
    .select({
      id: groupAvailabilities.id,
      startTime: groupAvailabilities.startTime,
      endTime: groupAvailabilities.endTime,
    })
    .from(groupAvailabilities)
    .where(
      and(
        eq(groupAvailabilities.groupId, groupId),
        eq(groupAvailabilities.userId, userId)
      )
    );

  // Merge: find all blocks that overlap or are adjacent to the new range
  const overlapping = existing.filter(
    (b) => b.startTime <= end && b.endTime >= start
  );

  // Max 50 blocks per user per group (if no merge will happen, check limit)
  if (existing.length >= 50 && overlapping.length === 0) {
    return Response.json(
      { error: "Maximum of 50 availability blocks per group" },
      { status: 400 }
    );
  }

  let mergedStart = start;
  let mergedEnd = end;
  for (const b of overlapping) {
    if (b.startTime < mergedStart) mergedStart = b.startTime;
    if (b.endTime > mergedEnd) mergedEnd = b.endTime;
  }

  // Delete overlapping blocks, then insert the merged one
  const idsToDelete = overlapping.map((b) => b.id);
  if (idsToDelete.length > 0) {
    await db
      .delete(groupAvailabilities)
      .where(inArray(groupAvailabilities.id, idsToDelete));
  }

  const { nanoid } = await import("nanoid");
  const id = nanoid();

  await db.insert(groupAvailabilities).values({
    id,
    groupId,
    userId,
    startTime: mergedStart,
    endTime: mergedEnd,
  });

  return Response.json({ id, success: true });
}
