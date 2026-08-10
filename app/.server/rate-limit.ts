import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "./redis";

// Burst limiter for Gemini-backed endpoints. This complements (not replaces)
// the per-tier windowed quotas in the image generation routes: it stops
// scripted abuse even for tiers whose quota is Infinity.
const aiLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "1 m"),
      prefix: "ratelimit:ai",
    })
  : null;
const failClosed =
  process.env.VERCEL_ENV === "production" ||
  (!process.env.VERCEL_ENV && process.env.NODE_ENV === "production");

export interface RateLimitResult {
  success: boolean;
  /** Seconds until the window resets; only meaningful when success is false. */
  retryAfter: number;
}

/**
 * Per-user burst limit for AI endpoints (10 requests/minute, sliding window).
 * Local development and previews remain usable without Redis. Production
 * rejects AI requests when the limiter is unavailable, protecting unlimited
 * tiers from an unbounded fallback.
 */
export async function checkAiRateLimit(userId: string): Promise<RateLimitResult> {
  if (!aiLimiter) return { success: !failClosed, retryAfter: 0 };

  try {
    const { success, reset } = await aiLimiter.limit(userId);
    return {
      success,
      retryAfter: success ? 0 : Math.max(1, Math.ceil((reset - Date.now()) / 1000)),
    };
  } catch (error) {
    console.error("AI rate limit check failed:", error);
    return { success: !failClosed, retryAfter: failClosed ? 60 : 0 };
  }
}

export function rateLimitResponse(retryAfter: number): Response {
  return Response.json(
    { error: "Too many AI requests. Please wait a moment and try again." },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  );
}
