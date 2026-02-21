import { db } from "~/.server/db";
import { mapChatChunks } from "~/.server/db/schema";
import { requireAuth } from "~/.server/auth/session";
import { requireMapPermission } from "~/.server/permissions/map-permissions";
import { getUserTierLimits } from "~/.server/subscription";

interface RouteArgs {
  request: Request;
  params: { mapId: string };
}

/**
 * Batch endpoint for persisting chat message chunks.
 * Called by the client every 30 seconds to flush buffered messages.
 */
export async function action({ request, params }: RouteArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const session = await requireAuth(request);
  const mapId = params.mapId;

  await requireMapPermission(mapId, session.user.id, "view");

  const body = await request.json();
  const { messages } = body as {
    messages: Array<{
      id: string;
      userId: string;
      userName: string;
      message: string;
      role: string;
      metadata?: unknown;
      recipientId?: string | null;
      recipientName?: string | null;
      createdAt: string;
    }>;
  };

  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ inserted: 0 });
  }

  // Strip whisper messages if user lacks chatWhispers tier
  const limits = await getUserTierLimits(session.user.id);
  const filtered = limits.chatWhispers
    ? messages
    : messages.filter((m) => !m.recipientId);

  if (filtered.length === 0) {
    return Response.json({ inserted: 0 });
  }

  const chunkId = crypto.randomUUID();
  await db.insert(mapChatChunks).values({
    id: chunkId,
    mapId,
    messages: filtered,
    createdAt: new Date(),
  });

  return Response.json({ inserted: filtered.length });
}
