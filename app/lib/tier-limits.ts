export type AccountTier = "adventurer" | "hero" | "dungeon_master" | "the_six" | "lodestar";

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
  aiImageGeneration: boolean;
  aiImageLimit: number;
  aiImageLimitWindow: "daily" | "weekly" | "monthly";
  groupScheduling: boolean;
  groupInvitations: boolean;
}

const ADVENTURER_LIMITS: TierLimits = {
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
  aiImageGeneration: true,
  aiImageLimit: 1,
  aiImageLimitWindow: "monthly",
  groupScheduling: false,
  groupInvitations: true,
};

const HERO_LIMITS: TierLimits = {
  maxMaps: 10,
  maxScenesPerMap: 2,
  maxGroups: 2,
  maxMapUploads: 5,
  maxTokenUploads: 5,
  combatSystem: true,
  realtimeSync: true,
  chatWhispers: true,
  monsterCompendium: true,
  characterLibrary: true,
  wallsAndTerrain: false,
  aiDmAssistant: false,
  aiImageGeneration: true,
  aiImageLimit: 2,
  aiImageLimitWindow: "weekly",
  groupScheduling: true,
  groupInvitations: true,
};

const DM_LIMITS: TierLimits = {
  maxMaps: 15,
  maxScenesPerMap: 3,
  maxGroups: 3,
  maxMapUploads: 10,
  maxTokenUploads: 20,
  combatSystem: true,
  realtimeSync: true,
  chatWhispers: true,
  monsterCompendium: true,
  characterLibrary: true,
  wallsAndTerrain: true,
  aiDmAssistant: true,
  aiImageGeneration: true,
  aiImageLimit: 5,
  aiImageLimitWindow: "weekly",
  groupScheduling: true,
  groupInvitations: true,
};

const THE_SIX_LIMITS: TierLimits = {
  ...DM_LIMITS,
  maxMaps: 20,
  maxScenesPerMap: 6,
  maxMapUploads: 15,
  maxTokenUploads: 25,
  aiImageLimit: 6,
  aiImageLimitWindow: "daily",
};

const LODESTAR_LIMITS: TierLimits = {
  ...DM_LIMITS,
  maxMaps: Infinity,
  maxScenesPerMap: Infinity,
  maxGroups: Infinity,
  maxMapUploads: Infinity,
  maxTokenUploads: Infinity,
  aiImageLimit: Infinity,
  aiImageLimitWindow: "daily",
};

const TIER_MAP: Record<AccountTier, TierLimits> = {
  adventurer: ADVENTURER_LIMITS,
  hero: HERO_LIMITS,
  dungeon_master: DM_LIMITS,
  the_six: THE_SIX_LIMITS,
  lodestar: LODESTAR_LIMITS,
};

export function getTierLimits(tier: AccountTier): TierLimits {
  return TIER_MAP[tier] ?? ADVENTURER_LIMITS;
}

export function tierDisplayName(tier: AccountTier): string {
  switch (tier) {
    case "adventurer":
      return "\uD83D\uDDE1\uFE0F Adventurer";
    case "hero":
      return "\u2694\uFE0F Hero";
    case "dungeon_master":
      return "\uD83D\uDC09 Dungeon Master";
    case "the_six":
      return "\u2721 The Six";
    case "lodestar":
      return "\u2B50 Lodestar";
    default:
      return "Adventurer";
  }
}

export function tierPrice(tier: AccountTier): number | null {
  switch (tier) {
    case "hero":
      return 5;
    case "dungeon_master":
      return 10;
    default:
      return null;
  }
}
