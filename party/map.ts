import type * as Party from "partykit/server";
import { verifyPartyAuthToken } from "../shared/party-auth";

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

interface ChatClearMsg {
  type: "chat-clear";
  userId: string;
}

interface WallAddMessage {
  type: "wall-add";
  wall: Record<string, unknown>;
  userId: string;
}

interface WallRemoveMessage {
  type: "wall-remove";
  wallId: string;
  userId: string;
}

interface AreaAddMessage {
  type: "area-add";
  area: Record<string, unknown>;
  userId: string;
}

interface AreaRemoveMessage {
  type: "area-remove";
  areaId: string;
  userId: string;
}

interface ScheduleAvailabilityMessage {
  type: "availability-update";
  userId: string;
}

interface ScheduleVoteMessage {
  type: "vote-update";
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
  | ChatMessageMsg
  | ChatClearMsg
  | WallAddMessage
  | WallRemoveMessage
  | AreaAddMessage
  | AreaRemoveMessage
  | ScheduleAvailabilityMessage
  | ScheduleVoteMessage;

// Track connected users
interface ConnectedUser {
  id: string;
  name: string;
  connectionId: string;
}

type JsonRecord = Record<string, unknown>;

const MAX_MESSAGE_BYTES = 512 * 1024;
const MAX_STRING_LENGTH = 8_192;
const MAX_ID_LENGTH = 256;
const MAX_NAME_LENGTH = 256;
const MAX_IMAGE_URL_LENGTH = 4_096;
const MAX_COLLECTION_LENGTH = 10_000;
const MAX_NESTING_DEPTH = 12;
const IMAGE_URL_FIELD = /^(?:imageUrl|backgroundUrl|thumbnailUrl|avatarUrl)$/i;
const DISALLOWED_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBoundedString(value: unknown, maxLength = MAX_STRING_LENGTH): value is string {
  return typeof value === "string" && value.length <= maxLength;
}

function isNonEmptyString(value: unknown, maxLength = MAX_STRING_LENGTH): value is string {
  return isBoundedString(value, maxLength) && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isAllowedImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const isUploadThingHost =
      hostname === "utfs.io" || hostname === "ufs.sh" || hostname.endsWith(".ufs.sh");
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      isUploadThingHost &&
      url.pathname.startsWith("/f/")
    );
  } catch {
    return false;
  }
}

function isSafeCoordinate(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && Math.abs(value) <= 1_000_000;
}

function isSafeJsonValue(value: unknown, key = "", depth = 0): boolean {
  if (depth > MAX_NESTING_DEPTH) return false;

  if (value === null || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);

  if (typeof value === "string") {
    if (!isBoundedString(value)) return false;
    if (IMAGE_URL_FIELD.test(key) && value !== "") {
      return value.length <= MAX_IMAGE_URL_LENGTH && isAllowedImageUrl(value);
    }
    return true;
  }

  if (Array.isArray(value)) {
    return value.length <= MAX_COLLECTION_LENGTH && value.every((item) =>
      isSafeJsonValue(item, "", depth + 1)
    );
  }

  if (!isRecord(value)) return false;

  const keys = Object.keys(value);
  if (keys.length > MAX_COLLECTION_LENGTH) return false;

  return keys.every((entryKey) =>
    !DISALLOWED_KEYS.has(entryKey) && isSafeJsonValue(value[entryKey], entryKey, depth + 1)
  );
}

function isSafeRecord(value: unknown): value is JsonRecord {
  return isRecord(value) && isSafeJsonValue(value);
}

function hasUserId(value: JsonRecord, userId: string): boolean {
  return isNonEmptyString(value.userId, MAX_ID_LENGTH) && value.userId === userId;
}

function hasString(value: JsonRecord, key: string, maxLength = MAX_STRING_LENGTH): boolean {
  return isBoundedString(value[key], maxLength);
}

function hasNonEmptyString(value: JsonRecord, key: string, maxLength = MAX_ID_LENGTH): boolean {
  return isNonEmptyString(value[key], maxLength);
}

function isTokenRecord(value: unknown): value is JsonRecord {
  return isSafeRecord(value) && isNonEmptyString(value.id, MAX_ID_LENGTH);
}

function isMapData(value: unknown, roomId: string): boolean {
  if (!isSafeRecord(value) || value.id !== roomId || !Array.isArray(value.tokens)) return false;
  return value.tokens.length <= MAX_COLLECTION_LENGTH && value.tokens.every(isTokenRecord);
}

function isGridPosition(value: unknown): boolean {
  return isRecord(value) && isSafeCoordinate(value.col) && isSafeCoordinate(value.row);
}

function isDrawingPath(value: unknown): boolean {
  if (!isRecord(value) || !isSafeJsonValue(value)) return false;
  return (
    isNonEmptyString(value.id, MAX_ID_LENGTH) &&
    Array.isArray(value.points) &&
    value.points.length <= MAX_COLLECTION_LENGTH &&
    value.points.every(isFiniteNumber) &&
    isBoundedString(value.color, MAX_STRING_LENGTH) &&
    isFiniteNumber(value.width)
  );
}

function isPing(value: unknown, userId: string): boolean {
  if (!isRecord(value) || !isSafeJsonValue(value)) return false;
  return (
    isNonEmptyString(value.id, MAX_ID_LENGTH) &&
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.y) &&
    isBoundedString(value.color, MAX_STRING_LENGTH) &&
    value.userId === userId &&
    isFiniteNumber(value.timestamp)
  );
}

function isInitiativeOrder(value: unknown): boolean {
  if (value === null) return true;
  if (!Array.isArray(value) || value.length > MAX_COLLECTION_LENGTH) return false;

  return value.every((entry) => {
    if (!isRecord(entry)) return false;
    return (
      isNonEmptyString(entry.tokenId, MAX_ID_LENGTH) &&
      isBoundedString(entry.tokenName, MAX_NAME_LENGTH) &&
      isBoundedString(entry.tokenColor, MAX_STRING_LENGTH) &&
      isFiniteNumber(entry.initiative)
    );
  });
}

function isChatMessage(value: unknown, userId: string, roomId: string): boolean {
  if (!isRecord(value) || !isSafeJsonValue(value)) return false;

  return (
    value.mapId === roomId &&
    isNonEmptyString(value.id, MAX_ID_LENGTH) &&
    value.userId === userId &&
    isNonEmptyString(value.userName, MAX_NAME_LENGTH) &&
    isNonEmptyString(value.message, 500) &&
    isNonEmptyString(value.role, MAX_NAME_LENGTH) &&
    isNonEmptyString(value.createdAt, MAX_NAME_LENGTH) &&
    (value.recipientId === undefined || value.recipientId === null || isNonEmptyString(value.recipientId, MAX_ID_LENGTH)) &&
    (value.recipientName === undefined || value.recipientName === null || isBoundedString(value.recipientName, MAX_NAME_LENGTH))
  );
}

function normalizeQueryValue(value: string | null, maxLength: number): string | null {
  if (value === null) return null;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= maxLength ? normalized : null;
}

function asClientMessage(value: JsonRecord): ClientMessage {
  // The runtime checks above establish the discriminated union after JSON parsing.
  return value as unknown as ClientMessage;
}

async function getConnectionIdentity(
  room: Party.Room,
  ctx: Party.ConnectionContext
): Promise<{ id: string; name: string } | null> {
  const url = new URL(ctx.request.url);
  const token = url.searchParams.get("auth");
  const secret = room.env.PARTYKIT_AUTH_SECRET || room.env.BETTER_AUTH_SECRET;
  if (!token || typeof secret !== "string" || secret.length === 0) return null;

  try {
    const payload = await verifyPartyAuthToken(token, secret, room.id);
    if (!payload) return null;

    const userId = normalizeQueryValue(payload.userId, MAX_ID_LENGTH);
    if (!userId) return null;

    return {
      id: userId,
      name: normalizeQueryValue(payload.userName, MAX_NAME_LENGTH) || "Anonymous",
    };
  } catch {
    return null;
  }
}

function parseClientMessage(message: string, userId: string, roomId: string): ClientMessage | null {
  if (message.length > MAX_MESSAGE_BYTES) return null;

  let value: unknown;
  try {
    value = JSON.parse(message);
  } catch {
    return null;
  }

  if (!isRecord(value) || !isNonEmptyString(value.type, MAX_ID_LENGTH) || !isSafeJsonValue(value)) {
    return null;
  }

  switch (value.type) {
    case "token-move":
      return hasUserId(value, userId) &&
        hasNonEmptyString(value, "tokenId") &&
        isGridPosition(value.position) &&
        hasString(value, "userName", MAX_NAME_LENGTH)
        ? asClientMessage(value)
        : null;
    case "token-update":
      return hasUserId(value, userId) && hasNonEmptyString(value, "tokenId") && isSafeRecord(value.updates)
        ? asClientMessage(value)
        : null;
    case "token-delete":
      return hasUserId(value, userId) && hasNonEmptyString(value, "tokenId")
        ? asClientMessage(value)
        : null;
    case "token-create":
      return hasUserId(value, userId) && isTokenRecord(value.token)
        ? asClientMessage(value)
        : null;
    case "map-sync":
      return hasUserId(value, userId) && isMapData(value.data, roomId)
        ? asClientMessage(value)
        : null;
    case "fog-paint":
      return hasUserId(value, userId) &&
        isSafeCoordinate(value.col) &&
        isSafeCoordinate(value.row) &&
        hasNonEmptyString(value, "creatorId")
        ? asClientMessage(value)
        : null;
    case "fog-erase":
      return hasUserId(value, userId) &&
        isSafeCoordinate(value.col) &&
        isSafeCoordinate(value.row) &&
        typeof value.isDM === "boolean"
        ? asClientMessage(value)
        : null;
    case "fog-paint-range":
      return hasUserId(value, userId) &&
        isSafeCoordinate(value.startCol) &&
        isSafeCoordinate(value.startRow) &&
        isSafeCoordinate(value.endCol) &&
        isSafeCoordinate(value.endRow) &&
        hasNonEmptyString(value, "creatorId")
        ? asClientMessage(value)
        : null;
    case "fog-erase-range":
      return hasUserId(value, userId) &&
        isSafeCoordinate(value.startCol) &&
        isSafeCoordinate(value.startRow) &&
        isSafeCoordinate(value.endCol) &&
        isSafeCoordinate(value.endRow) &&
        typeof value.isDM === "boolean"
        ? asClientMessage(value)
        : null;
    case "ping":
      return hasUserId(value, userId) && isPing(value.ping, userId)
        ? asClientMessage(value)
        : null;
    case "drawing-add":
      return hasUserId(value, userId) && isDrawingPath(value.path)
        ? asClientMessage(value)
        : null;
    case "drawing-remove":
      return hasUserId(value, userId) && hasNonEmptyString(value, "pathId")
        ? asClientMessage(value)
        : null;
    case "dm-transfer":
      return hasUserId(value, userId) && hasNonEmptyString(value, "newDmId")
        ? asClientMessage(value)
        : null;
    case "combat-request":
      return value.requesterId === userId && hasString(value, "requesterName", MAX_NAME_LENGTH)
        ? asClientMessage(value)
        : null;
    case "combat-response":
      return typeof value.accepted === "boolean" && isInitiativeOrder(value.initiativeOrder)
        ? asClientMessage(value)
        : null;
    case "combat-end":
      return hasUserId(value, userId) ? asClientMessage(value) : null;
    case "dice-roll":
      return hasUserId(value, userId) && isSafeRecord(value.roll)
        ? asClientMessage(value)
        : null;
    case "token-stats":
      return hasUserId(value, userId) && hasNonEmptyString(value, "tokenId") && isSafeRecord(value.stats)
        ? asClientMessage(value)
        : null;
    case "chat-message":
      return hasUserId(value, userId) && isChatMessage(value.chatMessage, userId, roomId)
        ? asClientMessage(value)
        : null;
    case "chat-clear":
      return hasUserId(value, userId) ? asClientMessage(value) : null;
    case "wall-add":
      return hasUserId(value, userId) && isTokenRecord(value.wall)
        ? asClientMessage(value)
        : null;
    case "wall-remove":
      return hasUserId(value, userId) && hasNonEmptyString(value, "wallId")
        ? asClientMessage(value)
        : null;
    case "area-add":
      return hasUserId(value, userId) && isTokenRecord(value.area)
        ? asClientMessage(value)
        : null;
    case "area-remove":
      return hasUserId(value, userId) && hasNonEmptyString(value, "areaId")
        ? asClientMessage(value)
        : null;
    case "availability-update":
    case "vote-update":
      return hasUserId(value, userId) ? asClientMessage(value) : null;
    default:
      return null;
  }
}

function bindClientIdentity(message: ClientMessage, user: ConnectedUser): void {
  const value = message as unknown as JsonRecord;
  if (typeof value.userId === "string") value.userId = user.id;

  switch (message.type) {
    case "token-move":
      message.userName = user.name;
      break;
    case "combat-request":
      message.requesterId = user.id;
      message.requesterName = user.name;
      break;
    case "ping":
      message.ping.userId = user.id;
      break;
    case "fog-paint":
    case "fog-paint-range":
      message.creatorId = user.id;
      break;
    case "chat-message":
      message.chatMessage.userId = user.id;
      message.chatMessage.userName = user.name;
      break;
    default:
      break;
  }
}

export default class MapPartyServer implements Party.Server {
  private users: Map<string, ConnectedUser> = new Map();
  private chatMessages: ChatMessageData[] = [];
  private readonly MAX_CHAT_BUFFER = 100;

  constructor(readonly room: Party.Room) {}

  async onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    const identity = await getConnectionIdentity(this.room, ctx);
    if (!identity) {
      conn.close(1008, "invalid PartyKit authorization");
      return;
    }

    this.users.set(conn.id, {
      id: identity.id,
      name: identity.name,
      connectionId: conn.id,
    });

    // Broadcast updated presence to all clients
    this.broadcastPresence();

    // Send chat history buffer to the new connection (filter whispers)
    if (this.chatMessages.length > 0) {
      const userChatHistory = this.chatMessages.filter((msg) =>
        !msg.recipientId ||
        msg.userId === identity.id ||
        msg.recipientId === identity.id
      );
      if (userChatHistory.length > 0) {
        conn.send(JSON.stringify({
          type: "chat-history",
          messages: userChatHistory,
        }));
      }
    }
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
      const senderUser = this.users.get(sender.id);
      if (!senderUser) {
        sender.close(1008, "connection is not admitted");
        return;
      }

      const data = parseClientMessage(message, senderUser.id, this.room.id);
      if (!data) {
        console.warn("Rejected invalid PartyKit message", { connectionId: sender.id });
        return;
      }
      bindClientIdentity(data, senderUser);
      const serializedMessage = JSON.stringify(data);

      // Clear chat: wipe server buffer and broadcast to all clients
      if (data.type === "chat-clear") {
        this.chatMessages = [];
        this.room.broadcast(serializedMessage, [sender.id]);
        return;
      }

      // Buffer chat messages for history on reconnect
      if (data.type === "chat-message") {
        this.chatMessages.push(data.chatMessage);
        if (this.chatMessages.length > this.MAX_CHAT_BUFFER) {
          this.chatMessages.shift();
        }

        // Whisper: send only to recipient's connections (sender has optimistic update)
        if (data.chatMessage.recipientId) {
          const recipientId = data.chatMessage.recipientId;
          for (const conn of this.room.getConnections()) {
            const connUser = this.users.get(conn.id);
            if (connUser && connUser.id === recipientId) {
              conn.send(serializedMessage);
            }
          }
          return;
        }
      }

      // Broadcast to all OTHER clients (sender already has optimistic update)
      this.room.broadcast(serializedMessage, [sender.id]);
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
