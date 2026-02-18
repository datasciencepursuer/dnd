export type AccountTier = "free" | "adventurer" | "dungeon_master" | "admin";

export interface TierLimits {
  maxMaps: number;
  maxScenesPerMap: number;
  maxGroups: number;
  maxMapUploads: number;
  maxTokenUploads: number;
  combatSystem: boolean;
  realtimeSync: boolean;
  chatWhispers: boolean;
  monsterCompendium: boolean;
  characterLibrary: boolean;
  wallsAndTerrain: boolean;
  aiDmAssistant: boolean;
  groupScheduling: boolean;
  groupInvitations: boolean;
}

const FREE_LIMITS: TierLimits = {
  maxMaps: 3,
  maxScenesPerMap: 1,
  maxGroups: 1,
  maxMapUploads: 1,
  maxTokenUploads: 1,
  combatSystem: true,
  realtimeSync: true,
  chatWhispers: false,
  monsterCompendium: false,
  characterLibrary: false,
  wallsAndTerrain: false,
  aiDmAssistant: false,
  groupScheduling: false,
  groupInvitations: true,
};

const ADVENTURER_LIMITS: TierLimits = {
  maxMaps: Infinity,
  maxScenesPerMap: 5,
  maxGroups: 2,
  maxMapUploads: 15,
  maxTokenUploads: 10,
  combatSystem: true,
  realtimeSync: true,
  chatWhispers: true,
  monsterCompendium: true,
  characterLibrary: true,
  wallsAndTerrain: false,
  aiDmAssistant: false,
  groupScheduling: true,
  groupInvitations: true,
};

const DM_LIMITS: TierLimits = {
  maxMaps: Infinity,
  maxScenesPerMap: 10,
  maxGroups: 3,
  maxMapUploads: 30,
  maxTokenUploads: 20,
  combatSystem: true,
  realtimeSync: true,
  chatWhispers: true,
  monsterCompendium: true,
  characterLibrary: true,
  wallsAndTerrain: true,
  aiDmAssistant: true,
  groupScheduling: true,
  groupInvitations: true,
};

const TIER_MAP: Record<AccountTier, TierLimits> = {
  free: FREE_LIMITS,
  adventurer: ADVENTURER_LIMITS,
  dungeon_master: DM_LIMITS,
  admin: { ...DM_LIMITS, maxMapUploads: Infinity, maxTokenUploads: Infinity },
};

export function getTierLimits(tier: AccountTier): TierLimits {
  return TIER_MAP[tier] ?? FREE_LIMITS;
}

export function tierDisplayName(tier: AccountTier): string {
  switch (tier) {
    case "free":
      return "\uD83C\uDF3F Free";
    case "adventurer":
      return "\uD83D\uDC5F Adventurer";
    case "dungeon_master":
      return "\u2694\uFE0F Hero";
    case "admin":
      return "\u2B50 Lodestar";
    default:
      return "Free";
  }
}

export function tierPrice(tier: AccountTier): number | null {
  switch (tier) {
    case "adventurer":
      return 5;
    case "dungeon_master":
      return 10;
    default:
      return null;
  }
}
