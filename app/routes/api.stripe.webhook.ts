import { eq } from "drizzle-orm";
import { db } from "~/.server/db";
import { user } from "~/.server/db/schema";
import type { AccountTier } from "~/.server/db/schema";
import { stripe } from "~/.server/stripe";
import { env } from "~/.server/env";
import type Stripe from "stripe";

function resolveTierFromPriceId(priceId: string): AccountTier | null {
  if (priceId === env.STRIPE_ADVENTURER_PRICE_ID) return "adventurer";
  if (priceId === env.STRIPE_HERO_PRICE_ID) return "dungeon_master";
  return null;
}

function getPeriodEnd(subscription: Stripe.Subscription): Date {
  const itemEnd = subscription.items.data[0]?.current_period_end;
  return new Date((itemEnd ?? 0) * 1000);
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  if (!subscriptionId) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = subscription.items.data[0]?.price.id;
  if (!priceId) return;

  const tier = resolveTierFromPriceId(priceId);
  if (!tier) return;

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;

  if (!customerId) return;

  await db
    .update(user)
    .set({
      accountTier: tier,
      stripeSubscriptionId: subscriptionId,
      stripeCurrentPeriodEnd: getPeriodEnd(subscription),
      stripeCancelAtPeriodEnd: subscription.cancel_at_period_end,
    })
    .where(eq(user.stripeCustomerId, customerId));
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const priceId = subscription.items.data[0]?.price.id;
  if (!priceId) return;

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;

  if (!customerId) return;

  // Never downgrade admin (Lodestar) users via webhook
  const existing = await db
    .select({ accountTier: user.accountTier })
    .from(user)
    .where(eq(user.stripeCustomerId, customerId))
    .limit(1);
  if (existing[0]?.accountTier === "admin") return;

  // past_due keeps current tier (Stripe retries automatically)
  if (subscription.status === "past_due") {
    await db
      .update(user)
      .set({
        stripeCurrentPeriodEnd: getPeriodEnd(subscription),
        stripeCancelAtPeriodEnd: subscription.cancel_at_period_end,
      })
      .where(eq(user.stripeCustomerId, customerId));
    return;
  }

  const tier = resolveTierFromPriceId(priceId);
  if (!tier) return;

  await db
    .update(user)
    .set({
      accountTier: subscription.status === "active" ? tier : "free",
      stripeSubscriptionId: subscription.id,
      stripeCurrentPeriodEnd: getPeriodEnd(subscription),
      stripeCancelAtPeriodEnd: subscription.cancel_at_period_end,
    })
    .where(eq(user.stripeCustomerId, customerId));
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;

  if (!customerId) return;

  // Never downgrade admin (Lodestar) users via webhook
  const existing = await db
    .select({ accountTier: user.accountTier })
    .from(user)
    .where(eq(user.stripeCustomerId, customerId))
    .limit(1);
  if (existing[0]?.accountTier === "admin") return;

  await db
    .update(user)
    .set({
      accountTier: "free",
      stripeSubscriptionId: null,
      stripeCurrentPeriodEnd: null,
      stripeCancelAtPeriodEnd: false,
    })
    .where(eq(user.stripeCustomerId, customerId));
}

export async function action({ request }: { request: Request }) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      break;
    case "customer.subscription.updated":
      await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;
  }

  return Response.json({ received: true });
}
