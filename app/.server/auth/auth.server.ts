import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db";
import * as schema from "../db/schema";

// Build trusted origins list
const trustedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://bubufulplanet.com",
  process.env.BETTER_AUTH_URL,
  // Auto-detect Vercel preview/production URLs
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined,
].filter((origin): origin is string => Boolean(origin));

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      rateLimit: schema.rateLimit,
    },
  }),
  emailAndPassword: {
    enabled: true,
  },
  trustedOrigins,
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60, // default: 60 seconds
    max: 100, // default: 100 requests per window
    customRules: {
      // Limit account creation: 3 per IP per 24 hours
      "/sign-up/email": {
        window: 86400, // 24 hours in seconds
        max: 3,
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
