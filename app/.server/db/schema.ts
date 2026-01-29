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

// D&D role enum - simplified for tabletop gaming
export const dndRoleEnum = pgEnum("dnd_role", ["dm", "player", "observer"]);

// D&D permissions - optimized for 7 players + 1 DM use case
export interface PlayerPermissions {
  canCreateTokens: boolean;
  canEditOwnTokens: boolean;
  canEditAllTokens: boolean;
  canDeleteOwnTokens: boolean;
  canDeleteAllTokens: boolean;
  canMoveOwnTokens: boolean;
  canMoveAllTokens: boolean;
  canViewMap: boolean;
  canEditMap: boolean;
  canManagePlayers: boolean;
}

// Default permissions for each role (matches frontend types.ts exactly)
export const DEFAULT_PERMISSIONS: Record<"view" | "edit" | "owner", PlayerPermissions> = {
  view: {
    canCreateTokens: false,
    canEditOwnTokens: false,
    canEditAllTokens: false,
    canDeleteOwnTokens: false,
    canDeleteAllTokens: false,
    canMoveOwnTokens: true, // View users can move their own tokens
    canMoveAllTokens: false,
    canViewMap: true,
    canEditMap: false,
    canManagePlayers: false,
  },
  edit: {
    canCreateTokens: true, // Admins can create tokens
    canEditOwnTokens: true,
    canEditAllTokens: true, // Admins can edit all tokens
    canDeleteOwnTokens: true,
    canDeleteAllTokens: true, // Admins can delete all tokens
    canMoveOwnTokens: true,
    canMoveAllTokens: true, // Admins can move all tokens
    canViewMap: true,
    canEditMap: true, // Admins can edit map
    canManagePlayers: false, // Only owners can manage players
  },
  owner: {
    canCreateTokens: true,
    canEditOwnTokens: true,
    canEditAllTokens: true,
    canDeleteOwnTokens: true,
    canDeleteAllTokens: true,
    canMoveOwnTokens: true,
    canMoveAllTokens: true,
    canViewMap: true,
    canEditMap: true,
    canManagePlayers: true,
  },
};

// Map presence table - optimized for D&D sessions (one record per user per map)
export const mapPresence = pgTable(
  "map_presence",
  {
    id: text("id").primaryKey(),
    mapId: text("map_id")
      .notNull()
      .references(() => maps.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    lastSeen: timestamp("last_seen").notNull().defaultNow(),
    connectionId: text("connection_id").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    unique().on(table.mapId, table.userId), // One presence record per user per map
    index("map_presence_map_id_idx").on(table.mapId),
    index("map_presence_user_id_idx").on(table.userId),
  ]
);

// Drizzle relations for easier querying
export const userRelations = relations(user, ({ many }) => ({
  maps: many(maps),
  mapPresence: many(mapPresence),
  groupMemberships: many(groupMembers),
  createdGroups: many(groups),
  sentGroupInvitations: many(groupInvitations),
}));

export const groupsRelations = relations(groups, ({ one, many }) => ({
  creator: one(user, {
    fields: [groups.createdBy],
    references: [user.id],
  }),
  members: many(groupMembers),
  invitations: many(groupInvitations),
  maps: many(maps),
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

export const mapsRelations = relations(maps, ({ one, many }) => ({
  owner: one(user, {
    fields: [maps.userId],
    references: [user.id],
  }),
  group: one(groups, {
    fields: [maps.groupId],
    references: [groups.id],
  }),
  presence: many(mapPresence),
}));

export const mapPresenceRelations = relations(mapPresence, ({ one }) => ({
  map: one(maps, {
    fields: [mapPresence.mapId],
    references: [maps.id],
  }),
  user: one(user, {
    fields: [mapPresence.userId],
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
export type MapPresence = typeof mapPresence.$inferSelect;
export type NewMapPresence = typeof mapPresence.$inferInsert;
export type PermissionLevel = "view" | "edit" | "owner";
