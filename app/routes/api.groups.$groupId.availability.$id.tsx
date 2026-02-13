import type { Route } from "./+types/api.groups.$groupId.availability.$id";

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== "DELETE") {
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
  const { groupId, id } = params;

  const access = await requireGroupPermission(groupId, userId, "view");

  // Fetch the block
  const block = await db
    .select({
      id: groupAvailabilities.id,
      userId: groupAvailabilities.userId,
    })
    .from(groupAvailabilities)
    .where(
      and(
        eq(groupAvailabilities.id, id),
        eq(groupAvailabilities.groupId, groupId)
      )
    )
    .limit(1);

  if (block.length === 0) {
    return Response.json({ error: "Block not found" }, { status: 404 });
  }

  // Only the owner or group admin/owner can delete
  const isOwner = block[0].userId === userId;
  const isAdmin = access.role === "owner" || access.role === "admin";

  if (!isOwner && !isAdmin) {
    return Response.json({ error: "Not authorized to delete this block" }, { status: 403 });
  }

  await db
    .delete(groupAvailabilities)
    .where(eq(groupAvailabilities.id, id));

  return Response.json({ success: true });
}
