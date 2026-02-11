import { db } from "~/.server/db";
import { mapChatMessages } from "~/.server/db/schema";

interface RouteArgs {
  request: Request;
  params: { mapId: string };
}

/**
 * Internal batch endpoint for PartyKit to flush buffered chat messages.
 * Authenticated via shared secret (BETTER_AUTH_SECRET), not user session.
 */
export async function action({ request, params }: RouteArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Verify shared secret
  const authHeader = request.headers.get("x-party-secret");
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!authHeader || !secret || authHeader !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }

  const mapId = params.mapId;
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
      createdAt: string;
    }>;
  };

  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ inserted: 0 });
  }

  const values = messages.map((msg) => ({
    id: msg.id,
    mapId,
    userId: msg.userId,
    userName: msg.userName,
    message: msg.message,
    role: msg.role,
    metadata: msg.metadata ?? null,
    recipientId: msg.recipientId || null,
    createdAt: new Date(msg.createdAt),
  }));

  const result = await db
    .insert(mapChatMessages)
    .values(values)
    .onConflictDoNothing()
    .returning({ id: mapChatMessages.id });

  return Response.json({ inserted: result.length });
}
