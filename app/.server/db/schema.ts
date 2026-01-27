import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  jsonb,
  boolean,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

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

// Maps table for DnD maps
export const maps = pgTable("maps", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Permission level enum
export const permissionLevelEnum = pgEnum("permission_level", [
  "view",
  "edit",
  "owner",
]);

// Custom player permissions stored as JSON
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

// Default permissions for each role
export const DEFAULT_PERMISSIONS: Record<PermissionLevel, PlayerPermissions> = {
  view: {
    canCreateTokens: false,
    canEditOwnTokens: false,
    canEditAllTokens: false,
    canDeleteOwnTokens: false,
    canDeleteAllTokens: false,
    canMoveOwnTokens: false,
    canMoveAllTokens: false,
    canViewMap: true,
    canEditMap: false,
    canManagePlayers: false,
  },
  edit: {
    canCreateTokens: false,
    canEditOwnTokens: true,
    canEditAllTokens: false,
    canDeleteOwnTokens: true,
    canDeleteAllTokens: false,
    canMoveOwnTokens: true,
    canMoveAllTokens: false,
    canViewMap: true,
    canEditMap: false,
    canManagePlayers: false,
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

// Map permissions table - for sharing maps with registered users
export const mapPermissions = pgTable(
  "map_permissions",
  {
    id: text("id").primaryKey(),
    mapId: text("map_id")
      .notNull()
      .references(() => maps.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    permission: permissionLevelEnum("permission").notNull().default("view"),
    customPermissions: jsonb("custom_permissions").$type<PlayerPermissions>(),
    grantedBy: text("granted_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    uniqueUserMap: unique().on(table.mapId, table.userId),
  })
);

// Map invitations table - for inviting users who may not have accounts yet
export const mapInvitations = pgTable(
  "map_invitations",
  {
    id: text("id").primaryKey(),
    mapId: text("map_id")
      .notNull()
      .references(() => maps.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    permission: permissionLevelEnum("permission").notNull().default("view"),
    invitedBy: text("invited_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    uniqueEmailMap: unique().on(table.mapId, table.email),
  })
);

// Drizzle relations for easier querying
export const userRelations = relations(user, ({ many }) => ({
  maps: many(maps),
  mapPermissions: many(mapPermissions),
  sentInvitations: many(mapInvitations),
}));

export const mapsRelations = relations(maps, ({ one, many }) => ({
  owner: one(user, {
    fields: [maps.userId],
    references: [user.id],
  }),
  permissions: many(mapPermissions),
  invitations: many(mapInvitations),
}));

export const mapPermissionsRelations = relations(mapPermissions, ({ one }) => ({
  map: one(maps, {
    fields: [mapPermissions.mapId],
    references: [maps.id],
  }),
  user: one(user, {
    fields: [mapPermissions.userId],
    references: [user.id],
  }),
  grantedByUser: one(user, {
    fields: [mapPermissions.grantedBy],
    references: [user.id],
  }),
}));

export const mapInvitationsRelations = relations(mapInvitations, ({ one }) => ({
  map: one(maps, {
    fields: [mapInvitations.mapId],
    references: [maps.id],
  }),
  invitedByUser: one(user, {
    fields: [mapInvitations.invitedBy],
    references: [user.id],
  }),
}));

// Type exports
export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type Session = typeof session.$inferSelect;
export type Account = typeof account.$inferSelect;
export type Verification = typeof verification.$inferSelect;
export type Map = typeof maps.$inferSelect;
export type NewMap = typeof maps.$inferInsert;
export type MapPermission = typeof mapPermissions.$inferSelect;
export type NewMapPermission = typeof mapPermissions.$inferInsert;
export type MapInvitation = typeof mapInvitations.$inferSelect;
export type NewMapInvitation = typeof mapInvitations.$inferInsert;
export type PermissionLevel = "view" | "edit" | "owner";
