// SRD Monster data types - matches dnd5eapi.co structure (stripped of url fields)

export interface SrdArmorClass {
  type: string;
  value: number;
}

export interface SrdSpeed {
  walk?: string;
  swim?: string;
  fly?: string;
  burrow?: string;
  climb?: string;
  hover?: boolean;
}

export interface SrdProficiency {
  value: number;
  proficiency: {
    index: string;
    name: string;
  };
}

export interface SrdDamage {
  damage_type: {
    index: string;
    name: string;
  };
  damage_dice: string;
}

export interface SrdDC {
  dc_type: {
    index: string;
    name: string;
  };
  dc_value: number;
  success_type: string;
}

export interface SrdAction {
  name: string;
  desc: string;
  attack_bonus?: number;
  dc?: SrdDC;
  damage: SrdDamage[];
  usage?: {
    type: string;
    times?: number;
    dice?: string;
    min_value?: number;
  };
  multiattack_type?: string;
  actions?: { action_name: string; count: string; type: string }[];
}

export interface SrdSpecialAbility {
  name: string;
  desc: string;
  dc?: SrdDC;
  damage: SrdDamage[];
  usage?: {
    type: string;
    times?: number;
    rest_types?: string[];
  };
  spellcasting?: {
    level?: number;
    ability: {
      index: string;
      name: string;
    };
    dc?: number;
    modifier?: number;
    slots?: Record<string, number>;
    spells: {
      name: string;
      level: number;
      notes?: string;
      usage?: { type: string; times?: number; rest_types?: string[] };
    }[];
  };
}

export interface SrdLegendaryAction {
  name: string;
  desc: string;
  damage: SrdDamage[];
  dc?: SrdDC;
  attack_bonus?: number;
}

export interface SrdReaction {
  name: string;
  desc: string;
  dc?: SrdDC;
  damage?: SrdDamage[];
}

export interface SrdSenses {
  blindsight?: string;
  darkvision?: string;
  passive_perception: number;
  tremorsense?: string;
  truesight?: string;
}

export interface SrdConditionImmunity {
  index: string;
  name: string;
}

export interface SrdMonster {
  index: string;
  name: string;
  size: string;
  type: string;
  subtype?: string;
  alignment: string;
  armor_class: SrdArmorClass[];
  hit_points: number;
  hit_dice: string;
  hit_points_roll: string;
  speed: SrdSpeed;
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  proficiencies: SrdProficiency[];
  damage_vulnerabilities: string[];
  damage_resistances: string[];
  damage_immunities: string[];
  condition_immunities: SrdConditionImmunity[];
  senses: SrdSenses;
  languages: string;
  challenge_rating: number;
  proficiency_bonus: number;
  xp: number;
  special_abilities: SrdSpecialAbility[];
  actions: SrdAction[];
  legendary_actions: SrdLegendaryAction[];
  reactions: SrdReaction[];
}

export const MONSTER_TYPES = [
  "aberration",
  "beast",
  "celestial",
  "construct",
  "dragon",
  "elemental",
  "fey",
  "fiend",
  "giant",
  "humanoid",
  "monstrosity",
  "ooze",
  "plant",
  "swarm",
  "undead",
] as const;

export const CHALLENGE_RATINGS = [
  0, 0.125, 0.25, 0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
  16, 17, 18, 19, 20, 21, 22, 23, 24, 30,
] as const;

export function formatCR(cr: number): string {
  if (cr === 0.125) return "1/8";
  if (cr === 0.25) return "1/4";
  if (cr === 0.5) return "1/2";
  return String(cr);
}
