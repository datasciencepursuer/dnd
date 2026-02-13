import usePartySocket from "partysocket/react";
import { useCallback } from "react";

// Reuses the existing map party server (party/map.ts).
// Room name is "schedule-{groupId}" to avoid collision with map rooms.
// The server simply broadcasts any message to all other clients in the room.

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
  const socket = usePartySocket({
    host: PARTYKIT_HOST,
    room: `schedule-${groupId}`,
    query: { userId },
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
