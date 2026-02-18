import { eq } from "drizzle-orm";
import { db } from "~/.server/db";
import { user } from "~/.server/db/schema";
import { requireAuth } from "~/.server/auth/session";
import { stripe } from "~/.server/stripe";
import { env } from "~/.server/env";

export async function action({ request }: { request: Request }) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const session = await requireAuth(request);
  const userId = session.user.id;

  const userData = await db
    .select({ stripeCustomerId: user.stripeCustomerId })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (userData.length === 0 || !userData[0].stripeCustomerId) {
    return Response.json({ error: "No subscription found" }, { status: 400 });
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: userData[0].stripeCustomerId,
    return_url: `${env.BETTER_AUTH_URL}/settings`,
  });

  return Response.json({ url: portalSession.url });
}
