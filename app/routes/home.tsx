import type { Route } from "./+types/home";
import { redirect } from "react-router";

export async function loader({ request }: Route.LoaderArgs) {
  const { eq, and } = await import("drizzle-orm");
  const { db } = await import("~/.server/db");
  const { user, groupMembers } = await import("~/.server/db/schema");
  const { requireAuth } = await import("~/.server/auth/session");

  const session = await requireAuth(request);
  const userId = session.user.id;

  // Check user's lastGroupId
  const userData = await db
    .select({ lastGroupId: user.lastGroupId })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  const lastGroupId = userData[0]?.lastGroupId;

  if (lastGroupId) {
    // Verify user is still a member
    const membership = await db
      .select({ id: groupMembers.id })
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, lastGroupId), eq(groupMembers.userId, userId)))
      .limit(1);

    if (membership.length > 0) {
      throw redirect(`/g/${lastGroupId}`);
    }

    // lastGroupId is stale — clear it
    await db.update(user).set({ lastGroupId: null }).where(eq(user.id, userId));
  }

  // Find first available group
  const firstGroup = await db
    .select({ groupId: groupMembers.groupId })
    .from(groupMembers)
    .where(eq(groupMembers.userId, userId))
    .limit(1);

  if (firstGroup.length > 0) {
    // Set as lastGroupId and redirect
    await db
      .update(user)
      .set({ lastGroupId: firstGroup[0].groupId })
      .where(eq(user.id, userId));
    throw redirect(`/g/${firstGroup[0].groupId}`);
  }

  // No groups — fallback to /maps
  throw redirect("/maps");
}

export default function Home() {
  return null;
}
