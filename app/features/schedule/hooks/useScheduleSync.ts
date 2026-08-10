import usePartySocket from "partysocket/react";
import { useCallback } from "react";
import { apiUrl } from "~/lib/api-config";

// Reuses the existing PartyKit server (party/map.ts).
// Room name is "schedule-{groupId}" to avoid collision with map rooms.

const PARTYKIT_HOST = import.meta.env.VITE_PARTYKIT_HOST || "127.0.0.1:1999";

interface UseScheduleSyncOptions {
  groupId: string;
  userId: string;
  onRemoteAvailabilityUpdate: () => void;
  onRemoteVoteUpdate: () => void;
}

export function useScheduleSync({
  groupId,
  userId,
  onRemoteAvailabilityUpdate,
  onRemoteVoteUpdate,
}: UseScheduleSyncOptions) {
  const partyAuthQuery = useCallback(async () => {
    const response = await fetch(apiUrl(`/api/groups/${groupId}/party-token`), {
      method: "POST",
      credentials: "include",
    });
    if (!response.ok) throw new Error("Unable to authorize schedule synchronization");

    const body = (await response.json()) as { token?: string };
    if (!body.token) throw new Error("Schedule synchronization authorization was empty");
    return { auth: body.token };
  }, [groupId]);

  const socket = usePartySocket({
    host: PARTYKIT_HOST,
    room: `schedule-${groupId}`,
    query: partyAuthQuery,
    onMessage(event) {
      try {
        const data = JSON.parse(event.data);
        if (data.userId === userId) return;
        if (data.type === "availability-update") {
          onRemoteAvailabilityUpdate();
        } else if (data.type === "vote-update") {
          onRemoteVoteUpdate();
        }
      } catch {
        // ignore
      }
    },
  });

  const broadcastAvailabilityUpdate = useCallback(() => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "availability-update", userId }));
    }
  }, [socket, userId]);

  const broadcastVoteUpdate = useCallback(() => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "vote-update", userId }));
    }
  }, [socket, userId]);

  return { broadcastAvailabilityUpdate, broadcastVoteUpdate };
}
