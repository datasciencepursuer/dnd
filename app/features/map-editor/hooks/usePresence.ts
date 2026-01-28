import { useEffect, useRef, useCallback } from "react";
import { usePresenceStore } from "../store/presence-store";
import { useMapStore } from "../store/map-store";
import type { DnDMap } from "../types";

const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY = 2000; // 2 seconds
const MAX_RECONNECT_DELAY = 30000; // 30 seconds

export function usePresence(mapId: string | undefined) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const connectionIdRef = useRef<string | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUnmountedRef = useRef(false);
  const lastMapUpdateRef = useRef<string | null>(null);

  const setUsers = usePresenceStore((s) => s.setUsers);
  const setConnected = usePresenceStore((s) => s.setConnected);
  const setError = usePresenceStore((s) => s.setError);
  const setConnectionId = usePresenceStore((s) => s.setConnectionId);
  const reset = usePresenceStore((s) => s.reset);
  const syncMap = useMapStore((s) => s.syncMap);

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!mapId || eventSourceRef.current || isUnmountedRef.current) return;

    const eventSource = new EventSource(`/api/maps/${mapId}/presence`);
    eventSourceRef.current = eventSource;

    eventSource.addEventListener("connected", (event) => {
      try {
        const data = JSON.parse(event.data);
        connectionIdRef.current = data.connectionId;
        setConnectionId(data.connectionId);
        setConnected(true);
        setError(null);
        // Reset retry count on successful connection
        reconnectAttemptsRef.current = 0;
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

    eventSource.addEventListener("mapSync", (event) => {
      try {
        const data = JSON.parse(event.data);
        const serverUpdatedAt = data.updatedAt;

        // Only update if server has a different version than what we last received
        if (lastMapUpdateRef.current !== serverUpdatedAt) {
          // Check if server data is newer than our local data
          const localMap = useMapStore.getState().map;
          const localUpdatedAt = localMap?.updatedAt;

          // Only apply server sync if server is newer or within 2 seconds (clock tolerance)
          // This prevents stale SSE data from overwriting local optimistic updates
          const serverTime = new Date(serverUpdatedAt).getTime();
          const localTime = localUpdatedAt ? new Date(localUpdatedAt).getTime() : 0;
          const clockTolerance = 2000; // 2 seconds

          if (!localUpdatedAt || serverTime >= localTime - clockTolerance) {
            lastMapUpdateRef.current = serverUpdatedAt;
            // Use syncMap to preserve the current viewport
            syncMap(data.data as DnDMap);
          }
        }
      } catch (error) {
        console.error("Failed to parse mapSync event:", error);
      }
    });

    eventSource.onerror = () => {
      setConnected(false);

      // Clean up current connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      // Don't reconnect if unmounted or max attempts reached
      if (isUnmountedRef.current) return;

      reconnectAttemptsRef.current++;

      if (reconnectAttemptsRef.current > MAX_RECONNECT_ATTEMPTS) {
        setError("Connection failed. Please refresh the page.");
        return;
      }

      // Exponential backoff with jitter
      const delay = Math.min(
        BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current - 1) +
          Math.random() * 1000,
        MAX_RECONNECT_DELAY
      );

      setError(`Connection lost. Reconnecting in ${Math.round(delay / 1000)}s...`);

      // Clear any existing reconnect timeout
      clearReconnectTimeout();

      // Try to reconnect after delay
      reconnectTimeoutRef.current = setTimeout(() => {
        if (document.visibilityState === "visible" && mapId && !isUnmountedRef.current) {
          connect();
        }
      }, delay);
    };
  }, [mapId, setUsers, setConnected, setError, setConnectionId, clearReconnectTimeout, syncMap]);

  const disconnect = useCallback(() => {
    clearReconnectTimeout();

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    connectionIdRef.current = null;
    setConnected(false);
  }, [setConnected, clearReconnectTimeout]);

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
        // Reset retry count when user comes back
        reconnectAttemptsRef.current = 0;
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
    isUnmountedRef.current = false;

    if (!mapId) {
      reset();
      return;
    }

    connect();

    return () => {
      isUnmountedRef.current = true;
      clearReconnectTimeout();
      sendLeaveBeacon();
      disconnect();
      reset();
    };
  }, [mapId, connect, disconnect, sendLeaveBeacon, reset, clearReconnectTimeout]);
}
