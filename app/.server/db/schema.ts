import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  jsonb,
  boolean,
  unique,
  index,
  integer,
  bigint,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// Group role enum
export const groupRoleEnum = pgEnum("group_role", ["owner", "admin", "member"]);

// Upload type enum
export const uploadTypeEnum = pgEnum("upload_type", ["token", "map"]);

// better-auth user table
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// better-auth session table
export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

// better-auth account table (for OAuth providers)
export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// better-auth verification table (for email verification, password reset, etc.)
export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// better-auth rate limiting table
export const rateLimit = pgTable("rateLimit", {
  id: text("id").primaryKey(),
  key: text("key").notNull(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
  expiresAt: timestamp("expires_at").notNull().default(sql`now() + interval '12 hours'`),
});

// Groups table
export const groups = pgTable("groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Group members table
export const groupMembers = pgTable(
  "group_members",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: groupRoleEnum("role").notNull().default("member"),
    joinedAt: timestamp("joined_at").notNull().defaultNow(),
  },
  (table) => ({
    uniqueUserGroup: unique().on(table.groupId, table.userId),
  })
);

// Group invitations table
export const groupInvitations = pgTable(
  "group_invitations",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    invitedBy: text("invited_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    uniqueEmailGroup: unique().on(table.groupId, table.email),
  })
);

// Maps table for DnD maps
export const maps = pgTable("maps", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  groupId: text("group_id").references(() => groups.id, { onDelete: "cascade" }),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Map role enum - dm (dungeon master) or player
export type MapRole = "dm" | "player";

// Simplified permissions for map roles
export interface PlayerPermissions {
  canCreateTokens: boolean;      // All roles can create tokens
  canEditOwnTokens: boolean;     // Players can only edit their own tokens
  canEditAllTokens: boolean;     // Only DM can edit any token
  canDeleteOwnTokens: boolean;   // All roles can delete tokens they own
  canDeleteAllTokens: boolean;   // Only DM can delete any token
  canMoveOwnTokens: boolean;     // Players can only move their own tokens
  canMoveAllTokens: boolean;     // Only DM can move any token
  canEditMap: boolean;           // Only DM can edit map settings
  canChangeTokenOwner: boolean;  // Only DM can reassign token ownership
}

// Default permissions for each role (matches frontend types.ts exactly)
export const DEFAULT_PERMISSIONS: Record<MapRole, PlayerPermissions> = {
  player: {
    canCreateTokens: true,       // Players can create tokens (auto-owned)
    canEditOwnTokens: true,      // Players can edit their own tokens
    canEditAllTokens: false,     // Players cannot edit others' tokens
    canDeleteOwnTokens: true,    // Players can delete their own tokens
    canDeleteAllTokens: false,   // Players cannot delete others' tokens
    canMoveOwnTokens: true,      // Players can move their own tokens
    canMoveAllTokens: false,     // Players cannot move others' tokens
    canEditMap: false,           // Players cannot edit map settings
    canChangeTokenOwner: false,  // Players cannot reassign ownership
  },
  dm: {
    canCreateTokens: true,       // DM can create tokens
    canEditOwnTokens: true,      // DM can edit own tokens
    canEditAllTokens: true,      // DM can edit any token
    canDeleteOwnTokens: true,    // DM can delete own tokens
    canDeleteAllTokens: true,    // DM can delete any token
    canMoveOwnTokens: true,      // DM can move own tokens
    canMoveAllTokens: true,      // DM can move any token
    canEditMap: true,            // DM can edit map settings
    canChangeTokenOwner: true,   // DM can reassign token ownership
  },
};

// Drizzle relations for easier querying
export const userRelations = relations(user, ({ many }) => ({
  maps: many(maps),
  groupMemberships: many(groupMembers),
  createdGroups: many(groups),
  sentGroupInvitations: many(groupInvitations),
  uploads: many(uploads),
  characters: many(characters),
}));

export const groupsRelations = relations(groups, ({ one, many }) => ({
  creator: one(user, {
    fields: [groups.createdBy],
    references: [user.id],
  }),
  members: many(groupMembers),
  invitations: many(groupInvitations),
  maps: many(maps),
  characters: many(characters),
}));

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group: one(groups, {
    fields: [groupMembers.groupId],
    references: [groups.id],
  }),
  user: one(user, {
    fields: [groupMembers.userId],
    references: [user.id],
  }),
}));

export const groupInvitationsRelations = relations(groupInvitations, ({ one }) => ({
  group: one(groups, {
    fields: [groupInvitations.groupId],
    references: [groups.id],
  }),
  invitedByUser: one(user, {
    fields: [groupInvitations.invitedBy],
    references: [user.id],
  }),
}));

export const mapsRelations = relations(maps, ({ one }) => ({
  owner: one(user, {
    fields: [maps.userId],
    references: [user.id],
  }),
  group: one(groups, {
    fields: [maps.groupId],
    references: [groups.id],
  }),
}));

// Token layer enum for characters table
export const tokenLayerEnum = pgEnum("token_layer", ["character", "monster", "object"]);

// Characters table - shared character library
export const characters = pgTable(
  "characters",
  {
    id: text("id").primaryKey(),
    // Owner of this character
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // If set, character is shared with this group. If null, it's personal.
    groupId: text("group_id").references(() => groups.id, { onDelete: "cascade" }),
    // Token display properties
    name: text("name").notNull(),
    imageUrl: text("image_url"),
    color: text("color").notNull().default("#ef4444"),
    size: integer("size").notNull().default(1),
    layer: tokenLayerEnum("layer").notNull().default("character"),
    // Character sheet data (JSON)
    characterSheet: jsonb("character_sheet"),
    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("characters_user_id_idx").on(table.userId),
    index("characters_group_id_idx").on(table.groupId),
  ]
);

export const charactersRelations = relations(characters, ({ one }) => ({
  owner: one(user, {
    fields: [characters.userId],
    references: [user.id],
  }),
  group: one(groups, {
    fields: [characters.groupId],
    references: [groups.id],
  }),
}));

// Uploads table for user image library
export const uploads = pgTable(
  "uploads",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    type: uploadTypeEnum("type").notNull(),
    fileName: text("file_name").notNull(),
    fileSize: integer("file_size").notNull(),
    mimeType: text("mime_type").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("uploads_user_id_idx").on(table.userId),
    index("uploads_type_idx").on(table.type),
  ]
);

export const uploadsRelations = relations(uploads, ({ one }) => ({
  user: one(user, {
    fields: [uploads.userId],
    references: [user.id],
  }),
}));

// Type exports
export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type Session = typeof session.$inferSelect;
export type Account = typeof account.$inferSelect;
export type Verification = typeof verification.$inferSelect;
export type Group = typeof groups.$inferSelect;
export type NewGroup = typeof groups.$inferInsert;
export type GroupMember = typeof groupMembers.$inferSelect;
export type NewGroupMember = typeof groupMembers.$inferInsert;
export type GroupInvitation = typeof groupInvitations.$inferSelect;
export type NewGroupInvitation = typeof groupInvitations.$inferInsert;
export type { GroupRole } from "~/types/group";
export type Map = typeof maps.$inferSelect;
export type NewMap = typeof maps.$inferInsert;
export type PermissionLevel = "dm" | "player";
export type Upload = typeof uploads.$inferSelect;
export type NewUpload = typeof uploads.$inferInsert;
export type UploadType = "token" | "map";
export type Character = typeof characters.$inferSelect;
export type NewCharacter = typeof characters.$inferInsert;
