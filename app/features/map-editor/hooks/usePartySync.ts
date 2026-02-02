import usePartySocket from "partysocket/react";
import { useCallback, useEffect, useState } from "react";
import { useMapStore } from "../store/map-store";
import { usePresenceStore } from "../store/presence-store";
import type { DnDMap, GridPosition, Token, Ping } from "../types";

// Message types matching the server
interface TokenMoveMessage {
  type: "token-move";
  tokenId: string;
  position: GridPosition;
  userId: string;
  userName: string;
}

interface TokenUpdateMessage {
  type: "token-update";
  tokenId: string;
  updates: Partial<Token>;
  userId: string;
}

interface TokenDeleteMessage {
  type: "token-delete";
  tokenId: string;
  userId: string;
}

interface TokenCreateMessage {
  type: "token-create";
  token: Token;
  userId: string;
}

interface MapSyncMessage {
  type: "map-sync";
  data: DnDMap;
  userId: string;
}

interface FogPaintMessage {
  type: "fog-paint";
  col: number;
  row: number;
  creatorId: string;
  userId: string;
}

interface FogEraseMessage {
  type: "fog-erase";
  col: number;
  row: number;
  userId: string;
  isDM: boolean;
}

interface FogPaintRangeMessage {
  type: "fog-paint-range";
  startCol: number;
  startRow: number;
  endCol: number;
  endRow: number;
  creatorId: string;
  userId: string;
}

interface FogEraseRangeMessage {
  type: "fog-erase-range";
  startCol: number;
  startRow: number;
  endCol: number;
  endRow: number;
  userId: string;
  isDM: boolean;
}

interface PresenceMessage {
  type: "presence";
  users: Array<{ id: string; name: string }>;
}

interface UserLeaveMessage {
  type: "user-leave";
  userId: string;
}

interface PingMessage {
  type: "ping";
  ping: Ping;
  userId: string;
}

interface DrawingAddMessage {
  type: "drawing-add";
  path: {
    id: string;
    points: number[];
    color: string;
    width: number;
  };
  userId: string;
}

interface DrawingRemoveMessage {
  type: "drawing-remove";
  pathId: string;
  userId: string;
}

interface DmTransferMessage {
  type: "dm-transfer";
  newDmId: string;
  userId: string;
}

interface CombatRequestMessage {
  type: "combat-request";
  requesterId: string;
  requesterName: string;
}

interface InitiativeEntry {
  tokenId: string;
  tokenName: string;
  tokenColor: string;
  initiative: number;
  layer?: string;
  groupId?: string | null;
  groupCount?: number;
  groupTokenIds?: string[];
}

interface CombatResponseMessage {
  type: "combat-response";
  accepted: boolean;
  initiativeOrder: InitiativeEntry[] | null;
}

interface CombatEndMessage {
  type: "combat-end";
  userId: string;
}

type ServerMessage =
  | TokenMoveMessage
  | TokenUpdateMessage
  | TokenDeleteMessage
  | TokenCreateMessage
  | MapSyncMessage
  | FogPaintMessage
  | FogEraseMessage
  | FogPaintRangeMessage
  | FogEraseRangeMessage
  | PresenceMessage
  | UserLeaveMessage
  | PingMessage
  | DrawingAddMessage
  | DrawingRemoveMessage
  | DmTransferMessage
  | CombatRequestMessage
  | CombatResponseMessage
  | CombatEndMessage;

// PartyKit host from environment variable
// In development: defaults to localhost
// In production: set VITE_PARTYKIT_HOST in your .env
const PARTYKIT_HOST = import.meta.env.VITE_PARTYKIT_HOST || "127.0.0.1:1999";

interface UsePartySyncOptions {
  mapId: string | undefined;
  userId: string | null;
  userName: string | null;
  enabled?: boolean;
}

export function usePartySync({
  mapId,
  userId,
  userName,
  enabled = true,
}: UsePartySyncOptions) {
  const moveToken = useMapStore((s) => s.moveToken);
  const updateToken = useMapStore((s) => s.updateToken);
  const removeToken = useMapStore((s) => s.removeToken);
  const addTokenFromSync = useMapStore((s) => s.addTokenFromSync);
  const syncMap = useMapStore((s) => s.syncMap);
  const paintFogCell = useMapStore((s) => s.paintFogCell);
  const eraseFogCell = useMapStore((s) => s.eraseFogCell);
  const paintFogInRange = useMapStore((s) => s.paintFogInRange);
  const eraseFogInRange = useMapStore((s) => s.eraseFogInRange);
  const addFreehandPath = useMapStore((s) => s.addFreehandPath);
  const removeFreehandPath = useMapStore((s) => s.removeFreehandPath);
  const setUsers = usePresenceStore((s) => s.setUsers);
  const setConnected = usePresenceStore((s) => s.setConnected);
  const setError = usePresenceStore((s) => s.setError);

  // Active pings state - pings expire after 3 seconds
  const [activePings, setActivePings] = useState<Ping[]>([]);

  // Combat state
  const [combatRequest, setCombatRequest] = useState<{ requesterId: string; requesterName: string } | null>(null);
  const [initiativeOrder, setInitiativeOrder] = useState<InitiativeEntry[] | null>(null);
  const [isInCombat, setIsInCombat] = useState(false);

  // Only create query params if we have valid user data
  const queryParams = userId
    ? { userId, userName: userName || "Anonymous" }
    : undefined;

  const socket = usePartySocket({
    host: PARTYKIT_HOST,
    room: mapId || "lobby",
    query: queryParams,
    // Only connect if we have required data
    startClosed: !enabled || !mapId || !userId,

    onOpen() {
      setConnected(true);
      setError(null);
    },

    onClose() {
      setConnected(false);
    },

    onError() {
      setError("Connection error. Retrying...");
    },

    onMessage(event) {
      try {
        const message: ServerMessage = JSON.parse(event.data);

        switch (message.type) {
          case "token-move":
            if (message.userId !== userId) {
              moveToken(message.tokenId, message.position);
            }
            break;

          case "token-update":
            if (message.userId !== userId) {
              updateToken(message.tokenId, message.updates);
            }
            break;

          case "token-delete":
            if (message.userId !== userId) {
              removeToken(message.tokenId);
            }
            break;

          case "token-create":
            if (message.userId !== userId) {
              addTokenFromSync(message.token);
            }
            break;

          case "map-sync":
            if (message.userId !== userId) {
              syncMap(message.data);
            }
            break;

          case "fog-paint":
            if (message.userId !== userId) {
              paintFogCell(message.col, message.row, message.creatorId);
            }
            break;

          case "fog-erase":
            if (message.userId !== userId) {
              // Use the sender's isDM flag to determine erase permissions
              eraseFogCell(message.col, message.row, message.userId, message.isDM);
            }
            break;

          case "fog-paint-range":
            if (message.userId !== userId) {
              paintFogInRange(message.startCol, message.startRow, message.endCol, message.endRow, message.creatorId);
            }
            break;

          case "fog-erase-range":
            if (message.userId !== userId) {
              // Use the sender's isDM flag to determine erase permissions
              eraseFogInRange(message.startCol, message.startRow, message.endCol, message.endRow, message.userId, message.isDM);
            }
            break;

          case "presence":
            setUsers(
              message.users.map((u) => ({
                id: u.id,
                name: u.name,
                image: null,
              }))
            );
            break;

          case "user-leave":
            break;

          case "ping":
            // Add ping to active pings (includes pings from all users, including self for visual feedback)
            setActivePings((prev) => [...prev, message.ping]);
            // Auto-remove ping after 3 seconds
            setTimeout(() => {
              setActivePings((prev) => prev.filter((p) => p.id !== message.ping.id));
            }, 3000);
            break;

          case "drawing-add":
            if (message.userId !== userId) {
              addFreehandPath(message.path);
            }
            break;

          case "drawing-remove":
            if (message.userId !== userId) {
              removeFreehandPath(message.pathId);
            }
            break;

          case "dm-transfer":
            // Reload the page to refresh permissions for all clients
            window.location.reload();
            break;

          case "combat-request":
            // DM receives combat request from player
            setCombatRequest({
              requesterId: message.requesterId,
              requesterName: message.requesterName,
            });
            break;

          case "combat-response":
            // All clients receive combat response
            if (message.accepted && message.initiativeOrder) {
              setInitiativeOrder(message.initiativeOrder);
              setIsInCombat(true);
            }
            setCombatRequest(null);
            break;

          case "combat-end":
            // All clients receive combat end
            setInitiativeOrder(null);
            setIsInCombat(false);
            break;
        }
      } catch (error) {
        console.error("Failed to parse PartyKit message:", error);
      }
    },
  });

  // Reconnect when dependencies change
  useEffect(() => {
    if (enabled && mapId && userId && socket) {
      socket.reconnect();
    }
  }, [enabled, mapId, userId, socket]);

  // Check if socket is ready to send
  const isSocketReady = useCallback(
    (): boolean => !!socket && socket.readyState === WebSocket.OPEN && !!userId,
    [socket, userId]
  );

  // Broadcast token move to other clients
  const broadcastTokenMove = useCallback(
    (tokenId: string, position: GridPosition) => {
      if (!isSocketReady() || !userId) return;
      socket!.send(JSON.stringify({
        type: "token-move",
        tokenId,
        position,
        userId,
        userName: userName || "Anonymous",
      }));
    },
    [isSocketReady, socket, userId, userName]
  );

  // Broadcast token update to other clients
  const broadcastTokenUpdate = useCallback(
    (tokenId: string, updates: Partial<Token>) => {
      if (!isSocketReady() || !userId) return;
      socket!.send(JSON.stringify({
        type: "token-update",
        tokenId,
        updates,
        userId,
      }));
    },
    [isSocketReady, socket, userId]
  );

  // Broadcast token deletion to other clients
  const broadcastTokenDelete = useCallback(
    (tokenId: string) => {
      if (!isSocketReady() || !userId) return;
      socket!.send(JSON.stringify({
        type: "token-delete",
        tokenId,
        userId,
      }));
    },
    [isSocketReady, socket, userId]
  );

  // Broadcast new token creation to other clients
  const broadcastTokenCreate = useCallback(
    (token: Token) => {
      if (!isSocketReady() || !userId) return;
      socket!.send(JSON.stringify({
        type: "token-create",
        token,
        userId,
      }));
    },
    [isSocketReady, socket, userId]
  );

  // Broadcast full map sync (for DM operations like fog, grid, background)
  const broadcastMapSync = useCallback(
    (data: DnDMap) => {
      if (!isSocketReady() || !userId) return;
      socket!.send(JSON.stringify({
        type: "map-sync",
        data,
        userId,
      }));
    },
    [isSocketReady, socket, userId]
  );

  // Broadcast fog paint to other clients
  const broadcastFogPaint = useCallback(
    (col: number, row: number, creatorId: string) => {
      if (!isSocketReady() || !userId) return;
      socket!.send(JSON.stringify({
        type: "fog-paint",
        col,
        row,
        creatorId,
        userId,
      }));
    },
    [isSocketReady, socket, userId]
  );

  // Broadcast fog erase to other clients
  const broadcastFogErase = useCallback(
    (col: number, row: number, isDM: boolean) => {
      if (!isSocketReady() || !userId) return;
      socket!.send(JSON.stringify({
        type: "fog-erase",
        col,
        row,
        userId,
        isDM,
      }));
    },
    [isSocketReady, socket, userId]
  );

  // Broadcast fog paint range to other clients
  const broadcastFogPaintRange = useCallback(
    (startCol: number, startRow: number, endCol: number, endRow: number, creatorId: string) => {
      if (!isSocketReady() || !userId) return;
      socket!.send(JSON.stringify({
        type: "fog-paint-range",
        startCol,
        startRow,
        endCol,
        endRow,
        creatorId,
        userId,
      }));
    },
    [isSocketReady, socket, userId]
  );

  // Broadcast fog erase range to other clients
  const broadcastFogEraseRange = useCallback(
    (startCol: number, startRow: number, endCol: number, endRow: number, isDM: boolean) => {
      if (!isSocketReady() || !userId) return;
      socket!.send(JSON.stringify({
        type: "fog-erase-range",
        startCol,
        startRow,
        endCol,
        endRow,
        userId,
        isDM,
      }));
    },
    [isSocketReady, socket, userId]
  );

  // Broadcast ping to all clients (including self for visual feedback)
  const broadcastPing = useCallback(
    (ping: Ping) => {
      if (!isSocketReady() || !userId) return;
      socket!.send(JSON.stringify({
        type: "ping",
        ping,
        userId,
      }));

      // Add ping locally first for immediate feedback
      setActivePings((prev) => [...prev, ping]);
      // Auto-remove after 3 seconds
      setTimeout(() => {
        setActivePings((prev) => prev.filter((p) => p.id !== ping.id));
      }, 3000);
    },
    [isSocketReady, socket, userId]
  );

  // Broadcast drawing add to other clients
  const broadcastDrawingAdd = useCallback(
    (path: { id: string; points: number[]; color: string; width: number }) => {
      if (!isSocketReady() || !userId) return;
      socket!.send(JSON.stringify({
        type: "drawing-add",
        path,
        userId,
      }));
    },
    [isSocketReady, socket, userId]
  );

  // Broadcast drawing remove to other clients
  const broadcastDrawingRemove = useCallback(
    (pathId: string) => {
      if (!isSocketReady() || !userId) return;
      socket!.send(JSON.stringify({
        type: "drawing-remove",
        pathId,
        userId,
      }));
    },
    [isSocketReady, socket, userId]
  );

  // Broadcast DM transfer to all clients (triggers page reload)
  const broadcastDmTransfer = useCallback(
    (newDmId: string) => {
      if (!isSocketReady() || !userId) return;
      socket!.send(JSON.stringify({
        type: "dm-transfer",
        newDmId,
        userId,
      }));
    },
    [isSocketReady, socket, userId]
  );

  // Broadcast combat request (player -> DM)
  const broadcastCombatRequest = useCallback(
    () => {
      if (!isSocketReady() || !userId) return;
      socket!.send(JSON.stringify({
        type: "combat-request",
        requesterId: userId,
        requesterName: userName || "Unknown",
      }));
    },
    [isSocketReady, socket, userId, userName]
  );

  // Broadcast combat response (DM -> all clients)
  const broadcastCombatResponse = useCallback(
    (accepted: boolean, order: InitiativeEntry[] | null) => {
      if (!isSocketReady() || !userId) return;
      const message = {
        type: "combat-response",
        accepted,
        initiativeOrder: order,
      };
      socket!.send(JSON.stringify(message));
      // Also update local state
      if (accepted && order) {
        setInitiativeOrder(order);
        setIsInCombat(true);
      }
      setCombatRequest(null);
    },
    [isSocketReady, socket, userId]
  );

  // Broadcast combat end (DM -> all clients)
  const broadcastCombatEnd = useCallback(
    () => {
      if (!isSocketReady() || !userId) return;
      socket!.send(JSON.stringify({
        type: "combat-end",
        userId,
      }));
      // Also update local state
      setInitiativeOrder(null);
      setIsInCombat(false);
    },
    [isSocketReady, socket, userId]
  );

  // Clear combat request (for DM to dismiss without responding)
  const clearCombatRequest = useCallback(() => {
    setCombatRequest(null);
  }, []);

  return {
    broadcastTokenMove,
    broadcastTokenUpdate,
    broadcastTokenDelete,
    broadcastTokenCreate,
    broadcastMapSync,
    broadcastFogPaint,
    broadcastFogErase,
    broadcastFogPaintRange,
    broadcastFogEraseRange,
    broadcastPing,
    broadcastDrawingAdd,
    broadcastDrawingRemove,
    broadcastDmTransfer,
    broadcastCombatRequest,
    broadcastCombatResponse,
    broadcastCombatEnd,
    clearCombatRequest,
    activePings,
    combatRequest,
    initiativeOrder,
    isInCombat,
    isConnected: socket?.readyState === WebSocket.OPEN,
  };
}
