import { redirect } from "react-router";
import { eq } from "drizzle-orm";
import { db } from "~/.server/db";
import { user } from "~/.server/db/schema";
import { requireAuth } from "~/.server/auth/session";
import { syncStripeData } from "~/.server/stripe-sync";

export async function loader({ request }: { request: Request }) {
  const session = await requireAuth(request);

  const userData = await db
    .select({ stripeCustomerId: user.stripeCustomerId })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);

  const customerId = userData[0]?.stripeCustomerId;

  if (customerId) {
    try {
      await syncStripeData(customerId);
    } catch (err) {
      console.error("Post-checkout sync failed:", err);
      // Still redirect — webhooks will catch up
    }
  }

  return redirect("/pricing?subscription=success");
}
