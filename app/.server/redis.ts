import { Redis } from "@upstash/redis";

// Optional: only active when Upstash env vars are set (e.g. via the Vercel
// Marketplace integration). All consumers must handle the null case.
export const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;
