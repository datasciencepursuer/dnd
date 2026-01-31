// Grid Types
export type GridType = "square" | "hex";

export interface GridSettings {
  type: GridType;
  cellSize: number;
  width: number;
  height: number;
  showGrid: boolean;
  gridColor: string;
  gridOpacity: number;
}

// Position Types
export interface Position {
  x: number;
  y: number;
}

export interface GridPosition {
  col: number;
  row: number;
}

// Token Types
export type TokenLayer = "character" | "monster" | "object";

// Character Sheet Types
export interface AbilityScore {
  score: number; // 1-30, default 10
  modifier: number; // Math.floor((score - 10) / 2)
  savingThrowProficient: boolean;
}

export interface AbilityScores {
  strength: AbilityScore;
  dexterity: AbilityScore;
  constitution: AbilityScore;
  intelligence: AbilityScore;
  wisdom: AbilityScore;
  charisma: AbilityScore;
}

export type CreatureSize = "S" | "M" | "L"; // Small, Medium, Large

// D&D 5e skill proficiencies
export interface SkillProficiencies {
  // Strength
  athletics: boolean;
  // Dexterity
  acrobatics: boolean;
  sleightOfHand: boolean;
  stealth: boolean;
  // Intelligence
  arcana: boolean;
  history: boolean;
  investigation: boolean;
  nature: boolean;
  religion: boolean;
  // Wisdom
  animalHandling: boolean;
  insight: boolean;
  medicine: boolean;
  perception: boolean;
  survival: boolean;
  // Charisma
  deception: boolean;
  intimidation: boolean;
  performance: boolean;
  persuasion: boolean;
}

// Armor proficiency options
export interface ArmorProficiencies {
  light: boolean;
  medium: boolean;
  heavy: boolean;
  shields: boolean;
}

// Class feature categories
export type FeatureCategory = "action" | "bonusAction" | "reaction" | "limitedUse";

export interface ClassFeature {
  id: string;
  name: string; // Single text field for the feature
  category: FeatureCategory;
}

// Weapon entry for attacks
export interface Weapon {
  id: string;
  name: string;
  bonus: number; // Attack bonus (+5, etc.)
  dice: string; // Damage dice (1d8, 2d6, etc.)
  damageType: string; // Slashing, Piercing, Fire, etc.
  notes: string; // Extra notes (magical, versatile, etc.)
}

// Currency
export interface Coins {
  cp: number; // Copper
  sp: number; // Silver
  ep: number; // Electrum
  gp: number; // Gold
  pp: number; // Platinum
}

// D&D 5e Conditions
export type Condition =
  | "Healthy"
  | "Blinded"
  | "Charmed"
  | "Deafened"
  | "Frightened"
  | "Grappled"
  | "Incapacitated"
  | "Invisible"
  | "Paralyzed"
  | "Petrified"
  | "Poisoned"
  | "Prone"
  | "Restrained"
  | "Stunned"
  | "Unconscious"
  | "Exhaustion";

export interface CharacterSheet {
  // Basic info
  background: string | null;
  characterClass: string | null;
  subclass: string | null;
  race: string | null;
  level: number;
  experience: number;

  // Combat stats
  ac: number;
  hpMax: number;
  hpCurrent: number;
  hitDice: string; // e.g., "1d10"
  proficiencyBonus: number;
  initiative: number;
  speed: number; // feet
  creatureSize: CreatureSize;

  // Abilities
  abilities: AbilityScores;

  // Skills
  skills: SkillProficiencies;

  // Equipment & Training Proficiencies
  armorProficiencies: ArmorProficiencies;
  weaponProficiencies: string; // Free text (e.g., "Simple weapons, Martial weapons, Longsword")
  toolProficiencies: string; // Free text (e.g., "Thieves' tools, Herbalism kit")

  // Class Features, Species Traits, Feats
  classFeatures: ClassFeature[];
  speciesTraits: string; // Free text
  feats: string; // Free text

  // Weapons & Equipment
  weapons: Weapon[];
  coins: Coins;

  // Status
  heroicInspiration: boolean;
  condition: Condition;

  // Death Saves
  deathSaves: {
    successes: [boolean, boolean, boolean];
    failures: [boolean, boolean, boolean];
  };
}

export interface Token {
  id: string;
  name: string;
  imageUrl: string | null;
  color: string;
  size: number;
  position: GridPosition;
  rotation: number;
  flipped: boolean;
  visible: boolean;
  layer: TokenLayer;
  ownerId: string | null; // User who created/owns this token (null = map owner)
  characterSheet: CharacterSheet | null;
  // If set, this token is linked to a shared character from the library
  // The character's data (name, image, color, size, characterSheet) takes precedence
  characterId: string | null;
}

// Permission levels for map access
export type MapPermission = "view" | "edit" | "owner";

// Granular player permissions
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
export const DEFAULT_PERMISSIONS: Record<MapPermission, PlayerPermissions> = {
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

// Editor context for permission checking
export interface EditorContext {
  userId: string | null;
  permission: MapPermission;
  permissions: PlayerPermissions;
  isMapOwner: boolean;
}

// Drawing Types
export type DrawingTool = "wall" | "area" | "text" | "freehand";

export interface WallSegment {
  id: string;
  points: Position[];
  color: string;
  width: number;
  doorway: boolean;
}

export interface AreaShape {
  id: string;
  type: "rectangle" | "circle" | "polygon";
  points: Position[];
  fillColor: string;
  fillOpacity: number;
  strokeColor: string;
  strokeWidth: number;
  label?: string;
}

export interface TextLabel {
  id: string;
  text: string;
  position: Position;
  fontSize: number;
  color: string;
  rotation: number;
}

export interface FreehandPath {
  id: string;
  points: number[];
  color: string;
  width: number;
}

// Fog of War
export interface FogCell {
  key: string; // "col,row" format
  creatorId: string; // User who painted this fog
}

export interface FogOfWar {
  enabled: boolean;
  revealedCells: string[]; // Legacy - cells revealed through fog
  paintedCells: FogCell[]; // Painted fog cells with creator info
}

// Background
export interface Background {
  imageUrl: string;
  position: Position;
  scale: number;
  rotation: number;
}

// Roll Result (for shared dice history)
export interface RollResult {
  id: string;
  dice: string;
  count: number;
  rolls: number[];
  modifier: number;
  total: number;
  timestamp: number;
  rollerId: string;
  rollerName: string;
  tokenId: string;
  tokenName: string;
  tokenColor: string;
}

// Complete Map
export interface DnDMap {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  grid: GridSettings;
  background: Background | null;
  tokens: Token[];
  walls: WallSegment[];
  areas: AreaShape[];
  labels: TextLabel[];
  freehand: FreehandPath[];
  fogOfWar: FogOfWar;
  rollHistory: RollResult[];
  viewport: {
    x: number;
    y: number;
    scale: number;
  };
}

// Editor State
export type EditorTool =
  | "select"
  | "pan"
  | "draw"
  | "erase"
  | "fog"
  | "ping"
  | "token"
  | "wall"
  | "area"
  | "text"
  | "fog-reveal"
  | "fog-hide";

// Ping for real-time signaling
export interface Ping {
  id: string;
  x: number;
  y: number;
  color: string;
  userId: string;
  timestamp: number;
}

export interface EditorState {
  selectedTool: EditorTool;
  selectedElementIds: string[];
  currentColor: string;
  currentStrokeWidth: number;
  isDrawing: boolean;
  isPanning: boolean;
  snapToGrid: boolean;
}
