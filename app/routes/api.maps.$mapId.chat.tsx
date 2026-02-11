import { eq, asc, or, isNull, and } from "drizzle-orm";
import { db } from "~/.server/db";
import { mapChatMessages } from "~/.server/db/schema";
import { requireAuth } from "~/.server/auth/session";
import { requireMapPermission } from "~/.server/permissions/map-permissions";

interface RouteArgs {
  request: Request;
  params: { mapId: string };
}

export async function loader({ request, params }: RouteArgs) {
  const session = await requireAuth(request);
  const mapId = params.mapId;

  await requireMapPermission(mapId, session.user.id, "view");

  const messages = await db
    .select()
    .from(mapChatMessages)
    .where(
      and(
        eq(mapChatMessages.mapId, mapId),
        or(
          isNull(mapChatMessages.recipientId),
          eq(mapChatMessages.userId, session.user.id),
          eq(mapChatMessages.recipientId, session.user.id),
        )
      )
    )
    .orderBy(asc(mapChatMessages.createdAt))
    .limit(200);

  return Response.json({ messages });
}

export async function action({ request, params }: RouteArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const session = await requireAuth(request);
  const mapId = params.mapId;

  const access = await requireMapPermission(mapId, session.user.id, "view");

  const body = await request.json();
  const { id, message, metadata, recipientId } = body as {
    id: string;
    message: string;
    metadata?: unknown;
    recipientId?: string;
  };

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return Response.json({ error: "Message is required" }, { status: 400 });
  }

  if (message.length > 500) {
    return Response.json({ error: "Message too long (max 500 characters)" }, { status: 400 });
  }

  const role = access.isDungeonMaster ? "dm" : "player";

  const [saved] = await db
    .insert(mapChatMessages)
    .values({
      id: id || crypto.randomUUID(),
      mapId,
      userId: session.user.id,
      userName: session.user.name,
      message: message.trim(),
      role,
      metadata: metadata ?? null,
      recipientId: recipientId || null,
    })
    .onConflictDoNothing()
    .returning();

  return Response.json({ message: saved });
}
