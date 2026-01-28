import { useCallback, useRef } from "react";
import { useMapStore } from "../store/map-store";
import type { GridPosition } from "../types";

/**
 * Hook for syncing map changes to the server.
 * Provides both debounced and immediate sync options.
 */
export function useMapSync(mapId: string | undefined) {
  const pendingSyncRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncRef = useRef<string | null>(null);

  /**
   * Immediately sync the current map state to the server.
   * Use this for high-priority changes (requires edit permission).
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
   * Sync a token movement to the server.
   * Uses a dedicated endpoint that allows token owners to move their tokens.
   */
  const syncTokenMove = useCallback(
    async (tokenId: string, position: GridPosition) => {
      if (!mapId) return;

      try {
        const response = await fetch(`/api/maps/${mapId}/tokens/${tokenId}/move`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ col: position.col, row: position.row }),
        });

        if (!response.ok) {
          // Fall back to full sync if token move endpoint fails
          // (e.g., user has full edit permission)
          await syncNow();
        }
      } catch (error) {
        console.error("Failed to sync token move:", error);
      }
    },
    [mapId, syncNow]
  );

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

  return { syncNow, syncDebounced, syncTokenMove };
}
