import type { Route } from "./+types/api.me";
import { requireAuth } from "~/.server/auth/session";
import { getUserTier, getUserSubscriptionInfo } from "~/.server/subscription";
import { getTierLimits } from "~/lib/tier-limits";
import { auth } from "~/.server/auth/auth.server";

export async function loader({ request }: Route.LoaderArgs) {
  const session = await requireAuth(request);
  const userId = session.user.id;

  const [tier, subscription, accounts] = await Promise.all([
    getUserTier(userId),
    getUserSubscriptionInfo(userId),
    auth.api.listUserAccounts({ headers: request.headers }),
  ]);

  const limits = getTierLimits(tier);
  const hasGoogle = accounts.some(
    (a: { providerId: string }) => a.providerId === "google"
  );

  return Response.json({
    userId,
    userName: session.user.name,
    email: session.user.email,
    accountTier: tier,
    tierLimits: limits,
    hasGoogle,
    stripeSubscriptionId: subscription?.stripeSubscriptionId ?? null,
    stripeCurrentPeriodEnd: subscription?.stripeCurrentPeriodEnd?.toISOString() ?? null,
    stripeCancelAtPeriodEnd: subscription?.stripeCancelAtPeriodEnd ?? false,
  });
}
