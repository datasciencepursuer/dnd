import type { Route } from "./+types/api.groups.$groupId.leave";

export async function loader() {
  return new Response("Method not allowed", { status: 405 });
}

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const { eq, and } = await import("drizzle-orm");
  const { db } = await import("~/.server/db");
  const { groupMembers } = await import("~/.server/db/schema");
  const { requireAuth } = await import("~/.server/auth/session");
  const { getGroupAccess } = await import(
    "~/.server/permissions/group-permissions"
  );

  const session = await requireAuth(request);
  const userId = session.user.id;
  const { groupId } = params;

  const access = await getGroupAccess(groupId, userId);

  if (!access.isMember) {
    return Response.json(
      { error: "You are not a member of this group" },
      { status: 400 }
    );
  }

  // Owners cannot leave - they must transfer ownership first or delete the group
  if (access.role === "owner") {
    return Response.json(
      {
        error:
          "Owners cannot leave the group. Transfer ownership or delete the group instead.",
      },
      { status: 400 }
    );
  }

  await db
    .delete(groupMembers)
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId))
    );

  return Response.json({ success: true });
}
