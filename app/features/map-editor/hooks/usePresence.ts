import { useEffect, useRef, useCallback } from "react";
import { usePresenceStore } from "../store/presence-store";

export function usePresence(mapId: string | undefined) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const connectionIdRef = useRef<string | null>(null);

  const setUsers = usePresenceStore((s) => s.setUsers);
  const setConnected = usePresenceStore((s) => s.setConnected);
  const setError = usePresenceStore((s) => s.setError);
  const setConnectionId = usePresenceStore((s) => s.setConnectionId);
  const reset = usePresenceStore((s) => s.reset);

  const connect = useCallback(() => {
    if (!mapId || eventSourceRef.current) return;

    const eventSource = new EventSource(`/api/maps/${mapId}/presence`);
    eventSourceRef.current = eventSource;

    eventSource.addEventListener("connected", (event) => {
      try {
        const data = JSON.parse(event.data);
        connectionIdRef.current = data.connectionId;
        setConnectionId(data.connectionId);
        setConnected(true);
        setError(null);
      } catch (error) {
        console.error("Failed to parse connected event:", error);
      }
    });

    eventSource.addEventListener("presence", (event) => {
      try {
        const data = JSON.parse(event.data);
        setUsers(data.users);
      } catch (error) {
        console.error("Failed to parse presence event:", error);
      }
    });

    eventSource.onerror = () => {
      setConnected(false);
      setError("Connection lost. Reconnecting...");

      // EventSource will auto-reconnect, but clean up our state
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      // Try to reconnect after a short delay
      setTimeout(() => {
        if (document.visibilityState === "visible" && mapId) {
          connect();
        }
      }, 2000);
    };
  }, [mapId, setUsers, setConnected, setError, setConnectionId]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    connectionIdRef.current = null;
    setConnected(false);
  }, [setConnected]);

  const sendLeaveBeacon = useCallback(() => {
    if (!mapId || !connectionIdRef.current) return;

    const data = JSON.stringify({ connectionId: connectionIdRef.current });
    navigator.sendBeacon(`/api/maps/${mapId}/presence/leave`, data);
  }, [mapId]);

  // Handle visibility changes
  useEffect(() => {
    if (!mapId) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        connect();
      } else {
        // Don't disconnect immediately - let the SSE handle it
        // But send beacon just in case
        sendLeaveBeacon();
        disconnect();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [mapId, connect, disconnect, sendLeaveBeacon]);

  // Handle beforeunload
  useEffect(() => {
    if (!mapId) return;

    const handleBeforeUnload = () => {
      sendLeaveBeacon();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [mapId, sendLeaveBeacon]);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    if (!mapId) {
      reset();
      return;
    }

    connect();

    return () => {
      sendLeaveBeacon();
      disconnect();
      reset();
    };
  }, [mapId, connect, disconnect, sendLeaveBeacon, reset]);
}
