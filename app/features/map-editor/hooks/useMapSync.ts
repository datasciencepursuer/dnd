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
   * Sync a token deletion to the server.
   * Uses a dedicated endpoint that allows token owners to delete their tokens.
   */
  const syncTokenDelete = useCallback(
    async (tokenId: string) => {
      if (!mapId) return;

      try {
        const response = await fetch(`/api/maps/${mapId}/tokens/${tokenId}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          console.error("Failed to sync token delete:", await response.text());
        }
      } catch (error) {
        console.error("Failed to sync token delete:", error);
      }
    },
    [mapId]
  );

  /**
   * Sync a token update to the server.
   * Uses a dedicated endpoint that allows token owners to edit their tokens.
   */
  const syncTokenUpdate = useCallback(
    async (tokenId: string, updates: Record<string, unknown>) => {
      if (!mapId) return;

      try {
        const response = await fetch(`/api/maps/${mapId}/tokens/${tokenId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          console.error("Failed to sync token update:", await response.text());
        }
      } catch (error) {
        console.error("Failed to sync token update:", error);
      }
    },
    [mapId]
  );

  /**
   * Sync after a short delay (for batching rapid changes).
   * Use this for less critical updates. Increased delay for better performance.
   */
  const syncDebounced = useCallback(
    (delay = 1000) => { // Increased from 500ms to 1s for better batching
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

  return { syncNow, syncDebounced, syncTokenMove, syncTokenDelete, syncTokenUpdate };
}
