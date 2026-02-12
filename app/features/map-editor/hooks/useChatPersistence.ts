import { useEffect, useCallback, useRef } from "react";
import { useChatStore } from "../store/chat-store";
import { usePresenceStore } from "../store/presence-store";

const FLUSH_INTERVAL_MS = 30_000;

/**
 * Client-side persistence for chat messages.
 * Buffers new messages and flushes to the DB every 30 seconds as JSONB chunks.
 * Also flushes immediately on WebSocket disconnect, unmount, and beforeunload.
 */
export function useChatPersistence(mapId: string | undefined) {
  const connected = usePresenceStore((s) => s.isConnected);
  const prevConnectedRef = useRef(connected);

  const flushAsync = useCallback(async () => {
    if (!mapId) return;
    const batch = useChatStore.getState().takePendingPersist();
    if (batch.length === 0) return;

    try {
      const res = await fetch(`/api/maps/${mapId}/chat/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: batch }),
      });
      if (!res.ok) {
        useChatStore.getState().returnPendingPersist(batch);
      }
    } catch {
      useChatStore.getState().returnPendingPersist(batch);
    }
  }, [mapId]);

  // Periodic flush every 30 seconds + cleanup handlers
  useEffect(() => {
    if (!mapId) return;

    const flushBeforeUnload = () => {
      const batch = useChatStore.getState().takePendingPersist();
      if (batch.length === 0) return;
      navigator.sendBeacon(
        `/api/maps/${mapId}/chat/batch`,
        new Blob([JSON.stringify({ messages: batch })], { type: "application/json" }),
      );
    };

    const intervalId = setInterval(flushAsync, FLUSH_INTERVAL_MS);
    window.addEventListener("beforeunload", flushBeforeUnload);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("beforeunload", flushBeforeUnload);
      // Flush remaining on unmount (in-app navigation)
      const remaining = useChatStore.getState().takePendingPersist();
      if (remaining.length > 0) {
        fetch(`/api/maps/${mapId}/chat/batch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: remaining }),
          keepalive: true,
        }).catch(() => {});
      }
    };
  }, [mapId, flushAsync]);

  // Flush immediately on WebSocket disconnect (connection drop or intentional leave)
  useEffect(() => {
    if (prevConnectedRef.current && !connected) {
      flushAsync();
    }
    prevConnectedRef.current = connected;
  }, [connected, flushAsync]);
}
