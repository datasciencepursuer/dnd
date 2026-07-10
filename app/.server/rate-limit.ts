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

export interface RateLimitResult {
  success: boolean;
  /** Seconds until the window resets; only meaningful when success is false. */
  retryAfter: number;
}

/**
 * Per-user burst limit for AI endpoints (10 requests/minute, sliding window).
 * Allows everything when Redis is not configured, so local dev and
 * pre-provisioning deploys work unchanged.
 */
export async function checkAiRateLimit(userId: string): Promise<RateLimitResult> {
  if (!aiLimiter) return { success: true, retryAfter: 0 };

  try {
    const { success, reset } = await aiLimiter.limit(userId);
    return {
      success,
      retryAfter: success ? 0 : Math.max(1, Math.ceil((reset - Date.now()) / 1000)),
    };
  } catch (error) {
    // Redis being down should degrade to "allowed", not take AI features out.
    console.error("AI rate limit check failed, allowing request:", error);
    return { success: true, retryAfter: 0 };
  }
}

export function rateLimitResponse(retryAfter: number): Response {
  return Response.json(
    { error: "Too many AI requests. Please wait a moment and try again." },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  );
}
