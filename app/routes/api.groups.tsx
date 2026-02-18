import type { Route } from "./+types/api.groups";

export async function loader({ request }: Route.LoaderArgs) {
  const { eq, sql } = await import("drizzle-orm");
  const { db } = await import("~/.server/db");
  const { groupMembers, maps } = await import("~/.server/db/schema");
  const { requireAuth } = await import("~/.server/auth/session");
  const { getUserGroups, getUserGroupCount, MAX_GROUPS_PER_USER } = await import(
    "~/.server/permissions/group-permissions"
  );

  const { getUserTierLimits } = await import("~/.server/subscription");

  const session = await requireAuth(request);
  const userId = session.user.id;

  // Get user's groups with member and map counts
  const userGroups = await getUserGroups(userId);

  // Get member counts and map counts for each group
  const groupsWithCounts = await Promise.all(
    userGroups.map(async (group) => {
      const [memberCount, mapCount] = await Promise.all([
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(groupMembers)
          .where(eq(groupMembers.groupId, group.id)),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(maps)
          .where(eq(maps.groupId, group.id)),
      ]);

      return {
        ...group,
        memberCount: memberCount[0]?.count ?? 0,
        mapCount: mapCount[0]?.count ?? 0,
      };
    })
  );

  const groupCount = await getUserGroupCount(userId);
  const limits = await getUserTierLimits(userId);

  return Response.json({
    groups: groupsWithCounts,
    groupCount,
    maxGroups: limits.maxGroups,
    canCreateGroup: groupCount < limits.maxGroups,
  });
}

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const { db } = await import("~/.server/db");
  const { groups, groupMembers } = await import("~/.server/db/schema");
  const { requireAuth } = await import("~/.server/auth/session");
  const { getUserGroupCount } = await import(
    "~/.server/permissions/group-permissions"
  );
  const { getUserTierLimits } = await import("~/.server/subscription");
  const { nanoid } = await import("nanoid");

  const session = await requireAuth(request);
  const userId = session.user.id;
  const body = await request.json();

  const { name, description } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return Response.json({ error: "Group name is required" }, { status: 400 });
  }

  if (name.length > 100) {
    return Response.json(
      { error: "Group name must be 100 characters or less" },
      { status: 400 }
    );
  }

  // Check group limit based on tier
  const limits = await getUserTierLimits(userId);
  const groupCount = await getUserGroupCount(userId);
  if (groupCount >= limits.maxGroups) {
    return Response.json(
      { error: limits.maxGroups === 0 ? "Groups require a paid subscription." : `You've reached the limit of ${limits.maxGroups} groups. Upgrade your plan to create more.`, upgrade: true },
      { status: 403 }
    );
  }

  const groupId = nanoid();
  const memberId = nanoid();
  const now = new Date();

  try {
    // Create group and add creator as owner
    // Note: Neon HTTP driver doesn't support transactions, so we do sequential inserts
    await db.insert(groups).values({
      id: groupId,
      name: name.trim(),
      description: description?.trim() || null,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(groupMembers).values({
      id: memberId,
      groupId,
      userId,
      role: "owner",
      joinedAt: now,
    });

    return Response.json({
      id: groupId,
      name: name.trim(),
      description: description?.trim() || null,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
      role: "owner",
    });
  } catch (error) {
    console.error("Failed to create group:", error);
    return Response.json(
      { error: "Failed to create group. Please try again." },
      { status: 500 }
    );
  }
}
