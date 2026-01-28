import { useCallback, useRef } from "react";
import { useMapStore } from "../store/map-store";

/**
 * Hook for syncing map changes to the server.
 * Provides both debounced and immediate sync options.
 */
export function useMapSync(mapId: string | undefined) {
  const pendingSyncRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncRef = useRef<string | null>(null);

  /**
   * Immediately sync the current map state to the server.
   * Use this for high-priority changes like token movements.
   */
  const syncNow = useCallback(async () => {
    if (!mapId) return;

    const map = useMapStore.getState().map;
    if (!map) return;

    // Cancel any pending debounced sync
    if (pendingSyncRef.current) {
      clearTimeout(pendingSyncRef.current);
      pendingSyncRef.current = null;
    }

    // Skip if we just synced this exact state
    const mapHash = map.updatedAt;
    if (lastSyncRef.current === mapHash) return;

    try {
      await fetch(`/api/maps/${mapId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: map.name, data: map }),
      });
      lastSyncRef.current = mapHash;
    } catch (error) {
      console.error("Failed to sync map:", error);
    }
  }, [mapId]);

  /**
   * Sync after a short delay (for batching rapid changes).
   * Use this for less critical updates.
   */
  const syncDebounced = useCallback(
    (delay = 500) => {
      if (!mapId) return;

      // Cancel any pending sync
      if (pendingSyncRef.current) {
        clearTimeout(pendingSyncRef.current);
      }

      pendingSyncRef.current = setTimeout(() => {
        syncNow();
        pendingSyncRef.current = null;
      }, delay);
    },
    [mapId, syncNow]
  );

  return { syncNow, syncDebounced };
}
