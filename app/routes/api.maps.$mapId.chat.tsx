import { eq, asc } from "drizzle-orm";
import { db } from "~/.server/db";
import { mapChatChunks } from "~/.server/db/schema";
import { requireAuth } from "~/.server/auth/session";
import { requireMapPermission } from "~/.server/permissions/map-permissions";
import type { ChatMessageData } from "~/features/map-editor/store/chat-store";

interface RouteArgs {
  request: Request;
  params: { mapId: string };
}

export async function loader({ request, params }: RouteArgs) {
  const session = await requireAuth(request);
  const mapId = params.mapId;

  await requireMapPermission(mapId, session.user.id, "view");

  const chunks = await db
    .select()
    .from(mapChatChunks)
    .where(eq(mapChatChunks.mapId, mapId))
    .orderBy(asc(mapChatChunks.createdAt));

  // Flatten all chunks and deduplicate (multiple clients may persist the same message)
  const seen = new Set<string>();
  const allMessages: ChatMessageData[] = [];
  for (const chunk of chunks) {
    for (const msg of chunk.messages as ChatMessageData[]) {
      if (!seen.has(msg.id)) {
        seen.add(msg.id);
        allMessages.push(msg);
      }
    }
  }

  // Filter whispers in JS
  const userId = session.user.id;
  const visible = allMessages.filter(
    (msg) =>
      !msg.recipientId ||
      msg.userId === userId ||
      msg.recipientId === userId
  );

  // Return last 200
  const messages = visible.slice(-200);

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
  const { id, message, metadata, recipientId, recipientName } = body as {
    id: string;
    message: string;
    metadata?: unknown;
    recipientId?: string;
    recipientName?: string;
  };

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return Response.json({ error: "Message is required" }, { status: 400 });
  }

  if (message.length > 500) {
    return Response.json({ error: "Message too long (max 500 characters)" }, { status: 400 });
  }

  const role = access.isDungeonMaster ? "dm" : "player";
  const now = new Date();

  const messageData: ChatMessageData = {
    id: id || crypto.randomUUID(),
    mapId,
    userId: session.user.id,
    userName: session.user.name,
    message: message.trim(),
    role,
    createdAt: now.toISOString(),
    metadata: metadata as ChatMessageData["metadata"] ?? null,
    recipientId: recipientId || null,
    recipientName: recipientName || null,
  };

  const chunkId = crypto.randomUUID();
  await db.insert(mapChatChunks).values({
    id: chunkId,
    mapId,
    messages: [messageData],
    createdAt: now,
  });

  return Response.json({ message: messageData });
}
