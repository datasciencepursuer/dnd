import { useCallback, useMemo } from "react";
import { useMapStore } from "../store";
import type { Token, GridPosition, TokenLayer } from "../types";

export interface TokenActions {
  // Movement
  move: (position: GridPosition) => void;
  moveBy: (deltaCol: number, deltaRow: number) => void;

  // Appearance
  flip: () => void;
  rotate: (degrees: number) => void;
  rotateBy: (deltaDegrees: number) => void;
  setColor: (color: string) => void;
  setSize: (size: number) => void;
  setImage: (imageUrl: string | null) => void;

  // Visibility & Layer
  show: () => void;
  hide: () => void;
  toggleVisibility: () => void;
  setLayer: (layer: TokenLayer) => void;

  // Identity
  setName: (name: string) => void;

  // Generic update (for complex operations)
  update: (updates: Partial<Token>) => void;

  // Removal
  remove: () => void;

  // Token reference
  token: Token | null;
}

/**
 * Hook that provides granular, token-specific actions.
 * Each action is bound to the specific token ID and can be extended.
 */
export function useTokenActions(tokenId: string | null): TokenActions {
  const map = useMapStore((s) => s.map);
  const updateToken = useMapStore((s) => s.updateToken);
  const removeToken = useMapStore((s) => s.removeToken);
  const moveToken = useMapStore((s) => s.moveToken);
  const flipToken = useMapStore((s) => s.flipToken);

  // Get the current token
  const token = useMemo(() => {
    if (!map || !tokenId) return null;
    return map.tokens.find((t) => t.id === tokenId) || null;
  }, [map, tokenId]);

  // Movement actions
  const move = useCallback(
    (position: GridPosition) => {
      if (tokenId) moveToken(tokenId, position);
    },
    [tokenId, moveToken]
  );

  const moveBy = useCallback(
    (deltaCol: number, deltaRow: number) => {
      if (!token || !tokenId) return;
      moveToken(tokenId, {
        col: token.position.col + deltaCol,
        row: token.position.row + deltaRow,
      });
    },
    [token, tokenId, moveToken]
  );

  // Appearance actions
  const flip = useCallback(() => {
    if (tokenId) flipToken(tokenId);
  }, [tokenId, flipToken]);

  const rotate = useCallback(
    (degrees: number) => {
      if (tokenId) updateToken(tokenId, { rotation: degrees });
    },
    [tokenId, updateToken]
  );

  const rotateBy = useCallback(
    (deltaDegrees: number) => {
      if (!token || !tokenId) return;
      updateToken(tokenId, { rotation: token.rotation + deltaDegrees });
    },
    [token, tokenId, updateToken]
  );

  const setColor = useCallback(
    (color: string) => {
      if (tokenId) updateToken(tokenId, { color });
    },
    [tokenId, updateToken]
  );

  const setSize = useCallback(
    (size: number) => {
      if (tokenId) updateToken(tokenId, { size: Math.max(1, size) });
    },
    [tokenId, updateToken]
  );

  const setImage = useCallback(
    (imageUrl: string | null) => {
      if (tokenId) updateToken(tokenId, { imageUrl });
    },
    [tokenId, updateToken]
  );

  // Visibility actions
  const show = useCallback(() => {
    if (tokenId) updateToken(tokenId, { visible: true });
  }, [tokenId, updateToken]);

  const hide = useCallback(() => {
    if (tokenId) updateToken(tokenId, { visible: false });
  }, [tokenId, updateToken]);

  const toggleVisibility = useCallback(() => {
    if (!token || !tokenId) return;
    updateToken(tokenId, { visible: !token.visible });
  }, [token, tokenId, updateToken]);

  // Layer actions
  const setLayer = useCallback(
    (layer: TokenLayer) => {
      if (tokenId) updateToken(tokenId, { layer });
    },
    [tokenId, updateToken]
  );

  // Identity actions
  const setName = useCallback(
    (name: string) => {
      if (tokenId) updateToken(tokenId, { name });
    },
    [tokenId, updateToken]
  );

  // Generic update
  const update = useCallback(
    (updates: Partial<Token>) => {
      if (tokenId) updateToken(tokenId, updates);
    },
    [tokenId, updateToken]
  );

  // Removal
  const remove = useCallback(() => {
    if (tokenId) removeToken(tokenId);
  }, [tokenId, removeToken]);

  return {
    move,
    moveBy,
    flip,
    rotate,
    rotateBy,
    setColor,
    setSize,
    setImage,
    show,
    hide,
    toggleVisibility,
    setLayer,
    setName,
    update,
    remove,
    token,
  };
}

/**
 * Hook that provides actions for multiple tokens at once.
 * Useful for bulk operations on selected tokens.
 */
export function useMultiTokenActions(tokenIds: string[]) {
  const updateToken = useMapStore((s) => s.updateToken);
  const removeToken = useMapStore((s) => s.removeToken);
  const moveToken = useMapStore((s) => s.moveToken);

  const moveAll = useCallback(
    (deltaCol: number, deltaRow: number) => {
      // This would need access to current positions - simplified for now
      tokenIds.forEach((id) => {
        const map = useMapStore.getState().map;
        const token = map?.tokens.find((t) => t.id === id);
        if (token) {
          moveToken(id, {
            col: token.position.col + deltaCol,
            row: token.position.row + deltaRow,
          });
        }
      });
    },
    [tokenIds, moveToken]
  );

  const updateAll = useCallback(
    (updates: Partial<Token>) => {
      tokenIds.forEach((id) => updateToken(id, updates));
    },
    [tokenIds, updateToken]
  );

  const removeAll = useCallback(() => {
    tokenIds.forEach((id) => removeToken(id));
  }, [tokenIds, removeToken]);

  const setLayerAll = useCallback(
    (layer: TokenLayer) => {
      tokenIds.forEach((id) => updateToken(id, { layer }));
    },
    [tokenIds, updateToken]
  );

  const showAll = useCallback(() => {
    tokenIds.forEach((id) => updateToken(id, { visible: true }));
  }, [tokenIds, updateToken]);

  const hideAll = useCallback(() => {
    tokenIds.forEach((id) => updateToken(id, { visible: false }));
  }, [tokenIds, updateToken]);

  return {
    moveAll,
    updateAll,
    removeAll,
    setLayerAll,
    showAll,
    hideAll,
  };
}
