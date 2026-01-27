import { eq, and } from "drizzle-orm";
import { db } from "~/.server/db";
import {
  maps,
  mapPermissions,
  type PermissionLevel,
  type PlayerPermissions,
  DEFAULT_PERMISSIONS,
} from "~/.server/db/schema";

export type MapAction = "view" | "edit" | "share" | "delete" | "transfer";

export interface MapAccess {
  mapId: string;
  userId: string;
  permission: PermissionLevel | null;
  customPermissions: PlayerPermissions | null;
  isOwner: boolean;
}

/**
 * Get a user's access level for a specific map
 */
export async function getMapAccess(
  mapId: string,
  userId: string
): Promise<MapAccess> {
  // Check if user is the owner
  const map = await db
    .select({ userId: maps.userId })
    .from(maps)
    .where(eq(maps.id, mapId))
    .limit(1);

  if (map.length === 0) {
    return { mapId, userId, permission: null, customPermissions: null, isOwner: false };
  }

  const isOwner = map[0].userId === userId;

  if (isOwner) {
    return {
      mapId,
      userId,
      permission: "owner",
      customPermissions: DEFAULT_PERMISSIONS.owner,
      isOwner: true,
    };
  }

  // Check for explicit permission
  const permissionData = await db
    .select({
      permission: mapPermissions.permission,
      customPermissions: mapPermissions.customPermissions,
    })
    .from(mapPermissions)
    .where(
      and(eq(mapPermissions.mapId, mapId), eq(mapPermissions.userId, userId))
    )
    .limit(1);

  if (permissionData.length > 0) {
    const { permission, customPermissions } = permissionData[0];
    return {
      mapId,
      userId,
      permission,
      customPermissions: customPermissions || DEFAULT_PERMISSIONS[permission],
      isOwner: false,
    };
  }

  return { mapId, userId, permission: null, customPermissions: null, isOwner: false };
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
    case "share":
    case "delete":
    case "transfer":
      // Only owners can do these - already handled above
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
