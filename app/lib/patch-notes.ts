export interface PatchNote {
  version: string;
  date: string;
  title: string;
  changes: string[];
}

export const PATCH_NOTES: PatchNote[] = [
  {
    version: "0.2.0",
    date: "2026-02-06",
    title: "Real-Time Sync, Combat & Character Sheets",
    changes: [
      "Skill proficiencies now cycle through three states: None, Proficient, and Expertise (doubles proficiency bonus)",
      "Dice rolls are now broadcast to all connected players instantly via WebSocket",
      "AC, HP, condition, and aura changes sync in real-time to all players",
      "Combat state (initiative order, current turn) now persists across page reloads",
      "DM advancing turns auto-saves and syncs to all connected clients",
      "Drawing and erasing now syncs to all players in real-time",
      "Monster AC and HP are now hidden from players (visible for DM only) — health conditions remain visible",
      "Token AC and HP now only display on hover, no longer on selection",
      "Character metadata on hover now shows over other assets like tokens and drawings",
      "Your own tokens now render above locked tokens, making stacked tokens easier to select",
      "Tokens not under fog now render above the fog layer — no more cloud puffs hiding nearby tokens",
      "Tokens under fog no longer show hover metadata or pointer cursor to players",
      "Import a character from your library when double-clicking a token without a sheet",
      "Save a token's character sheet to your personal library directly from the sheet view",
      "Tokens assigned to a new owner now correctly display the existing character sheet",
      "Equipment: Qty and Charges combined into a single current/max field",
      "Fixed recharge dropdown bleeding into the character sheet header when scrolling",
      "Character sheet text fields now auto-expand on focus to reveal long text, and collapse on blur",
      "Read-only character sheet fields (spell name, range, material, equipment, notes) now click to expand",
    ],
  },
];
