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

interface DiceRollMessage {
  type: "dice-roll";
  roll: Record<string, unknown>;
  userId: string;
}

interface TokenStatsMessage {
  type: "token-stats";
  tokenId: string;
  stats: {
    ac?: number;
    hpCurrent?: number;
    hpMax?: number;
    condition?: string;
    auraCircleEnabled?: boolean;
    auraCircleRange?: number;
    auraSquareEnabled?: boolean;
    auraSquareRange?: number;
  };
  userId: string;
}

interface ChatMessageData {
  id: string;
  mapId: string;
  userId: string;
  userName: string;
  message: string;
  role: string;
  createdAt: string;
  recipientId?: string | null;
  recipientName?: string | null;
}

interface ChatMessageMsg {
  type: "chat-message";
  chatMessage: ChatMessageData;
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
  | CombatEndMessage
  | DiceRollMessage
  | TokenStatsMessage
  | ChatMessageMsg;

// Track connected users
interface ConnectedUser {
  id: string;
  name: string;
  connectionId: string;
}

export default class MapPartyServer implements Party.Server {
  private users: Map<string, ConnectedUser> = new Map();
  private chatMessages: ChatMessageData[] = [];
  private unpersistedChatMessages: ChatMessageData[] = [];
  private readonly MAX_CHAT_BUFFER = 100;
  private readonly FLUSH_INTERVAL_MS = 30_000; // 30 seconds
  private isFlushing = false;

  constructor(readonly room: Party.Room) {}

  async onStart() {
    // Schedule the first periodic flush alarm
    const existing = await this.room.storage.getAlarm();
    if (!existing) {
      await this.room.storage.setAlarm(Date.now() + this.FLUSH_INTERVAL_MS);
    }
  }

  async onAlarm() {
    // Periodic flush of unpersisted chat messages to DB
    await this.flushChatToDb();

    // Reschedule if there are still connections (room is active)
    const connections = [...this.room.getConnections()];
    if (connections.length > 0) {
      await this.room.storage.setAlarm(Date.now() + this.FLUSH_INTERVAL_MS);
    }
  }

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

    // Ensure flush alarm is running while room has connections
    this.ensureAlarm();

    // Send chat history buffer to the new connection (filter whispers)
    if (this.chatMessages.length > 0) {
      const userChatHistory = userId
        ? this.chatMessages.filter((msg) =>
            !msg.recipientId ||
            msg.userId === userId ||
            msg.recipientId === userId
          )
        : this.chatMessages.filter((msg) => !msg.recipientId);
      if (userChatHistory.length > 0) {
        conn.send(JSON.stringify({
          type: "chat-history",
          messages: userChatHistory,
        }));
      }
    }
  }

  async onClose(conn: Party.Connection) {
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

    // Flush on last disconnect so no messages are lost
    const connections = [...this.room.getConnections()];
    if (connections.length === 0 && this.unpersistedChatMessages.length > 0) {
      await this.flushChatToDb();
    }
  }

  onMessage(message: string, sender: Party.Connection) {
    try {
      const data: ClientMessage = JSON.parse(message);

      // Buffer chat messages for history on reconnect
      if (data.type === "chat-message") {
        this.chatMessages.push(data.chatMessage);
        if (this.chatMessages.length > this.MAX_CHAT_BUFFER) {
          this.chatMessages.shift();
        }

        // Track for batch DB persistence
        this.unpersistedChatMessages.push(data.chatMessage);

        // Whisper: send only to recipient's connections (sender has optimistic update)
        if (data.chatMessage.recipientId) {
          const recipientId = data.chatMessage.recipientId;
          for (const conn of this.room.getConnections()) {
            const connUser = this.users.get(conn.id);
            if (connUser && connUser.id === recipientId) {
              conn.send(message);
            }
          }
          return;
        }
      }

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

  private async ensureAlarm() {
    const existing = await this.room.storage.getAlarm();
    if (!existing) {
      await this.room.storage.setAlarm(Date.now() + this.FLUSH_INTERVAL_MS);
    }
  }

  private async flushChatToDb() {
    if (this.isFlushing || this.unpersistedChatMessages.length === 0) return;
    this.isFlushing = true;

    // Grab the current batch and clear the queue
    const batch = this.unpersistedChatMessages.splice(0);
    const mapId = this.room.id;

    // Resolve the app host for the API call
    const appHost = (this.room.env.BETTER_AUTH_URL as string) || "http://localhost:5173";
    const secret = this.room.env.BETTER_AUTH_SECRET as string;

    if (!secret) {
      console.error("BETTER_AUTH_SECRET not configured — chat messages will not be persisted");
      // Put messages back so they can be retried
      this.unpersistedChatMessages.unshift(...batch);
      this.isFlushing = false;
      return;
    }

    try {
      const response = await fetch(`${appHost}/api/maps/${mapId}/chat/batch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-party-secret": secret,
        },
        body: JSON.stringify({ messages: batch }),
      });

      if (!response.ok) {
        console.error(`Chat flush failed (${response.status}): ${await response.text()}`);
        // Put messages back for retry on next flush
        this.unpersistedChatMessages.unshift(...batch);
      }
    } catch (error) {
      console.error("Chat flush network error:", error);
      // Put messages back for retry on next flush
      this.unpersistedChatMessages.unshift(...batch);
    } finally {
      this.isFlushing = false;
    }
  }
}
