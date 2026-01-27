import { eq, and, sql } from "drizzle-orm";
import { db } from "~/.server/db";
import {
  groups,
  groupMembers,
  type GroupRole,
} from "~/.server/db/schema";

export const MAX_GROUPS_PER_USER = 3;

export type GroupAction = "view" | "edit" | "invite" | "manage_members" | "delete";

export interface GroupAccess {
  groupId: string;
  userId: string;
  role: GroupRole | null;
  isMember: boolean;
}

/**
 * Get a user's access level for a specific group
 */
export async function getGroupAccess(
  groupId: string,
  userId: string
): Promise<GroupAccess> {
  const membership = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId))
    )
    .limit(1);

  if (membership.length === 0) {
    return { groupId, userId, role: null, isMember: false };
  }

  return {
    groupId,
    userId,
    role: membership[0].role,
    isMember: true,
  };
}

/**
 * Check if a user is a member of a group
 */
export async function isGroupMember(
  groupId: string,
  userId: string
): Promise<boolean> {
  const access = await getGroupAccess(groupId, userId);
  return access.isMember;
}

/**
 * Check if a role allows a specific action
 */
export function canPerformGroupAction(
  access: GroupAccess,
  action: GroupAction
): boolean {
  const { role, isMember } = access;

  if (!isMember || !role) {
    return false;
  }

  switch (action) {
    case "view":
      return true; // All members can view
    case "edit":
      return ["owner", "admin"].includes(role);
    case "invite":
      return ["owner", "admin"].includes(role);
    case "manage_members":
      return ["owner", "admin"].includes(role);
    case "delete":
      return role === "owner";
    default:
      return false;
  }
}

/**
 * Require a specific permission level, throwing 403 if insufficient
 */
export async function requireGroupPermission(
  groupId: string,
  userId: string,
  action: GroupAction
): Promise<GroupAccess> {
  const access = await getGroupAccess(groupId, userId);

  if (!canPerformGroupAction(access, action)) {
    throw new Response("Forbidden", { status: 403 });
  }

  return access;
}

/**
 * Get the count of groups a user is a member of
 */
export async function getUserGroupCount(userId: string): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(groupMembers)
    .where(eq(groupMembers.userId, userId));

  return result[0]?.count ?? 0;
}

/**
 * Check if a user can join another group (respects 3-group limit)
 */
export async function canJoinGroup(userId: string): Promise<boolean> {
  const count = await getUserGroupCount(userId);
  return count < MAX_GROUPS_PER_USER;
}

/**
 * Get all groups a user is a member of
 */
export async function getUserGroups(userId: string) {
  return db
    .select({
      id: groups.id,
      name: groups.name,
      description: groups.description,
      createdBy: groups.createdBy,
      createdAt: groups.createdAt,
      updatedAt: groups.updatedAt,
      role: groupMembers.role,
      joinedAt: groupMembers.joinedAt,
    })
    .from(groupMembers)
    .innerJoin(groups, eq(groupMembers.groupId, groups.id))
    .where(eq(groupMembers.userId, userId));
}

/**
 * Get group members with user details
 */
export async function getGroupMembers(groupId: string) {
  const { user } = await import("~/.server/db/schema");

  return db
    .select({
      id: groupMembers.id,
      userId: groupMembers.userId,
      role: groupMembers.role,
      joinedAt: groupMembers.joinedAt,
      userName: user.name,
      userEmail: user.email,
      userImage: user.image,
    })
    .from(groupMembers)
    .innerJoin(user, eq(groupMembers.userId, user.id))
    .where(eq(groupMembers.groupId, groupId));
}
