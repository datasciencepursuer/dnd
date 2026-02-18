import { env } from "~/.server/env";
import { requireAuth } from "~/.server/auth/session";
import { requireMapPermission } from "~/.server/permissions/map-permissions";
import { getUserTierLimits } from "~/.server/subscription";
import {
  serializeCombatContext,
  generateCombatResponse,
} from "~/.server/ai/gemini";
import { lookupSrdMonsters } from "~/.server/ai/srd-lookup";
import { matchAbilityDescriptions } from "~/.server/ai/enrich-combat-context";
import type {
  CombatState,
  Token,
  GridSettings,
  MonsterGroup,
  WallSegment,
  AreaShape,
} from "~/features/map-editor/types";
import type { ChatMessageData } from "~/features/map-editor/store/chat-store";
import type { AbilityDescription } from "~/.server/ai/enrich-combat-context";

interface RouteArgs {
  request: Request;
  params: { mapId: string };
}

export async function action({ request, params }: RouteArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Check if AI feature is configured
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "AI DM is not configured on this server" },
      { status: 503 }
    );
  }

  const session = await requireAuth(request);
  const mapId = params.mapId;

  // Check tier permission
  const limits = await getUserTierLimits(session.user.id);
  if (!limits.aiDmAssistant) {
    return Response.json(
      { error: "AI DM Assistant requires a Hero subscription.", upgrade: true },
      { status: 403 }
    );
  }

  // Only DM can use AI assistant
  const access = await requireMapPermission(mapId, session.user.id, "view");
  if (!access.isDungeonMaster) {
    return Response.json(
      { error: "Only the Dungeon Master can use the AI assistant" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { prompt, combatContext } = body as {
    prompt: string;
    combatContext: {
      combat: CombatState;
      tokens: Token[];
      grid: GridSettings;
      monsterGroups: MonsterGroup[];
      recentMessages: ChatMessageData[];
      walls: WallSegment[];
      areas: AreaShape[];
    };
  };

  // Validate prompt
  if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
    return Response.json({ error: "Prompt is required" }, { status: 400 });
  }
  if (prompt.length > 500) {
    return Response.json(
      { error: "Prompt too long (max 500 characters)" },
      { status: 400 }
    );
  }

  // Validate combat is active
  if (!combatContext?.combat?.isInCombat) {
    return Response.json(
      { error: "Combat must be active to use the AI DM" },
      { status: 400 }
    );
  }

  // Enrich combat context with SRD ability descriptions
  const uniqueIndices = [
    ...new Set(
      combatContext.tokens
        .map((t) => t.characterSheet?.srdMonsterIndex)
        .filter((idx): idx is string => !!idx)
    ),
  ];

  let abilityDescriptions: Map<string, AbilityDescription[]> | undefined;
  if (uniqueIndices.length > 0) {
    const srdMonsters = await lookupSrdMonsters(uniqueIndices);
    abilityDescriptions = new Map();
    for (const token of combatContext.tokens) {
      const idx = token.characterSheet?.srdMonsterIndex;
      if (!idx || abilityDescriptions.has(idx)) continue;
      const srdMonster = srdMonsters.get(idx);
      if (srdMonster && token.characterSheet) {
        const descriptions = matchAbilityDescriptions(
          token.characterSheet,
          srdMonster
        );
        if (descriptions.length > 0) {
          abilityDescriptions.set(idx, descriptions);
        }
      }
    }
  }

  // Serialize combat context and generate response
  const contextText = serializeCombatContext({
    ...combatContext,
    abilityDescriptions,
  });
  const result = await generateCombatResponse(
    apiKey,
    contextText,
    prompt.trim()
  );

  return Response.json({ response: result.narrative, updates: result.updates });
}
