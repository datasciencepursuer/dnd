import type * as Party from "partykit/server";

// Message types from clients
interface TokenMoveMessage {
  type: "token-move";
  tokenId: string;
  position: { col: number; row: number };
  userId: string;
  userName: string;
}

interface TokenUpdateMessage {
  type: "token-update";
  tokenId: string;
  updates: Record<string, unknown>;
  userId: string;
}

interface TokenDeleteMessage {
  type: "token-delete";
  tokenId: string;
  userId: string;
}

interface TokenCreateMessage {
  type: "token-create";
  token: Record<string, unknown>;
  userId: string;
}

interface MapSyncMessage {
  type: "map-sync";
  data: unknown;
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

interface PingMessage {
  type: "ping";
  ping: {
    id: string;
    x: number;
    y: number;
    color: string;
    userId: string;
    timestamp: number;
  };
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

interface CombatResponseMessage {
  type: "combat-response";
  accepted: boolean;
  initiativeOrder: Array<{
    tokenId: string;
    tokenName: string;
    tokenColor: string;
    initiative: number;
  }> | null;
}

interface CombatEndMessage {
  type: "combat-end";
  userId: string;
}

// Server-generated messages
interface PresenceMessage {
  type: "presence";
  users: Array<{ id: string; name: string }>;
}

interface UserLeaveMessage {
  type: "user-leave";
  userId: string;
}

type ClientMessage =
  | TokenMoveMessage
  | TokenUpdateMessage
  | TokenDeleteMessage
  | TokenCreateMessage
  | MapSyncMessage
  | FogPaintMessage
  | FogEraseMessage
  | FogPaintRangeMessage
  | FogEraseRangeMessage
  | PingMessage
  | DrawingAddMessage
  | DrawingRemoveMessage
  | DmTransferMessage
  | CombatRequestMessage
  | CombatResponseMessage
  | CombatEndMessage;

// Track connected users
interface ConnectedUser {
  id: string;
  name: string;
  connectionId: string;
}

export default class MapPartyServer implements Party.Server {
  private users: Map<string, ConnectedUser> = new Map();

  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    // User info passed via query params
    const url = new URL(ctx.request.url);
    const userId = url.searchParams.get("userId");
    const userName = url.searchParams.get("userName") || "Anonymous";

    // Only track users with valid userId (non-empty string)
    if (userId && userId.trim() !== "") {
      this.users.set(conn.id, {
        id: userId,
        name: userName,
        connectionId: conn.id,
      });
    }

    // Broadcast updated presence to all clients
    this.broadcastPresence();
  }

  onClose(conn: Party.Connection) {
    const user = this.users.get(conn.id);
    this.users.delete(conn.id);

    if (user) {
      // Notify others that user left
      const leaveMessage: UserLeaveMessage = {
        type: "user-leave",
        userId: user.id,
      };
      this.room.broadcast(JSON.stringify(leaveMessage), [conn.id]);
    }

    this.broadcastPresence();
  }

  onMessage(message: string, sender: Party.Connection) {
    try {
      const data: ClientMessage = JSON.parse(message);

      // Broadcast to all OTHER clients (sender already has optimistic update)
      this.room.broadcast(message, [sender.id]);
    } catch (error) {
      console.error("Failed to parse message:", error);
    }
  }

  private broadcastPresence() {
    // Deduplicate by userId (user might have multiple tabs)
    const uniqueUsers = new Map<string, { id: string; name: string }>();
    for (const user of this.users.values()) {
      uniqueUsers.set(user.id, { id: user.id, name: user.name });
    }

    const presenceMessage: PresenceMessage = {
      type: "presence",
      users: Array.from(uniqueUsers.values()),
    };

    this.room.broadcast(JSON.stringify(presenceMessage));
  }
}
