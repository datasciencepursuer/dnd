import { eq, and } from "drizzle-orm";
import { db } from "~/.server/db";
import {
  maps,
  groupMembers,
  type PermissionLevel,
  type PlayerPermissions,
  DEFAULT_PERMISSIONS,
} from "~/.server/db/schema";

export type MapAction = "view" | "edit" | "delete";

export interface MapAccess {
  mapId: string;
  userId: string;
  permission: PermissionLevel | null;  // "dm" or "player"
  customPermissions: PlayerPermissions | null;
  isDungeonMaster: boolean;
  isGroupMember: boolean;
  mapData?: typeof maps.$inferSelect;
}

export interface GetMapAccessOptions {
  includeData?: boolean;
}

/**
 * Get a user's access level for a specific map
 * Map creator = Dungeon Master (DM)
 * All other group members = Player
 */
export async function getMapAccess(
  mapId: string,
  userId: string,
  options?: GetMapAccessOptions
): Promise<MapAccess> {
  // Check if user is the owner and get groupId
  // When includeData is true, select all columns to avoid a second query
  const map = options?.includeData
    ? await db.select().from(maps).where(eq(maps.id, mapId)).limit(1)
    : await db.select({ userId: maps.userId, groupId: maps.groupId }).from(maps).where(eq(maps.id, mapId)).limit(1);

  if (map.length === 0) {
    return { mapId, userId, permission: null, customPermissions: null, isDungeonMaster: false, isGroupMember: false };
  }

  const mapRow = map[0];
  const isDungeonMaster = mapRow.userId === userId;
  const fullMapData = options?.includeData ? (mapRow as typeof maps.$inferSelect) : undefined;

  // Map owner is automatically the Dungeon Master
  if (isDungeonMaster) {
    return {
      mapId,
      userId,
      permission: "dm",
      customPermissions: DEFAULT_PERMISSIONS.dm,
      isDungeonMaster: true,
      isGroupMember: true,
      mapData: fullMapData,
    };
  }

  // Check if user is a member of the map's group
  if (mapRow.groupId) {
    const groupMembership = await db
      .select({ role: groupMembers.role })
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, mapRow.groupId),
          eq(groupMembers.userId, userId)
        )
      )
      .limit(1);

    if (groupMembership.length > 0) {
      // All group members (owner, admin, member) are Players on maps they didn't create
      // Group role only matters for managing group members, not map permissions
      return {
        mapId,
        userId,
        permission: "player",
        customPermissions: DEFAULT_PERMISSIONS.player,
        isDungeonMaster: false,
        isGroupMember: true,
        mapData: fullMapData,
      };
    }
  }

  return { mapId, userId, permission: null, customPermissions: null, isDungeonMaster: false, isGroupMember: false };
}

/**
 * Check if a permission level allows a specific action
 */
export function canPerformAction(
  access: MapAccess,
  action: MapAction
): boolean {
  const { permission, isDungeonMaster } = access;

  // No permission means no access
  if (!permission) {
    return false;
  }

  switch (action) {
    case "view":
      // Both DM and Player can view
      return true;
    case "edit":
      // Only DM can edit map settings
      return isDungeonMaster;
    case "delete":
      // Only DM can delete the map
      return isDungeonMaster;
    default:
      return false;
  }
}

/**
 * Require a specific permission level, throwing 403 if insufficient
 */
export async function requireMapPermission(
  mapId: string,
  userId: string,
  action: MapAction,
  options?: GetMapAccessOptions
): Promise<MapAccess> {
  const access = await getMapAccess(mapId, userId, options);

  if (!canPerformAction(access, action)) {
    throw new Response("Forbidden", { status: 403 });
  }

  return access;
}

/**
 * Get the effective permission level for display purposes
 */
export function getEffectivePermission(access: MapAccess): PermissionLevel | null {
  return access.permission;
}

/**
 * Get effective permissions (custom or default based on role)
 */
export function getEffectivePermissions(access: MapAccess): PlayerPermissions {
  if (access.isDungeonMaster) {
    return DEFAULT_PERMISSIONS.dm;
  }
  if (access.customPermissions) {
    return access.customPermissions;
  }
  if (access.permission) {
    return DEFAULT_PERMISSIONS[access.permission];
  }
  return DEFAULT_PERMISSIONS.player;
}
