import { eq } from "drizzle-orm";
import { db } from "~/.server/db";
import { user } from "~/.server/db/schema";
import type { AccountTier } from "~/.server/db/schema";
import { stripe } from "~/.server/stripe";
import { env } from "~/.server/env";

function resolveTierFromPriceId(priceId: string): AccountTier | null {
  if (priceId === env.STRIPE_ADVENTURER_PRICE_ID) return "hero";
  if (priceId === env.STRIPE_HERO_PRICE_ID) return "dungeon_master";
  return null;
}

/**
 * Single source of truth for syncing Stripe subscription state to the database.
 * Always fetches the latest subscription from Stripe's API — idempotent and safe
 * to call from both webhooks and the post-checkout success route.
 */
export async function syncStripeData(customerId: string) {
  // Never downgrade manually-assigned tiers (The Six, Lodestar, legacy admin)
  const existing = await db
    .select({ accountTier: user.accountTier })
    .from(user)
    .where(eq(user.stripeCustomerId, customerId))
    .limit(1);

  if (existing.length === 0) return;
  const protectedTiers: string[] = ["the_six", "lodestar"];
  if (protectedTiers.includes(existing[0].accountTier)) return;

  // Fetch the latest subscription (any status)
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    limit: 1,
    status: "all",
    expand: ["data.items.data.price"],
  });

  const subscription = subscriptions.data[0];

  // No subscription found — reset to free
  if (!subscription) {
    await db
      .update(user)
      .set({
        accountTier: "adventurer",
        stripeSubscriptionId: null,
        stripeCurrentPeriodEnd: null,
        stripeCancelAtPeriodEnd: false,
      })
      .where(eq(user.stripeCustomerId, customerId));
    return;
  }

  const priceId = subscription.items.data[0]?.price.id;
  const periodEnd = new Date(
    (subscription.items.data[0]?.current_period_end ?? 0) * 1000
  );

  // past_due: keep current tier, only update metadata (Stripe retries automatically)
  if (subscription.status === "past_due") {
    await db
      .update(user)
      .set({
        stripeSubscriptionId: subscription.id,
        stripeCurrentPeriodEnd: periodEnd,
        stripeCancelAtPeriodEnd: subscription.cancel_at_period_end,
      })
      .where(eq(user.stripeCustomerId, customerId));
    return;
  }

  const tier = priceId ? resolveTierFromPriceId(priceId) : null;

  await db
    .update(user)
    .set({
      accountTier: subscription.status === "active" && tier ? tier : "adventurer",
      stripeSubscriptionId: subscription.id,
      stripeCurrentPeriodEnd: periodEnd,
      stripeCancelAtPeriodEnd: subscription.cancel_at_period_end,
    })
    .where(eq(user.stripeCustomerId, customerId));
}
