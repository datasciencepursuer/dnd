import { db } from "~/.server/db";
import { mapChatChunks } from "~/.server/db/schema";

interface RouteArgs {
  request: Request;
  params: { mapId: string };
}

/**
 * Internal batch endpoint for PartyKit to flush buffered chat messages.
 * Authenticated via shared secret (BETTER_AUTH_SECRET), not user session.
 * Stores the entire batch as a single JSONB chunk row.
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
      recipientName?: string | null;
      createdAt: string;
    }>;
  };

  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ inserted: 0 });
  }

  const chunkId = crypto.randomUUID();
  await db.insert(mapChatChunks).values({
    id: chunkId,
    mapId,
    messages: messages,
    createdAt: new Date(),
  });

  return Response.json({ inserted: messages.length });
}
