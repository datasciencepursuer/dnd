import type { Route } from "./+types/api.maps.$mapId.share";
import { eq, and } from "drizzle-orm";
import { db } from "~/.server/db";
import type { PermissionLevel, PlayerPermissions } from "~/.server/db/schema";
import { mapPermissions, mapInvitations, user } from "~/.server/db/schema";
import { requireAuth } from "~/.server/auth/session";
import { requireMapPermission } from "~/.server/permissions/map-permissions";
import { nanoid } from "nanoid";

// GET - List current shares and pending invitations
export async function loader({ request, params }: Route.LoaderArgs) {
  const session = await requireAuth(request);
  const { mapId } = params;

  if (!mapId) {
    return new Response("Map ID required", { status: 400 });
  }

  // Check share permission (owner only)
  await requireMapPermission(mapId, session.user.id, "share");

  // Get current shares
  const shares = await db
    .select({
      id: mapPermissions.id,
      userId: mapPermissions.userId,
      userName: user.name,
      userEmail: user.email,
      permission: mapPermissions.permission,
      customPermissions: mapPermissions.customPermissions,
      createdAt: mapPermissions.createdAt,
    })
    .from(mapPermissions)
    .innerJoin(user, eq(mapPermissions.userId, user.id))
    .where(eq(mapPermissions.mapId, mapId));

  // Get pending invitations
  const invitations = await db
    .select({
      id: mapInvitations.id,
      email: mapInvitations.email,
      permission: mapInvitations.permission,
      expiresAt: mapInvitations.expiresAt,
      createdAt: mapInvitations.createdAt,
    })
    .from(mapInvitations)
    .where(eq(mapInvitations.mapId, mapId));

  return Response.json({ shares, invitations });
}

// POST - Add new share or invitation
export async function action({ request, params }: Route.ActionArgs) {
  const session = await requireAuth(request);
  const { mapId } = params;

  if (!mapId) {
    return new Response("Map ID required", { status: 400 });
  }

  switch (request.method) {
    case "POST": {
      // Check share permission (owner only)
      await requireMapPermission(mapId, session.user.id, "share");

      const body = await request.json();
      const { email, userId, permission, customPermissions } = body as {
        email?: string;
        userId?: string;
        permission: PermissionLevel;
        customPermissions?: PlayerPermissions;
      };

      if (!email && !userId) {
        return new Response("Email or user ID required", { status: 400 });
      }

      if (!["view", "edit"].includes(permission)) {
        return new Response("Invalid permission level", { status: 400 });
      }

      // If userId provided, create direct permission
      if (userId) {
        // Check user exists
        const existingUser = await db
          .select({ id: user.id })
          .from(user)
          .where(eq(user.id, userId))
          .limit(1);

        if (existingUser.length === 0) {
          return new Response("User not found", { status: 404 });
        }

        // Check if permission already exists
        const existingPermission = await db
          .select({ id: mapPermissions.id })
          .from(mapPermissions)
          .where(
            and(
              eq(mapPermissions.mapId, mapId),
              eq(mapPermissions.userId, userId)
            )
          )
          .limit(1);

        if (existingPermission.length > 0) {
          // Update existing permission
          await db
            .update(mapPermissions)
            .set({ permission, customPermissions: customPermissions || null, updatedAt: new Date() })
            .where(eq(mapPermissions.id, existingPermission[0].id));
        } else {
          // Create new permission
          await db.insert(mapPermissions).values({
            id: nanoid(),
            mapId,
            userId,
            permission,
            customPermissions: customPermissions || null,
            grantedBy: session.user.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }

        return Response.json({ success: true, type: "permission" });
      }

      // If email provided, check if user exists or create invitation
      if (email) {
        // Check if user exists with this email
        const existingUser = await db
          .select({ id: user.id })
          .from(user)
          .where(eq(user.email, email.toLowerCase()))
          .limit(1);

        if (existingUser.length > 0) {
          // User exists, create direct permission
          const existingPermission = await db
            .select({ id: mapPermissions.id })
            .from(mapPermissions)
            .where(
              and(
                eq(mapPermissions.mapId, mapId),
                eq(mapPermissions.userId, existingUser[0].id)
              )
            )
            .limit(1);

          if (existingPermission.length > 0) {
            await db
              .update(mapPermissions)
              .set({ permission, customPermissions: customPermissions || null, updatedAt: new Date() })
              .where(eq(mapPermissions.id, existingPermission[0].id));
          } else {
            await db.insert(mapPermissions).values({
              id: nanoid(),
              mapId,
              userId: existingUser[0].id,
              permission,
              customPermissions: customPermissions || null,
              grantedBy: session.user.id,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }

          return Response.json({ success: true, type: "permission" });
        }

        // User doesn't exist, create invitation
        const existingInvite = await db
          .select({ id: mapInvitations.id })
          .from(mapInvitations)
          .where(
            and(
              eq(mapInvitations.mapId, mapId),
              eq(mapInvitations.email, email.toLowerCase())
            )
          )
          .limit(1);

        if (existingInvite.length > 0) {
          // Update existing invitation
          const token = nanoid(32);
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

          await db
            .update(mapInvitations)
            .set({ permission, token, expiresAt })
            .where(eq(mapInvitations.id, existingInvite[0].id));

          return Response.json({ success: true, type: "invitation", token });
        } else {
          // Create new invitation
          const token = nanoid(32);
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

          await db.insert(mapInvitations).values({
            id: nanoid(),
            mapId,
            email: email.toLowerCase(),
            permission,
            invitedBy: session.user.id,
            token,
            expiresAt,
            createdAt: new Date(),
          });

          return Response.json({ success: true, type: "invitation", token });
        }
      }

      return new Response("Invalid request", { status: 400 });
    }

    case "PUT": {
      // Check share permission (owner only)
      await requireMapPermission(mapId, session.user.id, "share");

      const body = await request.json();
      const { shareId, permission, customPermissions } = body as {
        shareId: string;
        permission?: PermissionLevel;
        customPermissions?: PlayerPermissions | null;
      };

      if (!shareId) {
        return new Response("Share ID required", { status: 400 });
      }

      // Verify the share belongs to this map
      const existingShare = await db
        .select({ id: mapPermissions.id })
        .from(mapPermissions)
        .where(
          and(
            eq(mapPermissions.id, shareId),
            eq(mapPermissions.mapId, mapId)
          )
        )
        .limit(1);

      if (existingShare.length === 0) {
        return new Response("Share not found", { status: 404 });
      }

      const updateData: {
        permission?: PermissionLevel;
        customPermissions?: PlayerPermissions | null;
        updatedAt: Date;
      } = { updatedAt: new Date() };

      if (permission !== undefined) {
        if (!["view", "edit"].includes(permission)) {
          return new Response("Invalid permission level", { status: 400 });
        }
        updateData.permission = permission;
      }

      if (customPermissions !== undefined) {
        updateData.customPermissions = customPermissions;
      }

      await db
        .update(mapPermissions)
        .set(updateData)
        .where(eq(mapPermissions.id, shareId));

      return Response.json({ success: true });
    }

    case "DELETE": {
      // Check share permission (owner only)
      await requireMapPermission(mapId, session.user.id, "share");

      const body = await request.json();
      const { shareId, invitationId } = body as {
        shareId?: string;
        invitationId?: string;
      };

      if (shareId) {
        await db.delete(mapPermissions).where(eq(mapPermissions.id, shareId));
        return Response.json({ success: true });
      }

      if (invitationId) {
        await db
          .delete(mapInvitations)
          .where(eq(mapInvitations.id, invitationId));
        return Response.json({ success: true });
      }

      return new Response("Share ID or invitation ID required", {
        status: 400,
      });
    }

    default:
      return new Response("Method not allowed", { status: 405 });
  }
}
