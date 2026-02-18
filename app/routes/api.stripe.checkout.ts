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
  const body = await request.json();
  const { priceId } = body;

  if (!priceId || typeof priceId !== "string") {
    return Response.json({ error: "priceId is required" }, { status: 400 });
  }

  // Validate price ID
  const validPriceIds = [env.STRIPE_ADVENTURER_PRICE_ID, env.STRIPE_HERO_PRICE_ID];
  if (!validPriceIds.includes(priceId)) {
    return Response.json({ error: "Invalid price ID" }, { status: 400 });
  }

  // Get or create Stripe customer
  const userData = await db
    .select({ stripeCustomerId: user.stripeCustomerId, email: user.email, name: user.name })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (userData.length === 0) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  let customerId = userData[0].stripeCustomerId;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: userData[0].email,
      name: userData[0].name,
      metadata: { userId },
    });
    customerId = customer.id;

    await db
      .update(user)
      .set({ stripeCustomerId: customerId })
      .where(eq(user.id, userId));
  }

  const baseUrl = env.BETTER_AUTH_URL;

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/pricing?subscription=success`,
    cancel_url: `${baseUrl}/pricing?subscription=cancelled`,
    metadata: { userId },
  });

  return Response.json({ url: checkoutSession.url });
}
