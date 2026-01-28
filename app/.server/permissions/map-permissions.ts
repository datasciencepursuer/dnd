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
  permission: PermissionLevel | null;
  customPermissions: PlayerPermissions | null;
  isOwner: boolean;
  isGroupMember: boolean;
}

/**
 * Get a user's access level for a specific map
 */
export async function getMapAccess(
  mapId: string,
  userId: string
): Promise<MapAccess> {
  // Check if user is the owner and get groupId
  const map = await db
    .select({ userId: maps.userId, groupId: maps.groupId })
    .from(maps)
    .where(eq(maps.id, mapId))
    .limit(1);

  if (map.length === 0) {
    return { mapId, userId, permission: null, customPermissions: null, isOwner: false, isGroupMember: false };
  }

  const isOwner = map[0].userId === userId;

  if (isOwner) {
    return {
      mapId,
      userId,
      permission: "owner",
      customPermissions: DEFAULT_PERMISSIONS.owner,
      isOwner: true,
      isGroupMember: false,
    };
  }

  // Check if user is a member of the map's group
  if (map[0].groupId) {
    const groupMembership = await db
      .select({ role: groupMembers.role })
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, map[0].groupId),
          eq(groupMembers.userId, userId)
        )
      )
      .limit(1);

    if (groupMembership.length > 0) {
      const role = groupMembership[0].role;

      // Group owners and admins get edit permission
      if (role === "owner" || role === "admin") {
        return {
          mapId,
          userId,
          permission: "edit",
          customPermissions: DEFAULT_PERMISSIONS.edit,
          isOwner: false,
          isGroupMember: true,
        };
      }

      // Regular members get view permission
      return {
        mapId,
        userId,
        permission: "view",
        customPermissions: DEFAULT_PERMISSIONS.view,
        isOwner: false,
        isGroupMember: true,
      };
    }
  }

  return { mapId, userId, permission: null, customPermissions: null, isOwner: false, isGroupMember: false };
}

/**
 * Check if a permission level allows a specific action
 */
export function canPerformAction(
  access: MapAccess,
  action: MapAction
): boolean {
  const { permission, isOwner } = access;

  // No permission means no access
  if (!permission) {
    return false;
  }

  // Owners can do everything
  if (isOwner || permission === "owner") {
    return true;
  }

  switch (action) {
    case "view":
      return ["view", "edit"].includes(permission);
    case "edit":
      return permission === "edit";
    case "delete":
      // Only owners can delete - already handled above
      return false;
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
  action: MapAction
): Promise<MapAccess> {
  const access = await getMapAccess(mapId, userId);

  if (!canPerformAction(access, action)) {
    throw new Response("Forbidden", { status: 403 });
  }

  return access;
}

/**
 * Get the effective permission level for display purposes
 */
export function getEffectivePermission(access: MapAccess): PermissionLevel | null {
  if (access.isOwner) {
    return "owner";
  }
  return access.permission;
}

/**
 * Get effective permissions (custom or default based on role)
 */
export function getEffectivePermissions(access: MapAccess): PlayerPermissions {
  if (access.isOwner) {
    return DEFAULT_PERMISSIONS.owner;
  }
  if (access.customPermissions) {
    return access.customPermissions;
  }
  if (access.permission) {
    return DEFAULT_PERMISSIONS[access.permission];
  }
  return DEFAULT_PERMISSIONS.view;
}
