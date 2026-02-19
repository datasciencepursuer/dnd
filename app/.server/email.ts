import { Resend } from "resend";
import { env } from "./env";

export const resend = new Resend(env.RESEND_API_KEY);

export const fromEmail = process.env.NODE_ENV === "production"
  ? "bubufulplanet <noreply@bubufulplanet.com>"
  : "bubufulplanet <onboarding@resend.dev>";
