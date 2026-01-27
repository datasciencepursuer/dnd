import type { Route } from "./+types/api.maps.$mapId.presence.leave";
import { eq, and } from "drizzle-orm";
import { db } from "~/.server/db";
import { mapPresence } from "~/.server/db/schema";
import { requireAuth } from "~/.server/auth/session";

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const session = await requireAuth(request);
  const { mapId } = params;

  if (!mapId) {
    return new Response("Map ID required", { status: 400 });
  }

  try {
    // Parse body - sendBeacon sends as text/plain or application/x-www-form-urlencoded
    let connectionId: string | null = null;

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const body = await request.json();
      connectionId = body.connectionId;
    } else {
      // Handle text/plain from sendBeacon
      const text = await request.text();
      try {
        const parsed = JSON.parse(text);
        connectionId = parsed.connectionId;
      } catch {
        connectionId = text;
      }
    }

    if (connectionId) {
      // Remove presence for this specific connection
      await db
        .delete(mapPresence)
        .where(
          and(
            eq(mapPresence.mapId, mapId),
            eq(mapPresence.userId, session.user.id),
            eq(mapPresence.connectionId, connectionId)
          )
        );
    } else {
      // Fallback: remove all presence records for this user on this map
      await db
        .delete(mapPresence)
        .where(
          and(
            eq(mapPresence.mapId, mapId),
            eq(mapPresence.userId, session.user.id)
          )
        );
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Failed to remove presence:", error);
    return new Response("Failed to remove presence", { status: 500 });
  }
}
