import { eq } from "drizzle-orm";
import { db } from "~/.server/db";
import { user } from "~/.server/db/schema";
import type { AccountTier } from "~/.server/db/schema";
import { getTierLimits, type TierLimits } from "~/lib/tier-limits";

export type { AccountTier };

export async function getUserTier(userId: string): Promise<AccountTier> {
  const result = await db
    .select({ accountTier: user.accountTier })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  return result[0]?.accountTier ?? "adventurer";
}

export async function getUserTierLimits(userId: string): Promise<TierLimits> {
  const tier = await getUserTier(userId);
  return getTierLimits(tier);
}

export async function getUserSubscriptionInfo(userId: string) {
  const result = await db
    .select({
      accountTier: user.accountTier,
      stripeCustomerId: user.stripeCustomerId,
      stripeSubscriptionId: user.stripeSubscriptionId,
      stripeCurrentPeriodEnd: user.stripeCurrentPeriodEnd,
      stripeCancelAtPeriodEnd: user.stripeCancelAtPeriodEnd,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (result.length === 0) return null;

  return result[0];
}
