import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { Resend } from "resend";
import { render } from "@react-email/render";
import { db } from "../db";
import * as schema from "../db/schema";
import { env } from "../env";
import { VerificationEmail } from "../emails/verification-email";
import { PasswordResetEmail } from "../emails/password-reset-email";

const resend = new Resend(env.RESEND_API_KEY);

// Use Resend's test email in development (before domain verification)
// In production, use your verified domain email
const fromEmail = process.env.NODE_ENV === "production"
  ? "bubufulplanet <noreply@bubufulplanet.com>"
  : "bubufulplanet <onboarding@resend.dev>";

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
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],
      allowDifferentEmails: true,
      updateUserInfoOnLink: true,
    },
  },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      const html = await render(PasswordResetEmail({ url, userName: user.name }));
      await resend.emails.send({
        from: fromEmail,
        to: user.email,
        subject: "Reset your password - bubufulplanet",
        html,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    callbackURL: "/",
    sendVerificationEmail: async ({ user, url }) => {
      const html = await render(VerificationEmail({ url, userName: user.name }));
      await resend.emails.send({
        from: fromEmail,
        to: user.email,
        subject: "Verify your email - bubufulplanet",
        html,
      });
    },
  },
  trustedOrigins,
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 10000, // Effectively disable global rate limit
    customRules: {
      // Limit account creation: 3 per IP per 12 hours
      "/sign-up/email": {
        window: 43200, // 12 hours in seconds
        max: 3,
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
