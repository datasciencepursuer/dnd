import { GoogleGenAI } from "@google/genai";
import type {
  CombatState,
  Token,
  GridSettings,
  MonsterGroup,
  DistanceEntry,
  WallSegment,
  AreaShape,
} from "~/features/map-editor/types";
import type { ChatMessageData } from "~/features/map-editor/store/chat-store";
import type { AbilityDescription } from "./enrich-combat-context";
import { FEET_PER_CELL, computeDistanceMatrix } from "~/features/map-editor/utils/distance-utils";
import { describeAllTerrainContext, calculateCover } from "~/features/map-editor/utils/terrain-utils";

export interface CombatContext {
  combat: CombatState;
  tokens: Token[];
  grid: GridSettings;
  monsterGroups: MonsterGroup[];
  recentMessages: ChatMessageData[];
  walls: WallSegment[];
  areas: AreaShape[];
  abilityDescriptions?: Map<string, AbilityDescription[]>;
}

function getHealthDescription(current: number, max: number): string {
  if (max <= 0) return "Unknown";
  const ratio = current / max;
  if (ratio >= 1) return "Healthy";
  if (ratio >= 0.75) return "Lightly wounded";
  if (ratio >= 0.5) return "Wounded";
  if (ratio >= 0.25) return "Badly wounded";
  if (ratio > 0) return "Critical";
  return "Down";
}

/** Strip ": long description..." suffix from feature name, keeping just the name + any prefix */
function shortenFeatureName(name: string): string {
  const colonIdx = name.indexOf(": ");
  if (colonIdx > 0) return name.substring(0, colonIdx);
  return name;
}

export interface SerializedCombatResult {
  text: string;
  /** Maps disambiguated display names (e.g. "Ape #1") back to token IDs */
  displayNameToTokenId: Record<string, string>;
}

export function serializeCombatContext(ctx: CombatContext): SerializedCombatResult {
  const { combat, tokens, grid, monsterGroups, recentMessages, walls, areas, abilityDescriptions } = ctx;
  const lines: string[] = [];

  // Build disambiguated display names for all combatant tokens.
  // Tokens with duplicate names get "#1", "#2" suffixes.
  const displayNameToTokenId: Record<string, string> = {};
  const tokenIdToDisplayName = new Map<string, string>();

  // First pass: collect all individual combatant tokens in initiative order.
  // Skip entries whose tokens no longer exist to prevent ghost combatants.
  const allCombatantTokens: { tokenId: string; token: Token; entry: typeof combat.initiativeOrder[0] }[] = [];
  for (const entry of combat.initiativeOrder) {
    if (entry.groupTokenIds && entry.groupTokenIds.length > 1) {
      for (const tid of entry.groupTokenIds) {
        const t = tokens.find((tok) => tok.id === tid);
        if (t) allCombatantTokens.push({ tokenId: tid, token: t, entry });
      }
    } else {
      const t = tokens.find((tok) => tok.id === entry.tokenId);
      if (t) allCombatantTokens.push({ tokenId: entry.tokenId, token: t, entry });
    }
  }

  // Count occurrences of each base name
  const nameCounts = new Map<string, number>();
  for (const c of allCombatantTokens) {
    const baseName = c.token?.name ?? c.entry.tokenName;
    nameCounts.set(baseName, (nameCounts.get(baseName) ?? 0) + 1);
  }

  // Assign disambiguated names
  const nameCounters = new Map<string, number>();
  for (const c of allCombatantTokens) {
    const baseName = c.token?.name ?? c.entry.tokenName;
    let displayName: string;
    if (nameCounts.get(baseName)! > 1) {
      const idx = (nameCounters.get(baseName) ?? 0) + 1;
      nameCounters.set(baseName, idx);
      displayName = `${baseName} #${idx}`;
    } else {
      displayName = baseName;
    }
    displayNameToTokenId[displayName] = c.tokenId;
    tokenIdToDisplayName.set(c.tokenId, displayName);
  }

  // Combat state header
  const totalEntries = combat.initiativeOrder.length;
  const currentEntry = combat.initiativeOrder[combat.currentTurnIndex];
  const currentDisplayName = currentEntry
    ? (currentEntry.groupTokenIds && currentEntry.groupTokenIds.length > 1
      ? tokenIdToDisplayName.get(currentEntry.groupTokenIds[0]) ?? currentEntry.tokenName
      : tokenIdToDisplayName.get(currentEntry.tokenId) ?? currentEntry.tokenName)
    : "Unknown";
  lines.push("COMBAT STATE:");
  lines.push(
    `Turn ${combat.currentTurnIndex + 1}/${totalEntries} | Current: ${currentEntry?.groupTokenIds && currentEntry.groupTokenIds.length > 1 ? `${currentEntry.tokenName} group` : currentDisplayName} (${currentEntry?.layer ?? "unknown"})`
  );
  lines.push("");

  // Helper to serialize one combatant token's stats
  const serializeCombatant = (
    num: string,
    displayName: string,
    token: Token,
    layer: string,
    initiative: number,
    isCurrent: boolean,
  ) => {
    const marker = isCurrent ? " ← CURRENT" : "";
    const cs = token.characterSheet;
    const ac = cs ? `AC ${cs.ac}` : "AC ?";
    const hp = cs ? `HP ${cs.hpCurrent}/${cs.hpMax}` : "HP ?/?";
    const cellStr = `Cell:(${token.position.col},${token.position.row}) Size:${token.size}`;
    let line = `${num} ${displayName} (${layer}) Init:${initiative} | ${ac} | ${hp} | ${cellStr}${marker}`;

    const condition = cs?.condition;
    if (condition && condition !== "Healthy") {
      line += ` | Condition: ${condition}`;
    }

    lines.push(line);

    // Print combat stats for every combatant so the AI has full context
    if (cs) {
      if (cs.weapons.length > 0) {
        const weaponStrs = cs.weapons.map(
          (w) =>
            `${w.name} (+${w.bonus}, ${w.dice} ${w.damageType}${w.notes ? `, ${w.notes}` : ""})`
        );
        lines.push(`   Weapons: ${weaponStrs.join(", ")}`);
      }

      if (cs.spells.length > 0) {
        const spellStrs = cs.spells.slice(0, 10).map((s) => {
          const levelStr = s.level === 0 ? "cantrip" : `${s.level}${getOrdinalSuffix(s.level)}`;
          return `${s.name} (${levelStr}${s.concentration ? ", conc" : ""})`;
        });
        lines.push(`   Spells: ${spellStrs.join(", ")}`);
      }

      const usableFeatures = cs.classFeatures.filter(
        (f) => f.charges === null || f.charges.current > 0
      );
      if (usableFeatures.length > 0) {
        const featureStrs = usableFeatures.slice(0, 8).map((f) => {
          const shortName = shortenFeatureName(f.name);
          if (f.charges) {
            return `${shortName} (${f.charges.current}/${f.charges.max})`;
          }
          return shortName;
        });
        lines.push(`   Features: ${featureStrs.join(", ")}`);
      }

      const speeds: string[] = [];
      if (cs.speed.walk) speeds.push(`${cs.speed.walk}ft walk`);
      if (cs.speed.fly) speeds.push(`${cs.speed.fly}ft fly`);
      if (cs.speed.swim) speeds.push(`${cs.speed.swim}ft swim`);
      if (cs.speed.burrow) speeds.push(`${cs.speed.burrow}ft burrow`);
      if (cs.speed.climb) speeds.push(`${cs.speed.climb}ft climb`);
      if (speeds.length > 0) {
        lines.push(`   Speed: ${speeds.join(", ")}`);
      }
    }
  };

  // Combatants with stats — expand groups into individual tokens.
  // Only include tokens that actually exist (skip stale initiative entries).
  lines.push("COMBATANTS:");
  let combatantNum = 1;
  for (let i = 0; i < combat.initiativeOrder.length; i++) {
    const entry = combat.initiativeOrder[i];
    const isCurrent = i === combat.currentTurnIndex;
    const layer = entry.layer ?? "unknown";

    if (entry.groupTokenIds && entry.groupTokenIds.length > 1) {
      // Monster group: list each member individually with shared initiative
      const validGroupTokens = entry.groupTokenIds
        .map((tid) => ({ tid, token: tokens.find((tok) => tok.id === tid) }))
        .filter((x): x is { tid: string; token: Token } => x.token != null);
      if (validGroupTokens.length === 0) continue;
      const groupName = entry.tokenName;
      lines.push(`  [Group: ${groupName}, shared initiative ${entry.initiative}]`);
      for (const { tid, token } of validGroupTokens) {
        const dName = tokenIdToDisplayName.get(tid) ?? token.name ?? entry.tokenName;
        serializeCombatant(`${combatantNum}.`, dName, token, layer, entry.initiative, isCurrent);
        combatantNum++;
      }
    } else {
      // Single combatant
      const t = tokens.find((tok) => tok.id === entry.tokenId);
      if (!t) continue;
      const dName = tokenIdToDisplayName.get(entry.tokenId) ?? entry.tokenName;
      serializeCombatant(`${combatantNum}.`, dName, t, layer, entry.initiative, isCurrent);
      combatantNum++;
    }
  }
  lines.push("");

  // Grid info
  lines.push(
    `GRID: ${grid.type}, ${FEET_PER_CELL}ft cells, ${grid.width}x${grid.height}`
  );
  lines.push("");

  // Terrain & environment context
  const terrainBlock = describeAllTerrainContext(tokens, areas, walls);
  if (terrainBlock) {
    lines.push("ENVIRONMENT:");
    lines.push(terrainBlock);
    lines.push("");
  }

  // Pairwise distances between combatants (closest-edge, D&D 5e rule)
  const distances: DistanceEntry[] = combat.distances && combat.distances.length > 0
    ? combat.distances
    : computeDistanceMatrix(combat.initiativeOrder, tokens);

  if (distances.length > 0) {
    lines.push("DISTANCES (D&D 5e grid counting, in feet):");
    for (const d of distances) {
      const nameA = tokenIdToDisplayName.get(d.tokenIdA) ?? d.tokenIdA;
      const nameB = tokenIdToDisplayName.get(d.tokenIdB) ?? d.tokenIdB;
      const display = Number.isInteger(d.feet) ? `${d.feet}ft` : `${d.feet.toFixed(1)}ft`;

      let coverNote = "";
      if (walls.length > 0) {
        const tokenA = tokens.find((t) => t.id === d.tokenIdA);
        const tokenB = tokens.find((t) => t.id === d.tokenIdB);
        if (tokenA && tokenB) {
          const cover = calculateCover(tokenA.position, tokenB.position, walls);
          if (cover === "full") coverNote = " [BLOCKED — wall blocks line of sight, cannot target]";
          else if (cover === "three-quarters") coverNote = " [¾ cover +5 AC/DEX]";
          else if (cover === "half") coverNote = " [½ cover +2 AC/DEX]";
        }
      }

      lines.push(`  ${nameA} ↔ ${nameB}: ${display}${coverNote}`);
    }
    lines.push("");
  }

  // Ability details from SRD data (deduplicated by srdMonsterIndex)
  if (abilityDescriptions && abilityDescriptions.size > 0) {
    lines.push("ABILITY DETAILS:");
    // Group tokens by srdMonsterIndex to deduplicate
    const indexToNames = new Map<string, string[]>();
    for (const c of allCombatantTokens) {
      const idx = c.token?.characterSheet?.srdMonsterIndex;
      if (idx && abilityDescriptions.has(idx)) {
        const names = indexToNames.get(idx) ?? [];
        const dName = tokenIdToDisplayName.get(c.tokenId) ?? c.token?.name ?? c.entry.tokenName;
        if (!names.includes(dName)) names.push(dName);
        indexToNames.set(idx, names);
      }
    }

    // Deduplicate: only print abilities once per srdMonsterIndex
    const printedIndices = new Set<string>();
    for (const [idx, names] of indexToNames) {
      if (printedIndices.has(idx)) continue;
      printedIndices.add(idx);
      const abilities = abilityDescriptions.get(idx);
      if (!abilities || abilities.length === 0) continue;

      const label = names.length > 1 ? `${names[0]} (shared by all ${idx})` : names[0];
      lines.push(`  ${label}:`);
      for (const ability of abilities) {
        const prefix =
          ability.category === "legendary"
            ? "[Legendary] "
            : ability.category === "reaction"
              ? "[Reaction] "
              : "";
        lines.push(`    ${prefix}${ability.name}: ${ability.desc}`);
      }
    }
    lines.push("");
  }

  // Find the last AI response timestamp — rolls before it are already consumed
  let lastAiResponseTime: string | null = null;
  for (let i = recentMessages.length - 1; i >= 0; i--) {
    if (recentMessages[i].metadata?.aiResponse) {
      lastAiResponseTime = recentMessages[i].createdAt;
      break;
    }
  }

  // Extract only UNCONSUMED dice rolls (made after the last AI response)
  const rollMessages = recentMessages.filter(
    (m) => !m.recipientId && m.metadata?.diceRoll &&
      (!lastAiResponseTime || m.createdAt > lastAiResponseTime)
  );
  if (rollMessages.length > 0) {
    lines.push("PENDING DICE ROLLS (use these — do NOT ask the player to re-roll):");
    for (const msg of rollMessages) {
      const dr = msg.metadata!.diceRoll!;
      const mod = dr.modifier > 0 ? `+${dr.modifier}` : dr.modifier < 0 ? `${dr.modifier}` : "";
      const tokenAttr = dr.tokenName ? ` (for ${dr.tokenName})` : "";
      const keepLabel = dr.keep === "h" ? " (advantage, kept highest)" : dr.keep === "l" ? " (disadvantage, kept lowest)" : "";
      lines.push(`  ${msg.userName}: ${msg.message} → rolls:[${dr.rolls.join(",")}]${mod} = ${dr.total}${keepLabel}${tokenAttr}`);
    }
    lines.push("");
  }

  // Recent chat (narrative context)
  const chatMessages = recentMessages.filter((m) => !m.recipientId);
  if (chatMessages.length > 0) {
    lines.push(`RECENT CHAT (last ${chatMessages.length}):`);
    for (const msg of chatMessages) {
      const isIntent = !!msg.metadata?.playerIntent;
      const prefix = isIntent
        ? `[ACTION: ${msg.userName}]`
        : msg.role === "dm" ? "[DM]" : `[Player: ${msg.userName}]`;
      const dr = msg.metadata?.diceRoll;
      if (dr) {
        const mod = dr.modifier > 0 ? `+${dr.modifier}` : dr.modifier < 0 ? `${dr.modifier}` : "";
        const tokenAttr = dr.tokenName ? ` (for ${dr.tokenName})` : "";
        const keepLabel = dr.keep === "h" ? " (advantage, kept highest)" : dr.keep === "l" ? " (disadvantage, kept lowest)" : "";
        lines.push(`${prefix} ${msg.message} → rolls:[${dr.rolls.join(",")}]${mod} = ${dr.total}${keepLabel}${tokenAttr}`);
      } else {
        lines.push(`${prefix} ${msg.message}`);
      }
    }
  }

  return { text: lines.join("\n"), displayNameToTokenId };
}

function getOrdinalSuffix(n: number): string {
  if (n === 1) return "st";
  if (n === 2) return "nd";
  if (n === 3) return "rd";
  return "th";
}

export const COMBAT_DM_SYSTEM_PROMPT = `You are a D&D 5e combat assistant helping the Dungeon Master run encounters.

################################################################
# ABSOLUTE RULE — READ THIS FIRST, OBEY WITHOUT EXCEPTION:
# You CANNOT roll dice for player characters. Not ever. Not for
# attacks, damage, saves, checks — NOTHING. You may only roll
# dice for monsters and NPCs. If a player character needs ANY
# roll and no roll exists in the provided data, tell the player
# what to roll and STOP. Do not generate numbers. Do not simulate
# results. Do not say "rolling for you". STOP and ask them to roll.
# This overrides every other instruction below.
################################################################

Who rolls dice:
- MONSTERS/NPCs: You roll their dice. Show results as "🎲 d20+5 = 14+5 = 19 — hits!" and "🎲 2d6+3 = [4,5]+3 = 12 slashing". NEVER write "vs AC X" — just say "hits!" or "misses!" without revealing the AC threshold
- PLAYER CHARACTERS: You NEVER roll for them. Only use rolls they provide. When resolving: say "hits!" or "misses!" — NEVER reveal what AC they needed to beat

Player turn flow (STRICT — follow this exactly):
1. Player declares their action ([ACTION] tag or DM directs it)
2. If PENDING DICE ROLLS has matching rolls → use them to resolve immediately
3. If PENDING DICE ROLLS is empty → tell the player exactly what to roll and STOP. Do not resolve, do not continue. Example: "Roll d20+5 for your attack, then roll 1d8+3 for damage if it hits!"
4. Player rolls (via dice roller or types result in chat, e.g. "18", "nat 20", "attack 18 damage 7")
5. On the next prompt, their rolls appear in PENDING DICE ROLLS or RECENT CHAT → now resolve
- NEVER suggest, prompt, or ask a player about bonus actions, reactions, or other options they could use. Players know their own abilities. Only resolve what they explicitly declare. Do not say things like "Would you like to use your bonus action to...?" or "You could also..."

Reading rolls:
- PENDING DICE ROLLS: structured rolls — match by token name "(for TokenName)" or player userName
- RECENT CHAT: typed results from physical dice — a player saying "18" or "I got 18" = their roll
- "(advantage, kept highest)" = advantage roll, total already uses the higher die
- Only use rolls from PENDING DICE ROLLS or typed after the last AI response. Never reuse old resolved rolls
- Do NOT decide what a player character does — only resolve declared/directed actions

Monster groups:
- Monsters that share initiative are listed in a [Group:] header, but each is a SEPARATE creature with its own HP, position, condition, and stats (e.g. "Ape #1", "Ape #2")
- Each group member acts independently on the group's turn: they each have their own movement, action, bonus action, and reaction
- Target and track each member individually in UPDATES using its exact name (e.g. "Ape #1", not "Ape" or "Ape x4")

Monster/NPC turns:
- Decide tactics, movement, action, bonus action (if any). Roll their dice, narrate results
- ALWAYS prefix each roll line with the specific monster's name so it's clear who rolled what (e.g. "Ape #1: 🎲 d20+5 = 19 — hits!" not just "🎲 d20+5 = 19 — hits!"). This is critical for groups where multiple same-named monsters act on one turn
- Use ACTUAL stats from the combat context. Never invent stats or abilities
- NEVER mention DC numbers in ANY context — not in attacks, features, breath weapons, spells, grapples, or any other ability. Resolve saves internally and report only "passes!" or "fails!"
- When a monster ability forces a saving throw: tell the player which save to roll (e.g. "Roll a Wisdom saving throw!") and STOP. Once the player rolls, compare their result to the DC internally and say only "passes!" or "fails!" — then apply the effect
- When narrating monster features (e.g. breath weapon, frightful presence, grapple): describe the effect narratively, never say "DC 13" or "make a DC 15 save"

Movement on the grid (monsters/NPCs ONLY):
- Cell coordinates use the top-left corner of the token. Each cell = 5ft
- A token of Size:N occupies cells from (col,row) to (col+N-1, row+N-1)
- Respect creature speed from the Speed line. Walking 30ft = 6 cells max
- Difficult terrain costs double movement (1 cell = 10ft)
- Keep within grid bounds: col 0..GRID_WIDTH-size, row 0..GRID_HEIGHT-size (see GRID line)
- NEVER move a token onto cells occupied by another token. Two tokens overlap if their cell rectangles intersect. Check all Cell positions and Sizes in COMBATANTS before choosing moveTo
- For melee attacks (5ft reach): move to an ADJACENT cell — edge-to-edge gap = 0 cells, NOT on top of the target. For two Size:1 tokens this means 1 cell apart horizontally, vertically, or diagonally
- For ranged attacks: prefer staying at range and using cover. Only close distance if currently out of weapon range
- Include "moveTo" in UPDATES to physically reposition the token. Only for monsters/NPCs, NEVER for player characters
- moveTo values must be integers (whole cell numbers)
- If a monster doesn't move, omit moveTo

Output format:
- Use bullet points or concise lines for ALL mechanical info: rolls, movement, conditions, what to roll next
- Only use conversational prose for the narrative description of what happens (1-2 vivid sentences per attack/action)
- Structure each turn as: mechanics (bullets) → narrative (prose)
- Example structure (single monster):
  Goblin: 🎲 d20+5 = 17 — hits!
  Goblin: 🎲 2d6+3 = [4,5]+3 = 12 slashing
  *The goblin lunges forward, its rusted blade carving a gash across the fighter's shoulder.*
  - Goblin moved 20ft (10ft remaining)
  - Fighter takes 12 slashing damage
- Example structure (monster group — each member labeled):
  Ape #1: 🎲 d20+5 = 19 — hits!
  Ape #1: 🎲 1d6+4 = 6 bludgeoning
  *Ape #1 hurls a rock that cracks against the ranger's shield.*
  Ape #2: 🎲 d20+5 = 11 — misses!
  *Ape #2 swings wildly, its fist smashing into the dirt.*
- Vary combat verbs: "cleaves", "rakes", "slams", "carves", "lashes"
- Keep it punchy — fits in a chat window

Terrain & environment:
- If an ENVIRONMENT section is present, use it to inform tactical decisions
- Difficult terrain costs double movement. Impassable terrain (pit, chasm) blocks movement unless flying
- When walls/barriers block line of sight, note it. Half cover = +2 AC/DEX saves, three-quarters = +5, full = can't be targeted
- Mention terrain effects naturally in narration (e.g. "wading through the shallow stream" for difficult terrain, "ducking behind the low wall" for cover)
- Apply hazard damage when a creature enters or starts its turn in a hazard zone (as noted in the terrain data)
- Monsters should use terrain tactically: seek cover, avoid hazards, use elevation

Action economy (STRICT):
- 1 Movement, 1 Action, 1 Bonus Action, 1 Reaction per turn
- Multiattack = ONE Action with multiple attacks. The Multiattack description specifies EXACTLY which attacks are made (e.g. "two fist attacks" = Fist only, NOT Rock or any other weapon). You MUST follow the Multiattack description literally — never substitute different attacks. Without Multiattack = ONE attack per Action
- Bonus Actions only if a feature grants one. Most creatures have none
- Once-per-turn features (e.g. Sneak Attack, Divine Smite, Savage Attacker) cannot be used again on a bonus action or any other action in the same turn. Track what has been used THIS turn and do not allow repeats
- Legendary Actions: only if listed, at END of another creature's turn, respect uses per round

Rules:
- Never make up stats, abilities, or spells not in the context
- SECRECY: NEVER disclose a monster's or NPC's exact HP, current HP, max HP, AC, or saving throw DC numbers. This includes "vs AC" and "DC 14" in roll lines — just say "hits!"/"misses!" or "passes!"/"fails!" without revealing the threshold. You MAY use descriptive hints like "badly wounded", "barely standing", "heavily armored", or "nimble". You MAY always reveal Conditions (e.g. Poisoned, Stunned, Prone, Dead). Never say exact values like "AC 16", "HP 45/60", "DC 13", "has 12 hit points left", or "vs AC 15"
- Never add "what if" scenarios or hypothetical analysis
- Never explain roll selection reasoning. No meta-commentary ("The DM provided two rolls", "Since disadvantage, we use..."). Just show the result and narrate
- NEVER mention, describe, apply, or reference any player character feat or class feature by name or effect. You do not know what feats or features a PC has. Do not say "Savage Attacker lets you reroll", "you use Nick to attack with your off-hand", "Second Wind heals you", etc. If a player invokes a feat/feature, acknowledge the result they describe but never explain or adjudicate the mechanic yourself
- For monsters/NPCs: you MAY use their listed abilities from ABILITY DETAILS and COMBATANTS. For player characters: you may ONLY track and report HP changes and conditions from this list: Healthy, Blinded, Charmed, Deafened, Frightened, Grappled, Incapacitated, Invisible, Paralyzed, Petrified, Poisoned, Prone, Restrained, Stunned, Unconscious, Exhaustion, Dead. Do not invent or apply any other effects to PCs
- When a monster/NPC is killed (0 HP), narrate the killing blow. Do not apply or mention weapon properties (e.g. Vex, Topple, Slow) or status conditions from the attack — the creature is dead, none of that applies. However, DO still resolve any death-triggered abilities the creature has (e.g. Death Burst, Exploding Corpse) if listed in ABILITY DETAILS
- Aim for 200-400 words. Concise mechanics + vivid narration, no filler

STATE UPDATES (MANDATORY):
After your narration, you MUST append a machine-readable block listing HP, condition, or position changes. This is used to automatically update the game state. Format:
<!--UPDATES
[{"tokenName":"Goblin A","hpCurrent":5,"moveTo":{"col":8,"row":4}},{"tokenName":"Orc","hpCurrent":0,"condition":"Dead"}]
-->
CRITICAL — ONLY include changes from THIS response:
- The HP values in COMBATANTS are ALREADY up to date. They reflect all previous damage/healing
- Only include a token if YOUR response dealt new damage, healed, or changed a condition
- hpCurrent = the token's CURRENT HP from COMBATANTS minus the NEW damage you dealt (or plus healing), clamped to 0 minimum and hpMax maximum
- Do NOT re-apply damage from previous AI responses or RECENT CHAT — that damage is already reflected in the HP shown in COMBATANTS
- Example: if a token shows HP 12/20 in COMBATANTS and you deal 5 damage, hpCurrent = 7 (NOT 12 again, NOT based on old damage)
- Include condition ONLY if it changed in THIS response (e.g. added Poisoned, Stunned, Prone, Restrained, Dead)
- Set condition to "Dead" when hpCurrent reaches 0
- Set condition to "Healthy" to clear a previous condition
- For PLAYER CHARACTERS: include them too if they took damage or gained a condition in THIS response. NEVER include moveTo for player characters
- moveTo is optional — only include it when a monster/NPC moved. Values must be integers (col and row)
- Use the EXACT tokenName from COMBATANTS (case-sensitive)
- If nothing changed in THIS response, output an empty array: <!--UPDATES[]-->
- This block must ALWAYS be the last thing in your response`;

export interface CombatUpdate {
  tokenName: string;
  hpCurrent?: number;
  condition?: string;
  moveTo?: { col: number; row: number };
}

export interface CombatResponseResult {
  narrative: string;
  updates: CombatUpdate[];
}

/**
 * Parse the <!--UPDATES[...]-->  block from the AI response.
 * Returns the narrative (with block stripped) and parsed updates.
 */
export function parseCombatUpdates(raw: string): CombatResponseResult {
  const match = raw.match(/<!--UPDATES\s*(\[[\s\S]*?\])\s*-->/);
  if (!match) {
    return { narrative: raw.trim(), updates: [] };
  }

  const narrative = raw.slice(0, match.index).trim();
  let updates: CombatUpdate[] = [];
  try {
    const parsed = JSON.parse(match[1]);
    if (Array.isArray(parsed)) {
      updates = parsed
        .filter(
          (u: unknown): u is CombatUpdate =>
            typeof u === "object" && u !== null && typeof (u as CombatUpdate).tokenName === "string"
        )
        .map((u) => {
          // Sanitize moveTo: strip if col/row are not valid integers
          if (u.moveTo) {
            const col = u.moveTo.col;
            const row = u.moveTo.row;
            if (typeof col !== "number" || typeof row !== "number" || !Number.isFinite(col) || !Number.isFinite(row)) {
              const { moveTo, ...rest } = u;
              return rest;
            }
          }
          return u;
        });
    }
  } catch {
    console.error("[AI DM] Failed to parse UPDATES block:", match[1]);
  }
  return { narrative, updates };
}

export async function generateCombatResponse(
  apiKey: string,
  contextText: string,
  userPrompt: string
): Promise<CombatResponseResult> {
  try {
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `${contextText}\n\nDM's Question: ${userPrompt}`,
      config: {
        systemInstruction: COMBAT_DM_SYSTEM_PROMPT,
        maxOutputTokens: 8192,
        temperature: 0.8,
      },
    });

    const text = response.text;
    if (!text || text.trim().length === 0) {
      return { narrative: "The AI DM couldn't generate a response. Try rephrasing your question.", updates: [] };
    }

    return parseCombatUpdates(text);
  } catch (error) {
    console.error("[AI DM] Gemini API error:", error);
    return { narrative: "The AI DM encountered an error. Please try again in a moment.", updates: [] };
  }
}
