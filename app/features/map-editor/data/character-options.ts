// Generated from the supplied D&D 2024 SRD 5.2.1 Markdown extracts.
// Canonical source: System Reference Document v5.2.1, D&D Beyond — https://www.dndbeyond.com/srd
// Coverage is SRD-only and is not a claim of full 2024 Player's Handbook coverage.

export const DND_CATALOG_METADATA = {
  ruleset: "D&D 2024 rules",
  source: "System Reference Document v5.2.1",
  sourceVersion: "5.2.1",
  sourceUrl: "https://www.dndbeyond.com/srd",
  attribution: "D&D Beyond, System Reference Document v5.2.1",
  license: "Creative Commons Attribution 4.0 International (CC BY 4.0)",
  coverage: "SRD-only; not full 2024 Player's Handbook coverage",
  sourceFiles: [
    "character-origins.md",
    "classes.md",
    "feats.md",
    "spells.md",
    "equipment.md",
    "magic-items.md",
  ],
  sourceManifest: "docs/data/2024-srd-catalog-manifest.json",
} as const;

export const DND_2024_CATALOG_METADATA = DND_CATALOG_METADATA;

export const DND_SPECIES_METADATA = [
  {
    "name": "Dragonborn",
    "traits": [
      "Draconic Ancestry",
      "Breath Weapon",
      "Damage Resistance",
      "Darkvision",
      "Draconic Flight"
    ]
  },
  {
    "name": "Dwarf",
    "traits": [
      "Darkvision",
      "Dwarven Resilience",
      "Dwarven Toughness",
      "Stonecunning"
    ]
  },
  {
    "name": "Elf",
    "traits": [
      "Darkvision",
      "Elven Lineage",
      "Fey Ancestry",
      "Keen Senses",
      "Trance"
    ]
  },
  {
    "name": "Gnome",
    "traits": [
      "Darkvision",
      "Gnomish Cunning",
      "Gnomish Lineage"
    ]
  },
  {
    "name": "Goliath",
    "traits": [
      "Giant Ancestry",
      "Large Form",
      "Powerful Build"
    ]
  },
  {
    "name": "Halfling",
    "traits": [
      "Brave",
      "Halfling Nimbleness",
      "Luck",
      "Naturally Stealthy"
    ]
  },
  {
    "name": "Human",
    "traits": [
      "Resourceful",
      "Skillful",
      "Versatile"
    ]
  },
  {
    "name": "Orc",
    "traits": [
      "Adrenaline Rush",
      "Darkvision",
      "Relentless Endurance"
    ]
  },
  {
    "name": "Tiefling",
    "traits": [
      "Darkvision",
      "Fiendish Legacy",
      "Otherworldly Presence"
    ]
  }
] as const;
export const DND_RACES: string[] = DND_SPECIES_METADATA.map(({ name }) => name);

export const DND_CLASS_METADATA = [
  {
    "name": "Barbarian",
    "subclasses": [
      "Path of the Berserker"
    ]
  },
  {
    "name": "Bard",
    "subclasses": [
      "College of Lore"
    ]
  },
  {
    "name": "Cleric",
    "subclasses": [
      "Life Domain"
    ]
  },
  {
    "name": "Druid",
    "subclasses": [
      "Circle of the Land"
    ]
  },
  {
    "name": "Fighter",
    "subclasses": [
      "Champion"
    ]
  },
  {
    "name": "Monk",
    "subclasses": [
      "Warrior of the Open Hand"
    ]
  },
  {
    "name": "Paladin",
    "subclasses": [
      "Oath of Devotion"
    ]
  },
  {
    "name": "Ranger",
    "subclasses": [
      "Hunter"
    ]
  },
  {
    "name": "Rogue",
    "subclasses": [
      "Thief"
    ]
  },
  {
    "name": "Sorcerer",
    "subclasses": [
      "Draconic Sorcery"
    ]
  },
  {
    "name": "Warlock",
    "subclasses": [
      "Fiend Patron"
    ]
  },
  {
    "name": "Wizard",
    "subclasses": [
      "Evoker"
    ]
  }
] as const;
export const DND_CLASSES: string[] = DND_CLASS_METADATA.map(({ name }) => name);
export const DND_SUBCLASSES: Record<string, string[]> = Object.fromEntries(
  DND_CLASS_METADATA.map(({ name, subclasses }) => [name, [...subclasses]] as const)
);

export const DND_BACKGROUND_METADATA = [
  {
    "name": "Acolyte"
  },
  {
    "name": "Criminal"
  },
  {
    "name": "Sage"
  },
  {
    "name": "Soldier"
  }
] as const;
export const DND_BACKGROUNDS: string[] = DND_BACKGROUND_METADATA.map(({ name }) => name);

export const DND_FEAT_METADATA = [
  {
    "name": "Alert",
    "category": "Origin"
  },
  {
    "name": "Magic Initiate",
    "category": "Origin"
  },
  {
    "name": "Savage Attacker",
    "category": "Origin"
  },
  {
    "name": "Skilled",
    "category": "Origin"
  },
  {
    "name": "Ability Score Improvement",
    "category": "General"
  },
  {
    "name": "Grappler",
    "category": "General"
  },
  {
    "name": "Archery",
    "category": "Fighting Style"
  },
  {
    "name": "Defense",
    "category": "Fighting Style"
  },
  {
    "name": "Great Weapon Fighting",
    "category": "Fighting Style"
  },
  {
    "name": "Two-Weapon Fighting",
    "category": "Fighting Style"
  },
  {
    "name": "Boon of Combat Prowess",
    "category": "Epic Boon"
  },
  {
    "name": "Boon of Dimensional Travel",
    "category": "Epic Boon"
  },
  {
    "name": "Boon of Fate",
    "category": "Epic Boon"
  },
  {
    "name": "Boon of Irresistible Offense",
    "category": "Epic Boon"
  },
  {
    "name": "Boon of Spell Recall",
    "category": "Epic Boon"
  },
  {
    "name": "Boon of the Night Spirit",
    "category": "Epic Boon"
  },
  {
    "name": "Boon of Truesight",
    "category": "Epic Boon"
  }
] as const;
export const DND_FEATS: string[] = DND_FEAT_METADATA.map(({ name }) => name);

export const DND_SPELL_METADATA = [
  {
    "name": "Acid Arrow",
    "level": 2
  },
  {
    "name": "Acid Splash",
    "level": 0
  },
  {
    "name": "Aid",
    "level": 2
  },
  {
    "name": "Alarm",
    "level": 1
  },
  {
    "name": "Alter Self",
    "level": 2
  },
  {
    "name": "Animal Friendship",
    "level": 1
  },
  {
    "name": "Animal Messenger",
    "level": 2
  },
  {
    "name": "Animal Shapes",
    "level": 8
  },
  {
    "name": "Animate Dead",
    "level": 3
  },
  {
    "name": "Animate Objects",
    "level": 5
  },
  {
    "name": "Antilife Shell",
    "level": 5
  },
  {
    "name": "Antimagic Field",
    "level": 8
  },
  {
    "name": "Antipathy/Sympathy",
    "level": 8
  },
  {
    "name": "Arcane Eye",
    "level": 4
  },
  {
    "name": "Arcane Hand",
    "level": 5
  },
  {
    "name": "Arcane Lock",
    "level": 2
  },
  {
    "name": "Arcane Sword",
    "level": 7
  },
  {
    "name": "Arcanist's Magic Aura",
    "level": 2
  },
  {
    "name": "Astral Projection",
    "level": 9
  },
  {
    "name": "Augury",
    "level": 2
  },
  {
    "name": "Aura of Life",
    "level": 4
  },
  {
    "name": "Awaken",
    "level": 5
  },
  {
    "name": "Bane",
    "level": 1
  },
  {
    "name": "Banishment",
    "level": 4
  },
  {
    "name": "Barkskin",
    "level": 2
  },
  {
    "name": "Beacon of Hope",
    "level": 3
  },
  {
    "name": "Befuddlement",
    "level": 8
  },
  {
    "name": "Bestow Curse",
    "level": 3
  },
  {
    "name": "Black Tentacles",
    "level": 4
  },
  {
    "name": "Blade Barrier",
    "level": 6
  },
  {
    "name": "Bless",
    "level": 1
  },
  {
    "name": "Blight",
    "level": 4
  },
  {
    "name": "Blindness/Deafness",
    "level": 2
  },
  {
    "name": "Blink",
    "level": 3
  },
  {
    "name": "Blur",
    "level": 2
  },
  {
    "name": "Burning Hands",
    "level": 1
  },
  {
    "name": "Call Lightning",
    "level": 3
  },
  {
    "name": "Calm Emotions",
    "level": 2
  },
  {
    "name": "Chain Lightning",
    "level": 6
  },
  {
    "name": "Charm Monster",
    "level": 4
  },
  {
    "name": "Charm Person",
    "level": 1
  },
  {
    "name": "Chill Touch",
    "level": 0
  },
  {
    "name": "Chromatic Orb",
    "level": 1
  },
  {
    "name": "Circle of Death",
    "level": 6
  },
  {
    "name": "Clairvoyance",
    "level": 3
  },
  {
    "name": "Clone",
    "level": 8
  },
  {
    "name": "Cloudkill",
    "level": 5
  },
  {
    "name": "Color Spray",
    "level": 1
  },
  {
    "name": "Command",
    "level": 1
  },
  {
    "name": "Commune",
    "level": 5
  },
  {
    "name": "Commune with Nature",
    "level": 5
  },
  {
    "name": "Comprehend Languages",
    "level": 1
  },
  {
    "name": "Compulsion",
    "level": 4
  },
  {
    "name": "Cone of Cold",
    "level": 5
  },
  {
    "name": "Confusion",
    "level": 4
  },
  {
    "name": "Conjure Animals",
    "level": 3
  },
  {
    "name": "Conjure Celestial",
    "level": 7
  },
  {
    "name": "Conjure Elemental",
    "level": 5
  },
  {
    "name": "Conjure Fey",
    "level": 6
  },
  {
    "name": "Conjure Minor Elementals",
    "level": 4
  },
  {
    "name": "Conjure Woodland Beings",
    "level": 4
  },
  {
    "name": "Contact Other Plane",
    "level": 5
  },
  {
    "name": "Contagion",
    "level": 5
  },
  {
    "name": "Contingency",
    "level": 6
  },
  {
    "name": "Continual Flame",
    "level": 2
  },
  {
    "name": "Control Water",
    "level": 4
  },
  {
    "name": "Control Weather",
    "level": 8
  },
  {
    "name": "Counterspell",
    "level": 3
  },
  {
    "name": "Create Food and Water",
    "level": 3
  },
  {
    "name": "Create or Destroy Water",
    "level": 1
  },
  {
    "name": "Create Undead",
    "level": 6
  },
  {
    "name": "Creation",
    "level": 5
  },
  {
    "name": "Cure Wounds",
    "level": 1
  },
  {
    "name": "Dancing Lights",
    "level": 0
  },
  {
    "name": "Darkness",
    "level": 2
  },
  {
    "name": "Darkvision",
    "level": 2
  },
  {
    "name": "Daylight",
    "level": 3
  },
  {
    "name": "Death Ward",
    "level": 4
  },
  {
    "name": "Delayed Blast Fireball",
    "level": 7
  },
  {
    "name": "Demiplane",
    "level": 8
  },
  {
    "name": "Detect Evil and Good",
    "level": 1
  },
  {
    "name": "Detect Magic",
    "level": 1
  },
  {
    "name": "Detect Poison and Disease",
    "level": 1
  },
  {
    "name": "Detect Thoughts",
    "level": 2
  },
  {
    "name": "Dimension Door",
    "level": 4
  },
  {
    "name": "Disguise Self",
    "level": 1
  },
  {
    "name": "Disintegrate",
    "level": 6
  },
  {
    "name": "Dispel Evil and Good",
    "level": 5
  },
  {
    "name": "Dispel Magic",
    "level": 3
  },
  {
    "name": "Dissonant Whispers",
    "level": 1
  },
  {
    "name": "Divination",
    "level": 4
  },
  {
    "name": "Divine Favor",
    "level": 1
  },
  {
    "name": "Divine Smite",
    "level": 1
  },
  {
    "name": "Divine Word",
    "level": 7
  },
  {
    "name": "Dominate Beast",
    "level": 4
  },
  {
    "name": "Dominate Monster",
    "level": 8
  },
  {
    "name": "Dominate Person",
    "level": 5
  },
  {
    "name": "Dragon's Breath",
    "level": 2
  },
  {
    "name": "Dream",
    "level": 5
  },
  {
    "name": "Druidcraft",
    "level": 0
  },
  {
    "name": "Earthquake",
    "level": 8
  },
  {
    "name": "Eldritch Blast",
    "level": 0
  },
  {
    "name": "Elementalism",
    "level": 0
  },
  {
    "name": "Enhance Ability",
    "level": 2
  },
  {
    "name": "Enlarge/Reduce",
    "level": 2
  },
  {
    "name": "Ensnaring Strike",
    "level": 1
  },
  {
    "name": "Entangle",
    "level": 1
  },
  {
    "name": "Enthrall",
    "level": 2
  },
  {
    "name": "Etherealness",
    "level": 7
  },
  {
    "name": "Expeditious Retreat",
    "level": 1
  },
  {
    "name": "Eyebite",
    "level": 6
  },
  {
    "name": "Fabricate",
    "level": 4
  },
  {
    "name": "Faerie Fire",
    "level": 1
  },
  {
    "name": "Faithful Hound",
    "level": 4
  },
  {
    "name": "False Life",
    "level": 1
  },
  {
    "name": "Fear",
    "level": 3
  },
  {
    "name": "Feather Fall",
    "level": 1
  },
  {
    "name": "Find Familiar",
    "level": 1
  },
  {
    "name": "Find Steed",
    "level": 2
  },
  {
    "name": "Find the Path",
    "level": 6
  },
  {
    "name": "Find Traps",
    "level": 2
  },
  {
    "name": "Finger of Death",
    "level": 7
  },
  {
    "name": "Fireball",
    "level": 3
  },
  {
    "name": "Fire Bolt",
    "level": 0
  },
  {
    "name": "Fire Shield",
    "level": 4
  },
  {
    "name": "Fire Storm",
    "level": 7
  },
  {
    "name": "Flame Blade",
    "level": 2
  },
  {
    "name": "Flame Strike",
    "level": 5
  },
  {
    "name": "Flaming Sphere",
    "level": 2
  },
  {
    "name": "Flesh to Stone",
    "level": 6
  },
  {
    "name": "Floating Disk",
    "level": 1
  },
  {
    "name": "Fly",
    "level": 3
  },
  {
    "name": "Fog Cloud",
    "level": 1
  },
  {
    "name": "Forbiddance",
    "level": 6
  },
  {
    "name": "Forcecage",
    "level": 7
  },
  {
    "name": "Foresight",
    "level": 9
  },
  {
    "name": "Freedom of Movement",
    "level": 4
  },
  {
    "name": "Freezing Sphere",
    "level": 6
  },
  {
    "name": "Gaseous Form",
    "level": 3
  },
  {
    "name": "Gate",
    "level": 9
  },
  {
    "name": "Geas",
    "level": 5
  },
  {
    "name": "Gentle Repose",
    "level": 2
  },
  {
    "name": "Giant Insect",
    "level": 4
  },
  {
    "name": "Glibness",
    "level": 8
  },
  {
    "name": "Globe of Invulnerability",
    "level": 6
  },
  {
    "name": "Glyph of Warding",
    "level": 3
  },
  {
    "name": "Goodberry",
    "level": 1
  },
  {
    "name": "Grease",
    "level": 1
  },
  {
    "name": "Greater Invisibility",
    "level": 4
  },
  {
    "name": "Greater Restoration",
    "level": 5
  },
  {
    "name": "Guardian of Faith",
    "level": 4
  },
  {
    "name": "Guards and Wards",
    "level": 6
  },
  {
    "name": "Guidance",
    "level": 0
  },
  {
    "name": "Guiding Bolt",
    "level": 1
  },
  {
    "name": "Gust of Wind",
    "level": 2
  },
  {
    "name": "Hallow",
    "level": 5
  },
  {
    "name": "Hallucinatory Terrain",
    "level": 4
  },
  {
    "name": "Harm",
    "level": 6
  },
  {
    "name": "Haste",
    "level": 3
  },
  {
    "name": "Heal",
    "level": 6
  },
  {
    "name": "Healing Word",
    "level": 1
  },
  {
    "name": "Heat Metal",
    "level": 2
  },
  {
    "name": "Hellish Rebuke",
    "level": 1
  },
  {
    "name": "Heroes' Feast",
    "level": 6
  },
  {
    "name": "Heroism",
    "level": 1
  },
  {
    "name": "Hex",
    "level": 1
  },
  {
    "name": "Hideous Laughter",
    "level": 1
  },
  {
    "name": "Hold Monster",
    "level": 5
  },
  {
    "name": "Hold Person",
    "level": 2
  },
  {
    "name": "Holy Aura",
    "level": 8
  },
  {
    "name": "Hunter's Mark",
    "level": 1
  },
  {
    "name": "Hypnotic Pattern",
    "level": 3
  },
  {
    "name": "Ice Knife",
    "level": 1
  },
  {
    "name": "Ice Storm",
    "level": 4
  },
  {
    "name": "Identify",
    "level": 1
  },
  {
    "name": "Illusory Script",
    "level": 1
  },
  {
    "name": "Imprisonment",
    "level": 9
  },
  {
    "name": "Incendiary Cloud",
    "level": 8
  },
  {
    "name": "Inflict Wounds",
    "level": 1
  },
  {
    "name": "Insect Plague",
    "level": 5
  },
  {
    "name": "Instant Summons",
    "level": 6
  },
  {
    "name": "Irresistible Dance",
    "level": 6
  },
  {
    "name": "Invisibility",
    "level": 2
  },
  {
    "name": "Jump",
    "level": 1
  },
  {
    "name": "Knock",
    "level": 2
  },
  {
    "name": "Legend Lore",
    "level": 5
  },
  {
    "name": "Lesser Restoration",
    "level": 2
  },
  {
    "name": "Levitate",
    "level": 2
  },
  {
    "name": "Light",
    "level": 0
  },
  {
    "name": "Lightning Bolt",
    "level": 3
  },
  {
    "name": "Locate Animals or Plants",
    "level": 2
  },
  {
    "name": "Locate Creature",
    "level": 4
  },
  {
    "name": "Locate Object",
    "level": 2
  },
  {
    "name": "Longstrider",
    "level": 1
  },
  {
    "name": "Mage Armor",
    "level": 1
  },
  {
    "name": "Mage Hand",
    "level": 0
  },
  {
    "name": "Magic Circle",
    "level": 3
  },
  {
    "name": "Magic Jar",
    "level": 6
  },
  {
    "name": "Magic Missile",
    "level": 1
  },
  {
    "name": "Magic Mouth",
    "level": 2
  },
  {
    "name": "Magic Weapon",
    "level": 2
  },
  {
    "name": "Magnificent Mansion",
    "level": 7
  },
  {
    "name": "Major Image",
    "level": 3
  },
  {
    "name": "Mass Cure Wounds",
    "level": 5
  },
  {
    "name": "Mass Heal",
    "level": 9
  },
  {
    "name": "Mass Healing Word",
    "level": 3
  },
  {
    "name": "Mass Suggestion",
    "level": 6
  },
  {
    "name": "Maze",
    "level": 8
  },
  {
    "name": "Meld into Stone",
    "level": 3
  },
  {
    "name": "Mending",
    "level": 0
  },
  {
    "name": "Message",
    "level": 0
  },
  {
    "name": "Meteor Swarm",
    "level": 9
  },
  {
    "name": "Mind Blank",
    "level": 8
  },
  {
    "name": "Mind Spike",
    "level": 2
  },
  {
    "name": "Minor Illusion",
    "level": 0
  },
  {
    "name": "Mirage Arcane",
    "level": 7
  },
  {
    "name": "Mirror Image",
    "level": 2
  },
  {
    "name": "Mislead",
    "level": 5
  },
  {
    "name": "Misty Step",
    "level": 2
  },
  {
    "name": "Modify Memory",
    "level": 5
  },
  {
    "name": "Moonbeam",
    "level": 2
  },
  {
    "name": "Move Earth",
    "level": 6
  },
  {
    "name": "Nondetection",
    "level": 3
  },
  {
    "name": "Passwall",
    "level": 5
  },
  {
    "name": "Pass without Trace",
    "level": 2
  },
  {
    "name": "Phantasmal Force",
    "level": 2
  },
  {
    "name": "Phantasmal Killer",
    "level": 4
  },
  {
    "name": "Phantom Steed",
    "level": 3
  },
  {
    "name": "Planar Ally",
    "level": 6
  },
  {
    "name": "Planar Binding",
    "level": 5
  },
  {
    "name": "Plane Shift",
    "level": 7
  },
  {
    "name": "Plant Growth",
    "level": 3
  },
  {
    "name": "Poison Spray",
    "level": 0
  },
  {
    "name": "Polymorph",
    "level": 4
  },
  {
    "name": "Power Word Heal",
    "level": 9
  },
  {
    "name": "Power Word Kill",
    "level": 9
  },
  {
    "name": "Power Word Stun",
    "level": 8
  },
  {
    "name": "Prayer of Healing",
    "level": 2
  },
  {
    "name": "Prestidigitation",
    "level": 0
  },
  {
    "name": "Prismatic Spray",
    "level": 7
  },
  {
    "name": "Prismatic Wall",
    "level": 9
  },
  {
    "name": "Private Sanctum",
    "level": 4
  },
  {
    "name": "Produce Flame",
    "level": 0
  },
  {
    "name": "Programmed Illusion",
    "level": 6
  },
  {
    "name": "Project Image",
    "level": 7
  },
  {
    "name": "Protection from Energy",
    "level": 3
  },
  {
    "name": "Protection from Evil and Good",
    "level": 1
  },
  {
    "name": "Protection from Poison",
    "level": 2
  },
  {
    "name": "Purify Food and Drink",
    "level": 1
  },
  {
    "name": "Raise Dead",
    "level": 5
  },
  {
    "name": "Ray of Enfeeblement",
    "level": 2
  },
  {
    "name": "Ray of Frost",
    "level": 0
  },
  {
    "name": "Regenerate",
    "level": 7
  },
  {
    "name": "Ray of Sickness",
    "level": 1
  },
  {
    "name": "Reincarnate",
    "level": 5
  },
  {
    "name": "Remove Curse",
    "level": 3
  },
  {
    "name": "Resilient Sphere",
    "level": 4
  },
  {
    "name": "Resistance",
    "level": 0
  },
  {
    "name": "Resurrection",
    "level": 7
  },
  {
    "name": "Reverse Gravity",
    "level": 7
  },
  {
    "name": "Revivify",
    "level": 3
  },
  {
    "name": "Rope Trick",
    "level": 2
  },
  {
    "name": "Sacred Flame",
    "level": 0
  },
  {
    "name": "Sanctuary",
    "level": 1
  },
  {
    "name": "Scorching Ray",
    "level": 2
  },
  {
    "name": "Scrying",
    "level": 5
  },
  {
    "name": "Searing Smite",
    "level": 1
  },
  {
    "name": "Secret Chest",
    "level": 4
  },
  {
    "name": "See Invisibility",
    "level": 2
  },
  {
    "name": "Seeming",
    "level": 5
  },
  {
    "name": "Sending",
    "level": 3
  },
  {
    "name": "Sequester",
    "level": 7
  },
  {
    "name": "Shapechange",
    "level": 9
  },
  {
    "name": "Shatter",
    "level": 2
  },
  {
    "name": "Shield",
    "level": 1
  },
  {
    "name": "Shield of Faith",
    "level": 1
  },
  {
    "name": "Shillelagh",
    "level": 0
  },
  {
    "name": "Shining Smite",
    "level": 2
  },
  {
    "name": "Shocking Grasp",
    "level": 0
  },
  {
    "name": "Silence",
    "level": 2
  },
  {
    "name": "Silent Image",
    "level": 1
  },
  {
    "name": "Simulacrum",
    "level": 7
  },
  {
    "name": "Sleep",
    "level": 1
  },
  {
    "name": "Sleet Storm",
    "level": 3
  },
  {
    "name": "Slow",
    "level": 3
  },
  {
    "name": "Sorcerous Burst",
    "level": 0
  },
  {
    "name": "Spare the Dying",
    "level": 0
  },
  {
    "name": "Speak with Animals",
    "level": 1
  },
  {
    "name": "Speak with Dead",
    "level": 3
  },
  {
    "name": "Speak with Plants",
    "level": 3
  },
  {
    "name": "Spider Climb",
    "level": 2
  },
  {
    "name": "Spike Growth",
    "level": 2
  },
  {
    "name": "Spirit Guardians",
    "level": 3
  },
  {
    "name": "Spiritual Weapon",
    "level": 2
  },
  {
    "name": "Starry Wisp",
    "level": 0
  },
  {
    "name": "Stinking Cloud",
    "level": 3
  },
  {
    "name": "Stone Shape",
    "level": 4
  },
  {
    "name": "Stoneskin",
    "level": 4
  },
  {
    "name": "Storm of Vengeance",
    "level": 9
  },
  {
    "name": "Suggestion",
    "level": 2
  },
  {
    "name": "Summon Dragon",
    "level": 5
  },
  {
    "name": "Sunbeam",
    "level": 6
  },
  {
    "name": "Sunburst",
    "level": 8
  },
  {
    "name": "Symbol",
    "level": 7
  },
  {
    "name": "Telekinesis",
    "level": 5
  },
  {
    "name": "Telepathic Bond",
    "level": 5
  },
  {
    "name": "Teleport",
    "level": 7
  },
  {
    "name": "Teleportation Circle",
    "level": 5
  },
  {
    "name": "Thaumaturgy",
    "level": 0
  },
  {
    "name": "Thunderwave",
    "level": 1
  },
  {
    "name": "Time Stop",
    "level": 9
  },
  {
    "name": "Tiny Hut",
    "level": 3
  },
  {
    "name": "Tongues",
    "level": 3
  },
  {
    "name": "Transport via Plants",
    "level": 6
  },
  {
    "name": "Tree Stride",
    "level": 5
  },
  {
    "name": "True Polymorph",
    "level": 9
  },
  {
    "name": "True Resurrection",
    "level": 9
  },
  {
    "name": "True Seeing",
    "level": 6
  },
  {
    "name": "True Strike",
    "level": 0
  },
  {
    "name": "Tsunami",
    "level": 8
  },
  {
    "name": "Unseen Servant",
    "level": 1
  },
  {
    "name": "Vampiric Touch",
    "level": 3
  },
  {
    "name": "Vicious Mockery",
    "level": 0
  },
  {
    "name": "Vitriolic Sphere",
    "level": 4
  },
  {
    "name": "Wall of Fire",
    "level": 4
  },
  {
    "name": "Wall of Force",
    "level": 5
  },
  {
    "name": "Wall of Ice",
    "level": 6
  },
  {
    "name": "Wall of Stone",
    "level": 5
  },
  {
    "name": "Wall of Thorns",
    "level": 6
  },
  {
    "name": "Warding Bond",
    "level": 2
  },
  {
    "name": "Water Breathing",
    "level": 3
  },
  {
    "name": "Water Walk",
    "level": 3
  },
  {
    "name": "Web",
    "level": 2
  },
  {
    "name": "Weird",
    "level": 9
  },
  {
    "name": "Wind Walk",
    "level": 6
  },
  {
    "name": "Wind Wall",
    "level": 3
  },
  {
    "name": "Wish",
    "level": 9
  },
  {
    "name": "Word of Recall",
    "level": 6
  },
  {
    "name": "Zone of Truth",
    "level": 2
  }
] as const;
export const DND_SPELLS: { name: string; level: number }[] = DND_SPELL_METADATA.map(({ name, level }) => ({ name, level }));

export const DND_WEAPON_METADATA = [
  {
    "name": "Club",
    "category": "Simple Melee Weapons"
  },
  {
    "name": "Dagger",
    "category": "Simple Melee Weapons"
  },
  {
    "name": "Greatclub",
    "category": "Simple Melee Weapons"
  },
  {
    "name": "Handaxe",
    "category": "Simple Melee Weapons"
  },
  {
    "name": "Javelin",
    "category": "Simple Melee Weapons"
  },
  {
    "name": "Light Hammer",
    "category": "Simple Melee Weapons"
  },
  {
    "name": "Mace",
    "category": "Simple Melee Weapons"
  },
  {
    "name": "Quarterstaff",
    "category": "Simple Melee Weapons"
  },
  {
    "name": "Sickle",
    "category": "Simple Melee Weapons"
  },
  {
    "name": "Spear",
    "category": "Simple Melee Weapons"
  },
  {
    "name": "Dart",
    "category": "Simple Ranged Weapons"
  },
  {
    "name": "Light Crossbow",
    "category": "Simple Ranged Weapons"
  },
  {
    "name": "Shortbow",
    "category": "Simple Ranged Weapons"
  },
  {
    "name": "Sling",
    "category": "Simple Ranged Weapons"
  },
  {
    "name": "Battleaxe",
    "category": "Martial Melee Weapons"
  },
  {
    "name": "Flail",
    "category": "Martial Melee Weapons"
  },
  {
    "name": "Glaive",
    "category": "Martial Melee Weapons"
  },
  {
    "name": "Greataxe",
    "category": "Martial Melee Weapons"
  },
  {
    "name": "Greatsword",
    "category": "Martial Melee Weapons"
  },
  {
    "name": "Halberd",
    "category": "Martial Melee Weapons"
  },
  {
    "name": "Lance",
    "category": "Martial Melee Weapons"
  },
  {
    "name": "Longsword",
    "category": "Martial Melee Weapons"
  },
  {
    "name": "Maul",
    "category": "Martial Melee Weapons"
  },
  {
    "name": "Morningstar",
    "category": "Martial Melee Weapons"
  },
  {
    "name": "Pike",
    "category": "Martial Melee Weapons"
  },
  {
    "name": "Rapier",
    "category": "Martial Melee Weapons"
  },
  {
    "name": "Scimitar",
    "category": "Martial Melee Weapons"
  },
  {
    "name": "Shortsword",
    "category": "Martial Melee Weapons"
  },
  {
    "name": "Trident",
    "category": "Martial Melee Weapons"
  },
  {
    "name": "Warhammer",
    "category": "Martial Melee Weapons"
  },
  {
    "name": "War Pick",
    "category": "Martial Melee Weapons"
  },
  {
    "name": "Whip",
    "category": "Martial Melee Weapons"
  },
  {
    "name": "Blowgun",
    "category": "Martial Ranged Weapons"
  },
  {
    "name": "Hand Crossbow",
    "category": "Martial Ranged Weapons"
  },
  {
    "name": "Heavy Crossbow",
    "category": "Martial Ranged Weapons"
  },
  {
    "name": "Longbow",
    "category": "Martial Ranged Weapons"
  },
  {
    "name": "Musket",
    "category": "Martial Ranged Weapons"
  },
  {
    "name": "Pistol",
    "category": "Martial Ranged Weapons"
  }
] as const;
export const DND_WEAPONS: string[] = DND_WEAPON_METADATA.map(({ name }) => name);

export const DND_EQUIPMENT_METADATA = [
  {
    "name": "Padded Armor",
    "category": "Light Armor (1 Minute to Don or Doff)"
  },
  {
    "name": "Leather Armor",
    "category": "Light Armor (1 Minute to Don or Doff)"
  },
  {
    "name": "Studded Leather Armor",
    "category": "Light Armor (1 Minute to Don or Doff)"
  },
  {
    "name": "Hide Armor",
    "category": "Medium Armor (5 Minutes to Don and 1 Minute to Doff)"
  },
  {
    "name": "Chain Shirt",
    "category": "Medium Armor (5 Minutes to Don and 1 Minute to Doff)"
  },
  {
    "name": "Scale Mail",
    "category": "Medium Armor (5 Minutes to Don and 1 Minute to Doff)"
  },
  {
    "name": "Breastplate",
    "category": "Medium Armor (5 Minutes to Don and 1 Minute to Doff)"
  },
  {
    "name": "Half Plate Armor",
    "category": "Medium Armor (5 Minutes to Don and 1 Minute to Doff)"
  },
  {
    "name": "Ring Mail",
    "category": "Heavy Armor (10 Minutes to Don and 5 Minutes to Doff)"
  },
  {
    "name": "Chain Mail",
    "category": "Heavy Armor (10 Minutes to Don and 5 Minutes to Doff)"
  },
  {
    "name": "Splint Armor",
    "category": "Heavy Armor (10 Minutes to Don and 5 Minutes to Doff)"
  },
  {
    "name": "Plate Armor",
    "category": "Heavy Armor (10 Minutes to Don and 5 Minutes to Doff)"
  },
  {
    "name": "Shield",
    "category": "Shield (Utilize Action to Don or Doff)"
  },
  {
    "name": "Arrows",
    "category": "Ammunition",
    "sourceHeading": "Ammunition"
  },
  {
    "name": "Bolts",
    "category": "Ammunition",
    "sourceHeading": "Ammunition"
  },
  {
    "name": "Bullets, Firearm",
    "category": "Ammunition",
    "sourceHeading": "Ammunition"
  },
  {
    "name": "Bullets, Sling",
    "category": "Ammunition",
    "sourceHeading": "Ammunition"
  },
  {
    "name": "Needles",
    "category": "Ammunition",
    "sourceHeading": "Ammunition"
  },
  {
    "name": "Acid",
    "category": "Adventuring Gear",
    "sourceHeading": "Acid (25 GP)"
  },
  {
    "name": "Alchemist's Fire",
    "category": "Adventuring Gear",
    "sourceHeading": "Alchemist's Fire (50 GP)"
  },
  {
    "name": "Ammunition",
    "category": "Adventuring Gear",
    "sourceHeading": "Ammunition (Varies)"
  },
  {
    "name": "Antitoxin",
    "category": "Adventuring Gear",
    "sourceHeading": "Antitoxin (50 GP)"
  },
  {
    "name": "Arcane Focus",
    "category": "Adventuring Gear",
    "sourceHeading": "Arcane Focus (Varies)"
  },
  {
    "name": "Backpack",
    "category": "Adventuring Gear",
    "sourceHeading": "Backpack (2 GP)"
  },
  {
    "name": "Ball Bearings",
    "category": "Adventuring Gear",
    "sourceHeading": "Ball Bearings (1 GP)"
  },
  {
    "name": "Barrel",
    "category": "Adventuring Gear",
    "sourceHeading": "Barrel (2 GP)"
  },
  {
    "name": "Basket",
    "category": "Adventuring Gear",
    "sourceHeading": "Basket (4 SP)"
  },
  {
    "name": "Bedroll",
    "category": "Adventuring Gear",
    "sourceHeading": "Bedroll (1 GP)"
  },
  {
    "name": "Bell",
    "category": "Adventuring Gear",
    "sourceHeading": "Bell (1 GP)"
  },
  {
    "name": "Blanket",
    "category": "Adventuring Gear",
    "sourceHeading": "Blanket (5 SP)"
  },
  {
    "name": "Block and Tackle",
    "category": "Adventuring Gear",
    "sourceHeading": "Block and Tackle (1 GP)"
  },
  {
    "name": "Book",
    "category": "Adventuring Gear",
    "sourceHeading": "Book (25 GP)"
  },
  {
    "name": "Bottle, Glass",
    "category": "Adventuring Gear",
    "sourceHeading": "Bottle, Glass (2 GP)"
  },
  {
    "name": "Bucket",
    "category": "Adventuring Gear",
    "sourceHeading": "Bucket (5 CP)"
  },
  {
    "name": "Burglar's Pack",
    "category": "Adventuring Gear",
    "sourceHeading": "Burglar's Pack (16 GP)"
  },
  {
    "name": "Caltrops",
    "category": "Adventuring Gear",
    "sourceHeading": "Caltrops (1 GP)"
  },
  {
    "name": "Candle",
    "category": "Adventuring Gear",
    "sourceHeading": "Candle (1 CP)"
  },
  {
    "name": "Case, Crossbow Bolt",
    "category": "Adventuring Gear",
    "sourceHeading": "Case, Crossbow Bolt (1 GP)"
  },
  {
    "name": "Case, Map or Scroll",
    "category": "Adventuring Gear",
    "sourceHeading": "Case, Map or Scroll (1 GP)"
  },
  {
    "name": "Chain",
    "category": "Adventuring Gear",
    "sourceHeading": "Chain (5 GP)"
  },
  {
    "name": "Chest",
    "category": "Adventuring Gear",
    "sourceHeading": "Chest (5 GP)"
  },
  {
    "name": "Climber's Kit",
    "category": "Adventuring Gear",
    "sourceHeading": "Climber's Kit (25 GP)"
  },
  {
    "name": "Clothes, Fine",
    "category": "Adventuring Gear",
    "sourceHeading": "Clothes, Fine (15 GP)"
  },
  {
    "name": "Clothes, Traveler's",
    "category": "Adventuring Gear",
    "sourceHeading": "Clothes, Traveler's (2 GP)"
  },
  {
    "name": "Component Pouch",
    "category": "Adventuring Gear",
    "sourceHeading": "Component Pouch (25 GP)"
  },
  {
    "name": "Costume",
    "category": "Adventuring Gear",
    "sourceHeading": "Costume (5 GP)"
  },
  {
    "name": "Crowbar",
    "category": "Adventuring Gear",
    "sourceHeading": "Crowbar (2 GP)"
  },
  {
    "name": "Diplomat's Pack",
    "category": "Adventuring Gear",
    "sourceHeading": "Diplomat's Pack (39 GP)"
  },
  {
    "name": "Druidic Focus",
    "category": "Adventuring Gear",
    "sourceHeading": "Druidic Focus (Varies)"
  },
  {
    "name": "Dungeoneer's Pack",
    "category": "Adventuring Gear",
    "sourceHeading": "Dungeoneer's Pack (12 GP)"
  },
  {
    "name": "Entertainer's Pack",
    "category": "Adventuring Gear",
    "sourceHeading": "Entertainer's Pack (40 GP)"
  },
  {
    "name": "Explorer's Pack",
    "category": "Adventuring Gear",
    "sourceHeading": "Explorer's Pack (10 GP)"
  },
  {
    "name": "Flask",
    "category": "Adventuring Gear",
    "sourceHeading": "Flask (2 CP)"
  },
  {
    "name": "Grappling Hook",
    "category": "Adventuring Gear",
    "sourceHeading": "Grappling Hook (2 GP)"
  },
  {
    "name": "Healer's Kit",
    "category": "Adventuring Gear",
    "sourceHeading": "Healer's Kit (5 GP)"
  },
  {
    "name": "Holy Symbol",
    "category": "Adventuring Gear",
    "sourceHeading": "Holy Symbol (Varies)"
  },
  {
    "name": "Holy Water",
    "category": "Adventuring Gear",
    "sourceHeading": "Holy Water (25 GP)"
  },
  {
    "name": "Hunting Trap",
    "category": "Adventuring Gear",
    "sourceHeading": "Hunting Trap (5 GP)"
  },
  {
    "name": "Ink",
    "category": "Adventuring Gear",
    "sourceHeading": "Ink (10 GP)"
  },
  {
    "name": "Ink Pen",
    "category": "Adventuring Gear",
    "sourceHeading": "Ink Pen (2 CP)"
  },
  {
    "name": "Jug",
    "category": "Adventuring Gear",
    "sourceHeading": "Jug (2 CP)"
  },
  {
    "name": "Ladder",
    "category": "Adventuring Gear",
    "sourceHeading": "Ladder (1 SP)"
  },
  {
    "name": "Lamp",
    "category": "Adventuring Gear",
    "sourceHeading": "Lamp (5 SP)"
  },
  {
    "name": "Lantern, Bullseye",
    "category": "Adventuring Gear",
    "sourceHeading": "Lantern, Bullseye (10 GP)"
  },
  {
    "name": "Lantern, Hooded",
    "category": "Adventuring Gear",
    "sourceHeading": "Lantern, Hooded (5 GP)"
  },
  {
    "name": "Lock",
    "category": "Adventuring Gear",
    "sourceHeading": "Lock (10 GP)"
  },
  {
    "name": "Magnifying Glass",
    "category": "Adventuring Gear",
    "sourceHeading": "Magnifying Glass (100 GP)"
  },
  {
    "name": "Manacles",
    "category": "Adventuring Gear",
    "sourceHeading": "Manacles (2 GP)"
  },
  {
    "name": "Map",
    "category": "Adventuring Gear",
    "sourceHeading": "Map (1 GP)"
  },
  {
    "name": "Mirror",
    "category": "Adventuring Gear",
    "sourceHeading": "Mirror (5 GP)"
  },
  {
    "name": "Net",
    "category": "Adventuring Gear",
    "sourceHeading": "Net (1 GP)"
  },
  {
    "name": "Oil",
    "category": "Adventuring Gear",
    "sourceHeading": "Oil (1 SP)"
  },
  {
    "name": "Paper",
    "category": "Adventuring Gear",
    "sourceHeading": "Paper (2 SP)"
  },
  {
    "name": "Parchment",
    "category": "Adventuring Gear",
    "sourceHeading": "Parchment (1 SP)"
  },
  {
    "name": "Perfume",
    "category": "Adventuring Gear",
    "sourceHeading": "Perfume (5 GP)"
  },
  {
    "name": "Poison, Basic",
    "category": "Adventuring Gear",
    "sourceHeading": "Poison, Basic (100 GP)"
  },
  {
    "name": "Pole",
    "category": "Adventuring Gear",
    "sourceHeading": "Pole (5 CP)"
  },
  {
    "name": "Pot, Iron",
    "category": "Adventuring Gear",
    "sourceHeading": "Pot, Iron (2 GP)"
  },
  {
    "name": "Potion of Healing",
    "category": "Adventuring Gear",
    "sourceHeading": "Potion of Healing (50 GP)"
  },
  {
    "name": "Pouch",
    "category": "Adventuring Gear",
    "sourceHeading": "Pouch (5 SP)"
  },
  {
    "name": "Priest's Pack",
    "category": "Adventuring Gear",
    "sourceHeading": "Priest's Pack (33 GP)"
  },
  {
    "name": "Quiver",
    "category": "Adventuring Gear",
    "sourceHeading": "Quiver (1 GP)"
  },
  {
    "name": "Ram, Portable",
    "category": "Adventuring Gear",
    "sourceHeading": "Ram, Portable (4 GP)"
  },
  {
    "name": "Rations",
    "category": "Adventuring Gear",
    "sourceHeading": "Rations (5 SP)"
  },
  {
    "name": "Robe",
    "category": "Adventuring Gear",
    "sourceHeading": "Robe (1 GP)"
  },
  {
    "name": "Rope",
    "category": "Adventuring Gear",
    "sourceHeading": "Rope (1 GP)"
  },
  {
    "name": "Sack",
    "category": "Adventuring Gear",
    "sourceHeading": "Sack (1 CP)"
  },
  {
    "name": "Scholar's Pack",
    "category": "Adventuring Gear",
    "sourceHeading": "Scholar's Pack (40 GP)"
  },
  {
    "name": "Shovel",
    "category": "Adventuring Gear",
    "sourceHeading": "Shovel (2 GP)"
  },
  {
    "name": "Signal Whistle",
    "category": "Adventuring Gear",
    "sourceHeading": "Signal Whistle (5 CP)"
  },
  {
    "name": "Spell Scroll",
    "category": "Adventuring Gear",
    "sourceHeading": "Spell Scroll (Cantrip, 30 GP; Level 1, 50 GP)"
  },
  {
    "name": "Spikes, Iron",
    "category": "Adventuring Gear",
    "sourceHeading": "Spikes, Iron (1 GP)"
  },
  {
    "name": "Spyglass",
    "category": "Adventuring Gear",
    "sourceHeading": "Spyglass (1,000 GP)"
  },
  {
    "name": "String",
    "category": "Adventuring Gear",
    "sourceHeading": "String (1 SP)"
  },
  {
    "name": "Tent",
    "category": "Adventuring Gear",
    "sourceHeading": "Tent (2 GP)"
  },
  {
    "name": "Tinderbox",
    "category": "Adventuring Gear",
    "sourceHeading": "Tinderbox (5 SP)"
  },
  {
    "name": "Torch",
    "category": "Adventuring Gear",
    "sourceHeading": "Torch (1 CP)"
  },
  {
    "name": "Vial",
    "category": "Adventuring Gear",
    "sourceHeading": "Vial (1 GP)"
  },
  {
    "name": "Waterskin",
    "category": "Adventuring Gear",
    "sourceHeading": "Waterskin (2 SP)"
  },
  {
    "name": "Arcane Focus (Focus)",
    "category": "Arcane Focus",
    "sourceHeading": "Arcane Focuses",
    "variant": "Focus"
  },
  {
    "name": "Arcane Focus (Crystal)",
    "category": "Arcane Focus",
    "sourceHeading": "Arcane Focuses",
    "variant": "Crystal"
  },
  {
    "name": "Arcane Focus (Orb)",
    "category": "Arcane Focus",
    "sourceHeading": "Arcane Focuses",
    "variant": "Orb"
  },
  {
    "name": "Arcane Focus (Rod)",
    "category": "Arcane Focus",
    "sourceHeading": "Arcane Focuses",
    "variant": "Rod"
  },
  {
    "name": "Arcane Focus (Staff)",
    "category": "Arcane Focus",
    "sourceHeading": "Arcane Focuses",
    "variant": "Staff"
  },
  {
    "name": "Arcane Focus (Wand)",
    "category": "Arcane Focus",
    "sourceHeading": "Arcane Focuses",
    "variant": "Wand"
  },
  {
    "name": "Druidic Focus (Focus)",
    "category": "Druidic Focus",
    "sourceHeading": "Druidic Focuses",
    "variant": "Focus"
  },
  {
    "name": "Druidic Focus (Sprig Of Mistletoe)",
    "category": "Druidic Focus",
    "sourceHeading": "Druidic Focuses",
    "variant": "Sprig of mistletoe"
  },
  {
    "name": "Druidic Focus (Wooden Staff)",
    "category": "Druidic Focus",
    "sourceHeading": "Druidic Focuses",
    "variant": "Wooden staff"
  },
  {
    "name": "Druidic Focus (Yew Wand)",
    "category": "Druidic Focus",
    "sourceHeading": "Druidic Focuses",
    "variant": "Yew wand"
  },
  {
    "name": "Holy Symbol (Symbol)",
    "category": "Holy Symbol",
    "sourceHeading": "Holy Symbols",
    "variant": "Symbol"
  },
  {
    "name": "Holy Symbol (Amulet (Worn Or Held))",
    "category": "Holy Symbol",
    "sourceHeading": "Holy Symbols",
    "variant": "Amulet (worn or held)"
  },
  {
    "name": "Holy Symbol (Emblem (Borne On Fabric Or A Shield))",
    "category": "Holy Symbol",
    "sourceHeading": "Holy Symbols",
    "variant": "Emblem (borne on fabric or a Shield)"
  },
  {
    "name": "Holy Symbol (Reliquary (Held))",
    "category": "Holy Symbol",
    "sourceHeading": "Holy Symbols",
    "variant": "Reliquary (held)"
  },
  {
    "name": "Camel",
    "category": "Mounts and Other Animals",
    "sourceHeading": "Mounts and Other Animals"
  },
  {
    "name": "Elephant",
    "category": "Mounts and Other Animals",
    "sourceHeading": "Mounts and Other Animals"
  },
  {
    "name": "Horse, Draft",
    "category": "Mounts and Other Animals",
    "sourceHeading": "Mounts and Other Animals"
  },
  {
    "name": "Horse, Riding",
    "category": "Mounts and Other Animals",
    "sourceHeading": "Mounts and Other Animals"
  },
  {
    "name": "Mastiff",
    "category": "Mounts and Other Animals",
    "sourceHeading": "Mounts and Other Animals"
  },
  {
    "name": "Mule",
    "category": "Mounts and Other Animals",
    "sourceHeading": "Mounts and Other Animals"
  },
  {
    "name": "Pony",
    "category": "Mounts and Other Animals",
    "sourceHeading": "Mounts and Other Animals"
  },
  {
    "name": "Warhorse",
    "category": "Mounts and Other Animals",
    "sourceHeading": "Mounts and Other Animals"
  },
  {
    "name": "Barding",
    "category": "Barding",
    "sourceHeading": "Barding"
  },
  {
    "name": "Saddle",
    "category": "Saddles",
    "sourceHeading": "Saddles"
  },
  {
    "name": "Saddle (Exotic)",
    "category": "Saddles",
    "sourceHeading": "Saddles",
    "variant": "Exotic"
  },
  {
    "name": "Saddle (Military)",
    "category": "Saddles",
    "sourceHeading": "Saddles",
    "variant": "Military"
  },
  {
    "name": "Saddle (Riding)",
    "category": "Saddles",
    "sourceHeading": "Saddles",
    "variant": "Riding"
  },
  {
    "name": "Carriage",
    "category": "Tack, Harness, and Drawn Vehicles",
    "sourceHeading": "Tack, Harness, and Drawn Vehicles"
  },
  {
    "name": "Cart",
    "category": "Tack, Harness, and Drawn Vehicles",
    "sourceHeading": "Tack, Harness, and Drawn Vehicles"
  },
  {
    "name": "Chariot",
    "category": "Tack, Harness, and Drawn Vehicles",
    "sourceHeading": "Tack, Harness, and Drawn Vehicles"
  },
  {
    "name": "Sled",
    "category": "Tack, Harness, and Drawn Vehicles",
    "sourceHeading": "Tack, Harness, and Drawn Vehicles"
  },
  {
    "name": "Wagon",
    "category": "Tack, Harness, and Drawn Vehicles",
    "sourceHeading": "Tack, Harness, and Drawn Vehicles"
  },
  {
    "name": "Airship",
    "category": "Large Vehicles",
    "sourceHeading": "Airborne and Waterborne Vehicles"
  },
  {
    "name": "Galley",
    "category": "Large Vehicles",
    "sourceHeading": "Airborne and Waterborne Vehicles"
  },
  {
    "name": "Keelboat",
    "category": "Large Vehicles",
    "sourceHeading": "Airborne and Waterborne Vehicles"
  },
  {
    "name": "Longship",
    "category": "Large Vehicles",
    "sourceHeading": "Airborne and Waterborne Vehicles"
  },
  {
    "name": "Rowboat",
    "category": "Large Vehicles",
    "sourceHeading": "Airborne and Waterborne Vehicles"
  },
  {
    "name": "Sailing Ship",
    "category": "Large Vehicles",
    "sourceHeading": "Airborne and Waterborne Vehicles"
  },
  {
    "name": "Warship",
    "category": "Large Vehicles",
    "sourceHeading": "Airborne and Waterborne Vehicles"
  }
] as const;
export const DND_EQUIPMENT: string[] = DND_EQUIPMENT_METADATA.map(({ name }) => name);

export const DND_TOOL_METADATA = [
  {
    "name": "Alchemist's Supplies",
    "category": "Artisan's Tools"
  },
  {
    "name": "Brewer's Supplies",
    "category": "Artisan's Tools"
  },
  {
    "name": "Calligrapher's Supplies",
    "category": "Artisan's Tools"
  },
  {
    "name": "Carpenter's Tools",
    "category": "Artisan's Tools"
  },
  {
    "name": "Cartographer's Tools",
    "category": "Artisan's Tools"
  },
  {
    "name": "Cobbler's Tools",
    "category": "Artisan's Tools"
  },
  {
    "name": "Cook's Utensils",
    "category": "Artisan's Tools"
  },
  {
    "name": "Glassblower's Tools",
    "category": "Artisan's Tools"
  },
  {
    "name": "Jeweler's Tools",
    "category": "Artisan's Tools"
  },
  {
    "name": "Leatherworker's Tools",
    "category": "Artisan's Tools"
  },
  {
    "name": "Mason's Tools",
    "category": "Artisan's Tools"
  },
  {
    "name": "Painter's Supplies",
    "category": "Artisan's Tools"
  },
  {
    "name": "Potter's Tools",
    "category": "Artisan's Tools"
  },
  {
    "name": "Smith's Tools",
    "category": "Artisan's Tools"
  },
  {
    "name": "Tinker's Tools",
    "category": "Artisan's Tools"
  },
  {
    "name": "Weaver's Tools",
    "category": "Artisan's Tools"
  },
  {
    "name": "Woodcarver's Tools",
    "category": "Artisan's Tools"
  },
  {
    "name": "Disguise Kit",
    "category": "Other Tools"
  },
  {
    "name": "Forgery Kit",
    "category": "Other Tools"
  },
  {
    "name": "Gaming Set",
    "category": "Other Tools"
  },
  {
    "name": "Herbalism Kit",
    "category": "Other Tools"
  },
  {
    "name": "Musical Instrument",
    "category": "Other Tools"
  },
  {
    "name": "Navigator's Tools",
    "category": "Other Tools"
  },
  {
    "name": "Poisoner's Kit",
    "category": "Other Tools"
  },
  {
    "name": "Thieves' Tools",
    "category": "Other Tools"
  }
] as const;
export const DND_TOOLS: string[] = DND_TOOL_METADATA.map(({ name }) => name);

export const DND_MAGIC_ITEM_METADATA = [
  {
    "name": "Adamantine Armor",
    "sourceHeading": "Adamantine Armor"
  },
  {
    "name": "Ammunition, +1, +2, or +3",
    "sourceHeading": "Ammunition, +1, +2, or +3"
  },
  {
    "name": "Ammunition of Slaying",
    "sourceHeading": "Ammunition of Slaying"
  },
  {
    "name": "Amulet of Health",
    "sourceHeading": "Amulet of Health"
  },
  {
    "name": "Amulet of Proof against Detection and Location",
    "sourceHeading": "Amulet of Proof against Detection and Location"
  },
  {
    "name": "Amulet of the Planes",
    "sourceHeading": "Amulet of the Planes"
  },
  {
    "name": "Animated Shield",
    "sourceHeading": "Animated Shield"
  },
  {
    "name": "Apparatus of the Crab",
    "sourceHeading": "Apparatus of the Crab"
  },
  {
    "name": "Armor, +1, +2, or +3",
    "sourceHeading": "Armor, +1, +2, or +3"
  },
  {
    "name": "Armor of Invulnerability",
    "sourceHeading": "Armor of Invulnerability"
  },
  {
    "name": "Armor of Resistance",
    "sourceHeading": "Armor of Resistance"
  },
  {
    "name": "Armor of Vulnerability",
    "sourceHeading": "Armor of Vulnerability"
  },
  {
    "name": "Arrow-Catching Shield",
    "sourceHeading": "Arrow-Catching Shield"
  },
  {
    "name": "Bag of Beans",
    "sourceHeading": "Bag of Beans"
  },
  {
    "name": "Bag of Devouring",
    "sourceHeading": "Bag of Devouring"
  },
  {
    "name": "Bag of Holding",
    "sourceHeading": "Bag of Holding"
  },
  {
    "name": "Bag of Tricks",
    "sourceHeading": "Bag of Tricks"
  },
  {
    "name": "Bead of Force",
    "sourceHeading": "Bead of Force"
  },
  {
    "name": "Bead of Nourishment",
    "sourceHeading": "Bead of Nourishment"
  },
  {
    "name": "Belt of Dwarvenkind",
    "sourceHeading": "Belt of Dwarvenkind"
  },
  {
    "name": "Belt of Giant Strength",
    "sourceHeading": "Belt of Giant Strength"
  },
  {
    "name": "Berserker Axe",
    "sourceHeading": "Berserker Axe"
  },
  {
    "name": "Boots of Elvenkind",
    "sourceHeading": "Boots of Elvenkind"
  },
  {
    "name": "Boots of Levitation",
    "sourceHeading": "Boots of Levitation"
  },
  {
    "name": "Boots of Speed",
    "sourceHeading": "Boots of Speed"
  },
  {
    "name": "Boots of Striding and Springing",
    "sourceHeading": "Boots of Striding and Springing"
  },
  {
    "name": "Boots of the Winterlands",
    "sourceHeading": "Boots of the Winterlands"
  },
  {
    "name": "Bowl of Commanding Water Elementals",
    "sourceHeading": "Bowl of Commanding Water Elementals"
  },
  {
    "name": "Bracers of Archery",
    "sourceHeading": "Bracers of Archery"
  },
  {
    "name": "Bracers of Defense",
    "sourceHeading": "Bracers of Defense"
  },
  {
    "name": "Brazier of Commanding Fire Elementals",
    "sourceHeading": "Brazier of Commanding Fire Elementals"
  },
  {
    "name": "Brooch of Shielding",
    "sourceHeading": "Brooch of Shielding"
  },
  {
    "name": "Broom of Flying",
    "sourceHeading": "Broom of Flying"
  },
  {
    "name": "Candle of Invocation",
    "sourceHeading": "Candle of Invocation"
  },
  {
    "name": "Cape of the Mountebank",
    "sourceHeading": "Cape of the Mountebank"
  },
  {
    "name": "Carpet of Flying",
    "sourceHeading": "Carpet of Flying"
  },
  {
    "name": "Censer of Controlling Air Elementals",
    "sourceHeading": "Censer of Controlling Air Elementals"
  },
  {
    "name": "Chime of Opening",
    "sourceHeading": "Chime of Opening"
  },
  {
    "name": "Circlet of Blasting",
    "sourceHeading": "Circlet of Blasting"
  },
  {
    "name": "Cloak of Arachnida",
    "sourceHeading": "Cloak of Arachnida"
  },
  {
    "name": "Cloak of Displacement",
    "sourceHeading": "Cloak of Displacement"
  },
  {
    "name": "Cloak of Elvenkind",
    "sourceHeading": "Cloak of Elvenkind"
  },
  {
    "name": "Cloak of Invisibility",
    "sourceHeading": "Cloak of Invisibility"
  },
  {
    "name": "Cloak of Protection",
    "sourceHeading": "Cloak of Protection"
  },
  {
    "name": "Cloak of the Bat",
    "sourceHeading": "Cloak of the Bat"
  },
  {
    "name": "Cloak of the Manta Ray",
    "sourceHeading": "Cloak of the Manta Ray"
  },
  {
    "name": "Crystal Ball",
    "sourceHeading": "Crystal Ball"
  },
  {
    "name": "Crystal Ball of Mind Reading",
    "sourceHeading": "Crystal Ball of Mind Reading"
  },
  {
    "name": "Crystal Ball of Telepathy",
    "sourceHeading": "Crystal Ball of Telepathy"
  },
  {
    "name": "Crystal Ball of True Seeing",
    "sourceHeading": "Crystal Ball of True Seeing"
  },
  {
    "name": "Cube of Force",
    "sourceHeading": "Cube of Force"
  },
  {
    "name": "Cubic Gate",
    "sourceHeading": "Cubic Gate"
  },
  {
    "name": "Dagger of Venom",
    "sourceHeading": "Dagger of Venom"
  },
  {
    "name": "Dancing Sword",
    "sourceHeading": "Dancing Sword"
  },
  {
    "name": "Decanter of Endless Water",
    "sourceHeading": "Decanter of Endless Water"
  },
  {
    "name": "Deck of Illusions",
    "sourceHeading": "Deck of Illusions"
  },
  {
    "name": "Defender",
    "sourceHeading": "Defender"
  },
  {
    "name": "Demon Armor",
    "sourceHeading": "Demon Armor"
  },
  {
    "name": "Dimensional Shackles",
    "sourceHeading": "Dimensional Shackles"
  },
  {
    "name": "Dragon Orb",
    "sourceHeading": "Dragon Orb"
  },
  {
    "name": "Dragon Scale Mail",
    "sourceHeading": "Dragon Scale Mail"
  },
  {
    "name": "Dragon Slayer",
    "sourceHeading": "Dragon Slayer"
  },
  {
    "name": "Dust of Disappearance",
    "sourceHeading": "Dust of Disappearance"
  },
  {
    "name": "Dust of Dryness",
    "sourceHeading": "Dust of Dryness"
  },
  {
    "name": "Dust of Sneezing and Choking",
    "sourceHeading": "Dust of Sneezing and Choking"
  },
  {
    "name": "Dwarven Plate",
    "sourceHeading": "Dwarven Plate"
  },
  {
    "name": "Dwarven Thrower",
    "sourceHeading": "Dwarven Thrower"
  },
  {
    "name": "Efficient Quiver",
    "sourceHeading": "Efficient Quiver"
  },
  {
    "name": "Efreeti Bottle",
    "sourceHeading": "Efreeti Bottle"
  },
  {
    "name": "Elemental Gem",
    "sourceHeading": "Elemental Gem"
  },
  {
    "name": "Elixir of Health",
    "sourceHeading": "Elixir of Health"
  },
  {
    "name": "Elven Chain",
    "sourceHeading": "Elven Chain"
  },
  {
    "name": "Energy Bow",
    "sourceHeading": "Energy Bow"
  },
  {
    "name": "Eversmoking Bottle",
    "sourceHeading": "Eversmoking Bottle"
  },
  {
    "name": "Eyes of Charming",
    "sourceHeading": "Eyes of Charming"
  },
  {
    "name": "Eyes of Minute Seeing",
    "sourceHeading": "Eyes of Minute Seeing"
  },
  {
    "name": "Eyes of the Eagle",
    "sourceHeading": "Eyes of the Eagle"
  },
  {
    "name": "Feather Token",
    "sourceHeading": "Feather Token"
  },
  {
    "name": "Figurine of Wondrous Power",
    "sourceHeading": "Figurine of Wondrous Power"
  },
  {
    "name": "Giant Fly",
    "sourceHeading": "Giant Fly"
  },
  {
    "name": "Flame Tongue",
    "sourceHeading": "Flame Tongue"
  },
  {
    "name": "Folding Boat",
    "sourceHeading": "Folding Boat"
  },
  {
    "name": "Frost Brand",
    "sourceHeading": "Frost Brand"
  },
  {
    "name": "Gauntlets of Ogre Power",
    "sourceHeading": "Gauntlets of Ogre Power"
  },
  {
    "name": "Gem of Brightness",
    "sourceHeading": "Gem of Brightness"
  },
  {
    "name": "Gem of Seeing",
    "sourceHeading": "Gem of Seeing"
  },
  {
    "name": "Giant Slayer",
    "sourceHeading": "Giant Slayer"
  },
  {
    "name": "Glamoured Studded Leather",
    "sourceHeading": "Glamoured Studded Leather"
  },
  {
    "name": "Gloves of Missile Snaring",
    "sourceHeading": "Gloves of Missile Snaring"
  },
  {
    "name": "Gloves of Swimming and Climbing",
    "sourceHeading": "Gloves of Swimming and Climbing"
  },
  {
    "name": "Gloves of Thievery",
    "sourceHeading": "Gloves of Thievery"
  },
  {
    "name": "Goggles of Night",
    "sourceHeading": "Goggles of Night"
  },
  {
    "name": "Hammer of Thunderbolts",
    "sourceHeading": "Hammer of Thunderbolts"
  },
  {
    "name": "Handy Haversack",
    "sourceHeading": "Handy Haversack"
  },
  {
    "name": "Hat of Disguise",
    "sourceHeading": "Hat of Disguise"
  },
  {
    "name": "Hat of Many Spells",
    "sourceHeading": "Hat of Many Spells"
  },
  {
    "name": "Headband of Intellect",
    "sourceHeading": "Headband of Intellect"
  },
  {
    "name": "Helm of Brilliance",
    "sourceHeading": "Helm of Brilliance"
  },
  {
    "name": "Helm of Comprehending Languages",
    "sourceHeading": "Helm of Comprehending Languages"
  },
  {
    "name": "Helm of Telepathy",
    "sourceHeading": "Helm of Telepathy"
  },
  {
    "name": "Helm of Teleportation",
    "sourceHeading": "Helm of Teleportation"
  },
  {
    "name": "Holy Avenger",
    "sourceHeading": "Holy Avenger"
  },
  {
    "name": "Horn of Blasting",
    "sourceHeading": "Horn of Blasting"
  },
  {
    "name": "Horn of Valhalla",
    "sourceHeading": "Horn of Valhalla"
  },
  {
    "name": "Horseshoes of a Zephyr",
    "sourceHeading": "Horseshoes of a Zephyr"
  },
  {
    "name": "Horseshoes of Speed",
    "sourceHeading": "Horseshoes of Speed"
  },
  {
    "name": "Immovable Rod",
    "sourceHeading": "Immovable Rod"
  },
  {
    "name": "Instant Fortress",
    "sourceHeading": "Instant Fortress"
  },
  {
    "name": "Ioun Stone",
    "sourceHeading": "Ioun Stone"
  },
  {
    "name": "Iron Bands",
    "sourceHeading": "Iron Bands"
  },
  {
    "name": "Iron Flask",
    "sourceHeading": "Iron Flask"
  },
  {
    "name": "Javelin of Lightning",
    "sourceHeading": "Javelin of Lightning"
  },
  {
    "name": "Lantern of Revealing",
    "sourceHeading": "Lantern of Revealing"
  },
  {
    "name": "Luck Blade",
    "sourceHeading": "Luck Blade"
  },
  {
    "name": "Mace of Disruption",
    "sourceHeading": "Mace of Disruption"
  },
  {
    "name": "Mace of Smiting",
    "sourceHeading": "Mace of Smiting"
  },
  {
    "name": "Mace of Terror",
    "sourceHeading": "Mace of Terror"
  },
  {
    "name": "Mantle of Spell Resistance",
    "sourceHeading": "Mantle of Spell Resistance"
  },
  {
    "name": "Manual of Bodily Health",
    "sourceHeading": "Manual of Bodily Health"
  },
  {
    "name": "Manual of Gainful Exercise",
    "sourceHeading": "Manual of Gainful Exercise"
  },
  {
    "name": "Manual of Golems",
    "sourceHeading": "Manual of Golems"
  },
  {
    "name": "Manual of Quickness of Action",
    "sourceHeading": "Manual of Quickness of Action"
  },
  {
    "name": "Marvelous Pigments",
    "sourceHeading": "Marvelous Pigments"
  },
  {
    "name": "Medallion of Thoughts",
    "sourceHeading": "Medallion of Thoughts"
  },
  {
    "name": "Mirror of Life Trapping",
    "sourceHeading": "Mirror of Life Trapping"
  },
  {
    "name": "Mithral Armor",
    "sourceHeading": "Mithral Armor"
  },
  {
    "name": "Mysterious Deck",
    "sourceHeading": "Mysterious Deck"
  },
  {
    "name": "Necklace of Adaptation",
    "sourceHeading": "Necklace of Adaptation"
  },
  {
    "name": "Necklace of Fireballs",
    "sourceHeading": "Necklace of Fireballs"
  },
  {
    "name": "Necklace of Prayer Beads",
    "sourceHeading": "Necklace of Prayer Beads"
  },
  {
    "name": "Nine Lives Stealer",
    "sourceHeading": "Nine Lives Stealer"
  },
  {
    "name": "Oathbow",
    "sourceHeading": "Oathbow"
  },
  {
    "name": "Oil of Etherealness",
    "sourceHeading": "Oil of Etherealness"
  },
  {
    "name": "Oil of Sharpness",
    "sourceHeading": "Oil of Sharpness"
  },
  {
    "name": "Oil of Slipperiness",
    "sourceHeading": "Oil of Slipperiness"
  },
  {
    "name": "Pearl of Power",
    "sourceHeading": "Pearl of Power"
  },
  {
    "name": "Periapt of Health",
    "sourceHeading": "Periapt of Health"
  },
  {
    "name": "Periapt of Proof against Poison",
    "sourceHeading": "Periapt of Proof against Poison"
  },
  {
    "name": "Periapt of Wound Closure",
    "sourceHeading": "Periapt of Wound Closure"
  },
  {
    "name": "Philter of Love",
    "sourceHeading": "Philter of Love"
  },
  {
    "name": "Pipes of Haunting",
    "sourceHeading": "Pipes of Haunting"
  },
  {
    "name": "Pipes of the Sewers",
    "sourceHeading": "Pipes of the Sewers"
  },
  {
    "name": "Plate Armor of Etherealness",
    "sourceHeading": "Plate Armor of Etherealness"
  },
  {
    "name": "Portable Hole",
    "sourceHeading": "Portable Hole"
  },
  {
    "name": "Potion of Animal Friendship",
    "sourceHeading": "Potion of Animal Friendship"
  },
  {
    "name": "Potion of Clairvoyance",
    "sourceHeading": "Potion of Clairvoyance"
  },
  {
    "name": "Potion of Climbing",
    "sourceHeading": "Potion of Climbing"
  },
  {
    "name": "Potion of Diminution",
    "sourceHeading": "Potion of Diminution"
  },
  {
    "name": "Potion of Flying",
    "sourceHeading": "Potion of Flying"
  },
  {
    "name": "Potion of Gaseous Form",
    "sourceHeading": "Potion of Gaseous Form"
  },
  {
    "name": "Potion of Giant Strength",
    "sourceHeading": "Potion of Giant Strength"
  },
  {
    "name": "Potion of Growth",
    "sourceHeading": "Potion of Growth"
  },
  {
    "name": "Potions of Healing",
    "sourceHeading": "Potions of Healing"
  },
  {
    "name": "Potion of Heroism",
    "sourceHeading": "Potion of Heroism"
  },
  {
    "name": "Potion of Invisibility",
    "sourceHeading": "Potion of Invisibility"
  },
  {
    "name": "Potion of Invulnerability",
    "sourceHeading": "Potion of Invulnerability"
  },
  {
    "name": "Potion of Longevity",
    "sourceHeading": "Potion of Longevity"
  },
  {
    "name": "Potion of Mind Reading",
    "sourceHeading": "Potion of Mind Reading"
  },
  {
    "name": "Potion of Poison",
    "sourceHeading": "Potion of Poison"
  },
  {
    "name": "Potion of Resistance",
    "sourceHeading": "Potion of Resistance"
  },
  {
    "name": "Potion of Speed",
    "sourceHeading": "Potion of Speed"
  },
  {
    "name": "Potion of Vitality",
    "sourceHeading": "Potion of Vitality"
  },
  {
    "name": "Potion of Water Breathing",
    "sourceHeading": "Potion of Water Breathing"
  },
  {
    "name": "Quarterstaff of the Acrobat",
    "sourceHeading": "Quarterstaff of the Acrobat"
  },
  {
    "name": "Ring of Animal Influence",
    "sourceHeading": "Ring of Animal Influence"
  },
  {
    "name": "Ring of Djinni Summoning",
    "sourceHeading": "Ring of Djinni Summoning"
  },
  {
    "name": "Ring of Elemental Command",
    "sourceHeading": "Ring of Elemental Command"
  },
  {
    "name": "Ring of Evasion",
    "sourceHeading": "Ring of Evasion"
  },
  {
    "name": "Ring of Feather Falling",
    "sourceHeading": "Ring of Feather Falling"
  },
  {
    "name": "Ring of Free Action",
    "sourceHeading": "Ring of Free Action"
  },
  {
    "name": "Ring of Invisibility",
    "sourceHeading": "Ring of Invisibility"
  },
  {
    "name": "Ring of Jumping",
    "sourceHeading": "Ring of Jumping"
  },
  {
    "name": "Ring of Mind Shielding",
    "sourceHeading": "Ring of Mind Shielding"
  },
  {
    "name": "Ring of Protection",
    "sourceHeading": "Ring of Protection"
  },
  {
    "name": "Ring of Regeneration",
    "sourceHeading": "Ring of Regeneration"
  },
  {
    "name": "Ring of Resistance",
    "sourceHeading": "Ring of Resistance"
  },
  {
    "name": "Ring of Shooting Stars",
    "sourceHeading": "Ring of Shooting Stars"
  },
  {
    "name": "Ring of Spell Storing",
    "sourceHeading": "Ring of Spell Storing"
  },
  {
    "name": "Ring of Spell Turning",
    "sourceHeading": "Ring of Spell Turning"
  },
  {
    "name": "Ring of Swimming",
    "sourceHeading": "Ring of Swimming"
  },
  {
    "name": "Ring of Telekinesis",
    "sourceHeading": "Ring of Telekinesis"
  },
  {
    "name": "Ring of the Ram",
    "sourceHeading": "Ring of the Ram"
  },
  {
    "name": "Ring of Three Wishes",
    "sourceHeading": "Ring of Three Wishes"
  },
  {
    "name": "Ring of Warmth",
    "sourceHeading": "Ring of Warmth"
  },
  {
    "name": "Ring of Water Walking",
    "sourceHeading": "Ring of Water Walking"
  },
  {
    "name": "Ring of X-ray Vision",
    "sourceHeading": "Ring of X-ray Vision"
  },
  {
    "name": "Robe of Eyes",
    "sourceHeading": "Robe of Eyes"
  },
  {
    "name": "Robe of Scintillating Colors",
    "sourceHeading": "Robe of Scintillating Colors"
  },
  {
    "name": "Robe of Stars",
    "sourceHeading": "Robe of Stars"
  },
  {
    "name": "Robe of the Archmagi",
    "sourceHeading": "Robe of the Archmagi"
  },
  {
    "name": "Robe of Useful Items",
    "sourceHeading": "Robe of Useful Items"
  },
  {
    "name": "Rod of Absorption",
    "sourceHeading": "Rod of Absorption"
  },
  {
    "name": "Rod of Alertness",
    "sourceHeading": "Rod of Alertness"
  },
  {
    "name": "Rod of Lordly Might",
    "sourceHeading": "Rod of Lordly Might"
  },
  {
    "name": "Rod of Resurrection",
    "sourceHeading": "Rod of Resurrection"
  },
  {
    "name": "Rod of Rulership",
    "sourceHeading": "Rod of Rulership"
  },
  {
    "name": "Rod of Security",
    "sourceHeading": "Rod of Security"
  },
  {
    "name": "Rope of Climbing",
    "sourceHeading": "Rope of Climbing"
  },
  {
    "name": "Rope of Entanglement",
    "sourceHeading": "Rope of Entanglement"
  },
  {
    "name": "Scarab of Protection",
    "sourceHeading": "Scarab of Protection"
  },
  {
    "name": "Scimitar of Speed",
    "sourceHeading": "Scimitar of Speed"
  },
  {
    "name": "Sending Stones",
    "sourceHeading": "Sending Stones"
  },
  {
    "name": "Sentinel Shield",
    "sourceHeading": "Sentinel Shield"
  },
  {
    "name": "Shield, +1, +2, or +3",
    "sourceHeading": "Shield, +1, +2, or +3"
  },
  {
    "name": "Shield of Missile Attraction",
    "sourceHeading": "Shield of Missile Attraction"
  },
  {
    "name": "Shield of the Cavalier",
    "sourceHeading": "Shield of the Cavalier"
  },
  {
    "name": "Slippers of Spider Climbing",
    "sourceHeading": "Slippers of Spider Climbing"
  },
  {
    "name": "Sovereign Glue",
    "sourceHeading": "Sovereign Glue"
  },
  {
    "name": "Spellguard Shield",
    "sourceHeading": "Spellguard Shield"
  },
  {
    "name": "Spell Scroll",
    "sourceHeading": "Spell Scroll"
  },
  {
    "name": "Sphere of Annihilation",
    "sourceHeading": "Sphere of Annihilation"
  },
  {
    "name": "Staff of Charming",
    "sourceHeading": "Staff of Charming"
  },
  {
    "name": "Staff of Fire",
    "sourceHeading": "Staff of Fire"
  },
  {
    "name": "Staff of Frost",
    "sourceHeading": "Staff of Frost"
  },
  {
    "name": "Staff of Healing",
    "sourceHeading": "Staff of Healing"
  },
  {
    "name": "Staff of Power",
    "sourceHeading": "Staff of Power"
  },
  {
    "name": "Staff of Striking",
    "sourceHeading": "Staff of Striking"
  },
  {
    "name": "Staff of Swarming Insects",
    "sourceHeading": "Staff of Swarming Insects"
  },
  {
    "name": "Staff of the Magi",
    "sourceHeading": "Staff of the Magi"
  },
  {
    "name": "Staff of the Python",
    "sourceHeading": "Staff of the Python"
  },
  {
    "name": "Staff of the Woodlands",
    "sourceHeading": "Staff of the Woodlands"
  },
  {
    "name": "Staff of Thunder and Lightning",
    "sourceHeading": "Staff of Thunder and Lightning"
  },
  {
    "name": "Staff of Withering",
    "sourceHeading": "Staff of Withering"
  },
  {
    "name": "Stone of Controlling Earth Elementals",
    "sourceHeading": "Stone of Controlling Earth Elementals"
  },
  {
    "name": "Stone of Good Luck (Luckstone)",
    "sourceHeading": "Stone of Good Luck (Luckstone)"
  },
  {
    "name": "Sun Blade",
    "sourceHeading": "Sun Blade"
  },
  {
    "name": "Sword of Life Stealing",
    "sourceHeading": "Sword of Life Stealing"
  },
  {
    "name": "Sword of Sharpness",
    "sourceHeading": "Sword of Sharpness"
  },
  {
    "name": "Sword of Wounding",
    "sourceHeading": "Sword of Wounding"
  },
  {
    "name": "Talisman of Pure Good",
    "sourceHeading": "Talisman of Pure Good"
  },
  {
    "name": "Talisman of the Sphere",
    "sourceHeading": "Talisman of the Sphere"
  },
  {
    "name": "Talisman of Ultimate Evil",
    "sourceHeading": "Talisman of Ultimate Evil"
  },
  {
    "name": "Thunderous Greatclub",
    "sourceHeading": "Thunderous Greatclub"
  },
  {
    "name": "Tome of Clear Thought",
    "sourceHeading": "Tome of Clear Thought"
  },
  {
    "name": "Tome of Leadership and Influence",
    "sourceHeading": "Tome of Leadership and Influence"
  },
  {
    "name": "Tome of Understanding",
    "sourceHeading": "Tome of Understanding"
  },
  {
    "name": "Trident of Fish Command",
    "sourceHeading": "Trident of Fish Command"
  },
  {
    "name": "Universal Solvent",
    "sourceHeading": "Universal Solvent"
  },
  {
    "name": "Vicious Weapon",
    "sourceHeading": "Vicious Weapon"
  },
  {
    "name": "Vorpal Sword",
    "sourceHeading": "Vorpal Sword"
  },
  {
    "name": "Wand of Binding",
    "sourceHeading": "Wand of Binding"
  },
  {
    "name": "Wand of Enemy Detection",
    "sourceHeading": "Wand of Enemy Detection"
  },
  {
    "name": "Wand of Fear",
    "sourceHeading": "Wand of Fear"
  },
  {
    "name": "Wand of Fireballs",
    "sourceHeading": "Wand of Fireballs"
  },
  {
    "name": "Wand of Lightning Bolts",
    "sourceHeading": "Wand of Lightning Bolts"
  },
  {
    "name": "Wand of Magic Detection",
    "sourceHeading": "Wand of Magic Detection"
  },
  {
    "name": "Wand of Magic Missiles",
    "sourceHeading": "Wand of Magic Missiles"
  },
  {
    "name": "Wand of Paralysis",
    "sourceHeading": "Wand of Paralysis"
  },
  {
    "name": "Wand of Polymorph",
    "sourceHeading": "Wand of Polymorph"
  },
  {
    "name": "Wand of Secrets",
    "sourceHeading": "Wand of Secrets"
  },
  {
    "name": "Wand of the War Mage, +1, +2, or +3",
    "sourceHeading": "Wand of the War Mage, +1, +2, or +3"
  },
  {
    "name": "Wand of Web",
    "sourceHeading": "Wand of Web"
  },
  {
    "name": "Wand of Wonder",
    "sourceHeading": "Wand of Wonder"
  },
  {
    "name": "Weapon, +1, +2, or +3",
    "sourceHeading": "Weapon, +1, +2, or +3"
  },
  {
    "name": "Weapon of Warning",
    "sourceHeading": "Weapon of Warning"
  },
  {
    "name": "Well of Many Worlds",
    "sourceHeading": "Well of Many Worlds"
  },
  {
    "name": "Wind Fan",
    "sourceHeading": "Wind Fan"
  },
  {
    "name": "Winged Boots",
    "sourceHeading": "Winged Boots"
  },
  {
    "name": "Wings of Flying",
    "sourceHeading": "Wings of Flying"
  }
] as const;
export const DND_MAGIC_ITEMS: string[] = DND_MAGIC_ITEM_METADATA.map(({ name }) => name);

export const DND_SPECIES_TRAITS: string[] = [...new Set(DND_SPECIES_METADATA.flatMap(({ traits }) => traits))];

// The supplied SRD extracts do not contain the Character Creation language tables.
// Keep this existing sheet-helper API explicit and separate from the SRD-derived catalog above.
export const DND_LANGUAGES: string[] = [
  "Common",
  "Common Sign Language",
  "Dwarvish",
  "Elvish",
  "Giant",
  "Gnomish",
  "Goblin",
  "Halfling",
  "Orc",
  "Abyssal",
  "Celestial",
  "Draconic",
  "Deep Speech",
  "Infernal",
  "Primordial",
  "Sylvan",
  "Undercommon",
  "Druidic",
  "Thieves' Cant"
];
export const DND_LANGUAGE_METADATA = {
  sourceCoverage: "Compatibility helper retained; language tables are outside the supplied SRD extracts.",
  entries: DND_LANGUAGES,
} as const;

// These are sheet input helpers rather than claims about the supplied SRD catalog.
export const DND_SPELL_RANGES: string[] = [
  "Self",
  "Touch",
  "5 feet",
  "10 feet",
  "30 feet",
  "60 feet",
  "90 feet",
  "100 feet",
  "120 feet",
  "150 feet",
  "300 feet",
  "500 feet",
  "1 mile",
  "Sight",
  "Unlimited",
  "Self (10-foot radius)",
  "Self (15-foot cone)",
  "Self (15-foot cube)",
  "Self (30-foot radius)",
  "Self (60-foot cone)",
  "Self (60-foot line)",
  "Self (100-foot line)"
];
export const DND_DICE: string[] = [
  "d4",
  "d6",
  "d8",
  "d10",
  "d12",
  "d20",
  "d100"
];

export function getSubclasses(className: string | null): string[] {
  if (!className) return [];
  if (DND_SUBCLASSES[className]) return DND_SUBCLASSES[className];
  const key = Object.keys(DND_SUBCLASSES).find(
    (k) => k.toLowerCase() === className.toLowerCase()
  );
  return key ? DND_SUBCLASSES[key] : [];
}

export function getSpellNames(level?: number): string[] {
  if (level === undefined) return DND_SPELLS.map((s) => s.name);
  return DND_SPELLS.filter((s) => s.level === level).map((s) => s.name);
}
