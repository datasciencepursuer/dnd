import { eq, and, gte, sql } from "drizzle-orm";
import { env } from "~/.server/env";
import { requireAuth } from "~/.server/auth/session";
import { getUserTierLimits } from "~/.server/subscription";
import { db } from "~/.server/db";
import { aiImageGenerations } from "~/.server/db/schema";
import { generateCharacterPortrait, type ArtStyle } from "~/.server/ai/image-generation";

// GET — return usage stats (remaining generations, window)
export async function loader({ request }: { request: Request }) {
  const session = await requireAuth(request);
  const userId = session.user.id;

  const limits = await getUserTierLimits(userId);
  if (!limits.aiImageGeneration) {
    return Response.json({ remaining: 0, limit: 0, window: "daily", enabled: false });
  }

  const limit = limits.aiImageLimit;
  const window = limits.aiImageLimitWindow;

  if (limit === Infinity) {
    return Response.json({ remaining: null, limit: null, window, enabled: true });
  }

  const windowStart = new Date();
  if (window === "monthly") {
    windowStart.setDate(windowStart.getDate() - 30);
    windowStart.setHours(0, 0, 0, 0);
  } else if (window === "weekly") {
    windowStart.setDate(windowStart.getDate() - 7);
    windowStart.setHours(0, 0, 0, 0);
  } else {
    windowStart.setHours(0, 0, 0, 0);
  }

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(aiImageGenerations)
    .where(
      and(
        eq(aiImageGenerations.userId, userId),
        gte(aiImageGenerations.createdAt, windowStart)
      )
    );

  const used = countResult?.count ?? 0;
  const remaining = Math.max(0, limit - used);

  return Response.json({ remaining, limit, window, enabled: true });
}

// POST — generate a character portrait
export async function action({ request }: { request: Request }) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "AI features are not configured on this server" },
      { status: 503 }
    );
  }

  const session = await requireAuth(request);
  const userId = session.user.id;

  // Check tier permission
  const limits = await getUserTierLimits(userId);
  if (!limits.aiImageGeneration) {
    return Response.json(
      { error: "AI Portrait Generation is not available on your current plan.", upgrade: true },
      { status: 403 }
    );
  }

  // Parse and validate prompt
  const body = await request.json();
  const { prompt, tokenSize, artStyle: rawArtStyle } = body as { prompt: string; tokenSize?: number; artStyle?: string };
  const validArtStyles: ArtStyle[] = ["jrpg", "classic", "pixel"];
  const artStyle: ArtStyle = validArtStyles.includes(rawArtStyle as ArtStyle) ? (rawArtStyle as ArtStyle) : "jrpg";

  if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
    return Response.json({ error: "Prompt is required" }, { status: 400 });
  }

  if (prompt.length > 1000) {
    return Response.json(
      { error: "Prompt must be 1000 characters or less" },
      { status: 400 }
    );
  }

  // Check rate limit based on window (daily or weekly)
  const limit = limits.aiImageLimit;
  const window = limits.aiImageLimitWindow;

  // Unlimited — skip rate check
  if (limit === Infinity) {
    try {
      const size = typeof tokenSize === "number" && tokenSize >= 1 && tokenSize <= 4 ? tokenSize : 1;
      const result = await generateCharacterPortrait(apiKey, prompt.trim(), size, artStyle);

      await db.insert(aiImageGenerations).values({
        id: crypto.randomUUID(),
        userId,
        prompt: prompt.trim(),
      });

      return Response.json({
        imageBase64: result.imageBase64,
        mimeType: result.mimeType,
        remaining: null,
        window,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "SAFETY_FILTER") {
        return Response.json(
          {
            error:
              "The image was blocked by safety filters. Try adjusting your description to be less explicit or violent.",
            safetyFilter: true,
          },
          { status: 422 }
        );
      }

      console.error("[Portrait Generation] Error:", error);
      return Response.json(
        { error: "Failed to generate portrait. Please try again." },
        { status: 500 }
      );
    }
  }

  // Compute window start
  const windowStart = new Date();
  if (window === "monthly") {
    windowStart.setDate(windowStart.getDate() - 30);
    windowStart.setHours(0, 0, 0, 0);
  } else if (window === "weekly") {
    windowStart.setDate(windowStart.getDate() - 7);
    windowStart.setHours(0, 0, 0, 0);
  } else {
    // daily
    windowStart.setHours(0, 0, 0, 0);
  }

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(aiImageGenerations)
    .where(
      and(
        eq(aiImageGenerations.userId, userId),
        gte(aiImageGenerations.createdAt, windowStart)
      )
    );

  const used = countResult?.count ?? 0;

  if (used >= limit) {
    const windowLabel = window === "monthly" ? "per month" : window === "weekly" ? "per week" : "per day";
    const retryLabel = window === "monthly" ? "Try again next month." : window === "weekly" ? "Try again next week." : "Try again tomorrow.";
    return Response.json(
      {
        error: `Limit reached (${limit} generations ${windowLabel}). ${retryLabel}`,
        limitReached: true,
        remaining: 0,
        window,
      },
      { status: 429 }
    );
  }

  // Generate image
  try {
    const size = typeof tokenSize === "number" && tokenSize >= 1 && tokenSize <= 4 ? tokenSize : 1;
    const result = await generateCharacterPortrait(apiKey, prompt.trim(), size, artStyle);

    // Record the generation
    await db.insert(aiImageGenerations).values({
      id: crypto.randomUUID(),
      userId,
      prompt: prompt.trim(),
    });

    const remaining = limit - used - 1;

    return Response.json({
      imageBase64: result.imageBase64,
      mimeType: result.mimeType,
      remaining,
      window,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "SAFETY_FILTER") {
      return Response.json(
        {
          error:
            "The image was blocked by safety filters. Try adjusting your description to be less explicit or violent.",
          safetyFilter: true,
        },
        { status: 422 }
      );
    }

    console.error("[Portrait Generation] Error:", error);
    return Response.json(
      { error: "Failed to generate portrait. Please try again." },
      { status: 500 }
    );
  }
}
