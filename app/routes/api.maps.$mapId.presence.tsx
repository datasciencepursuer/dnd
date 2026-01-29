import type { Route } from "./+types/api.maps.$mapId.presence";
import { eq, and, lt } from "drizzle-orm";
import { db } from "~/.server/db";
import { mapPresence, user, maps } from "~/.server/db/schema";
import { requireAuth } from "~/.server/auth/session";
import { requireMapPermission } from "~/.server/permissions/map-permissions";

const POLL_INTERVAL = 5000; // 5 seconds - optimized for D&D sessions (8 users max)
const STALE_THRESHOLD = 60000; // 60 seconds - improved connection stability
const MAP_SYNC_INTERVAL = 2000; // 2 seconds - balanced responsiveness vs performance

export async function loader({ request, params }: Route.LoaderArgs) {
  const session = await requireAuth(request);
  const { mapId } = params;

  if (!mapId) {
    return new Response("Map ID required", { status: 400 });
  }

  // Check permission to view the map
  await requireMapPermission(mapId, session.user.id, "view");

  // Generate a unique connection ID for this SSE connection
  const connectionId = crypto.randomUUID();
  const presenceId = crypto.randomUUID();

  // Create a ReadableStream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      // Register presence
      try {
        await db.insert(mapPresence).values({
          id: presenceId,
          mapId,
          userId: session.user.id,
          connectionId,
          lastSeen: new Date(),
        });
      } catch (error) {
        console.error("Failed to register presence:", error);
      }

      // Send initial connection ID
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ connectionId })}\n\n`)
      );

      // Function to send presence update - optimized for user-based tracking
      const sendPresenceUpdate = async () => {
        try {
          // Update our own heartbeat - upsert to handle single record per user
          await db
            .insert(mapPresence)
            .values({
              id: presenceId,
              mapId,
              userId: session.user.id,
              connectionId,
              lastSeen: new Date(),
            })
            .onConflictDoUpdate({
              target: [mapPresence.mapId, mapPresence.userId],
              set: {
                lastSeen: new Date(),
                connectionId, // Update connection ID in case user reopened tab
              },
            });

          // Clean up stale records (older than STALE_THRESHOLD)
          const staleTime = new Date(Date.now() - STALE_THRESHOLD);
          await db
            .delete(mapPresence)
            .where(
              and(
                eq(mapPresence.mapId, mapId),
                lt(mapPresence.lastSeen, staleTime)
              )
            );

          // Get all active users for this map (now naturally deduplicated)
          const activePresence = await db
            .select({
              id: user.id,
              name: user.name,
              image: user.image,
            })
            .from(mapPresence)
            .innerJoin(user, eq(mapPresence.userId, user.id))
            .where(eq(mapPresence.mapId, mapId));

          // Send presence event (no need for manual deduplication)
          controller.enqueue(
            encoder.encode(`event: presence\ndata: ${JSON.stringify({ users: activePresence })}\n\n`)
          );
        } catch (error) {
          console.error("Failed to send presence update:", error);
        }
      };

      // Track last known map update time
      let lastMapUpdate: Date | null = null;

      // Function to check and send map updates - with selective sync for performance
      const sendMapUpdate = async () => {
        try {
          const mapData = await db
            .select({
              data: maps.data,
              updatedAt: maps.updatedAt,
              userId: maps.userId, // Get map owner to determine user's role
            })
            .from(maps)
            .where(eq(maps.id, mapId))
            .limit(1);

          if (mapData.length === 0) return;

          const currentUpdate = mapData[0].updatedAt;

          // Only send if the map has been updated since last check
          if (lastMapUpdate === null || currentUpdate > lastMapUpdate) {
            lastMapUpdate = currentUpdate;

            const isDM = mapData[0].userId === session.user.id;

            // Selective sync: DMs get full map, players get token-focused updates
            const syncData = isDM
              ? {
                  data: mapData[0].data,
                  updatedAt: currentUpdate.toISOString(),
                  syncType: "full"
                }
              : {
                  data: {
                    tokens: mapData[0].data?.tokens || {},
                    updatedAt: mapData[0].data?.updatedAt
                  },
                  updatedAt: currentUpdate.toISOString(),
                  syncType: "tokens"
                };

            // Send map sync event
            controller.enqueue(
              encoder.encode(
                `event: mapSync\ndata: ${JSON.stringify(syncData)}\n\n`
              )
            );
          }
        } catch (error) {
          console.error("Failed to send map update:", error);
        }
      };

      // Send initial updates
      await sendPresenceUpdate();
      await sendMapUpdate();

      // Set up polling intervals
      const presenceIntervalId = setInterval(sendPresenceUpdate, POLL_INTERVAL);
      const mapSyncIntervalId = setInterval(sendMapUpdate, MAP_SYNC_INTERVAL);

      // Handle abort signal (client disconnect)
      request.signal.addEventListener("abort", async () => {
        clearInterval(presenceIntervalId);
        clearInterval(mapSyncIntervalId);

        // Remove our presence record
        try {
          await db
            .delete(mapPresence)
            .where(eq(mapPresence.id, presenceId));
        } catch (error) {
          console.error("Failed to clean up presence:", error);
        }

        try {
          controller.close();
        } catch {
          // Stream may already be closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
