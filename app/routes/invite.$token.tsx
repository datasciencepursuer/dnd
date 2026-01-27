import type { Route } from "./+types/invite.$token";
import { eq, and, gt } from "drizzle-orm";
import { redirect } from "react-router";
import { db } from "~/.server/db";
import { mapInvitations, mapPermissions } from "~/.server/db/schema";
import { requireAuth } from "~/.server/auth/session";
import { nanoid } from "nanoid";

export async function loader({ request, params }: Route.LoaderArgs) {
  const session = await requireAuth(request);
  const { token } = params;

  if (!token) {
    throw new Response("Invalid invitation link", { status: 400 });
  }

  // Find the invitation
  const invitation = await db
    .select({
      id: mapInvitations.id,
      mapId: mapInvitations.mapId,
      email: mapInvitations.email,
      permission: mapInvitations.permission,
      expiresAt: mapInvitations.expiresAt,
    })
    .from(mapInvitations)
    .where(
      and(
        eq(mapInvitations.token, token),
        gt(mapInvitations.expiresAt, new Date())
      )
    )
    .limit(1);

  if (invitation.length === 0) {
    throw new Response("Invitation not found or expired", { status: 404 });
  }

  const inv = invitation[0];

  // Check if user's email matches the invitation email
  if (session.user.email.toLowerCase() !== inv.email.toLowerCase()) {
    throw new Response(
      `This invitation was sent to ${inv.email}. You are logged in as ${session.user.email}.`,
      { status: 403 }
    );
  }

  // Check if permission already exists
  const existingPermission = await db
    .select({ id: mapPermissions.id })
    .from(mapPermissions)
    .where(
      and(
        eq(mapPermissions.mapId, inv.mapId),
        eq(mapPermissions.userId, session.user.id)
      )
    )
    .limit(1);

  if (existingPermission.length === 0) {
    // Create the permission
    await db.insert(mapPermissions).values({
      id: nanoid(),
      mapId: inv.mapId,
      userId: session.user.id,
      permission: inv.permission,
      grantedBy: null, // Was from invitation
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // Delete the invitation
  await db.delete(mapInvitations).where(eq(mapInvitations.id, inv.id));

  // Redirect to the map
  throw redirect(`/playground/${inv.mapId}`);
}
