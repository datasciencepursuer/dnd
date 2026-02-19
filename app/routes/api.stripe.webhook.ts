import { stripe } from "~/.server/stripe";
import { env } from "~/.server/env";
import { syncStripeData } from "~/.server/stripe-sync";
import type Stripe from "stripe";

const allowedEvents = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "customer.subscription.pending_update_applied",
  "customer.subscription.pending_update_expired",
  "invoice.paid",
  "invoice.payment_failed",
  "invoice.payment_action_required",
  "invoice.payment_succeeded",
  "invoice.marked_uncollectible",
]);

function extractCustomerId(event: Stripe.Event): string | null {
  const obj = event.data.object as unknown as Record<string, unknown>;

  // checkout.session.completed has `customer` at top level
  // subscription events have `customer` at top level
  // invoice events have `customer` at top level
  const raw = obj.customer;

  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object" && "id" in raw) {
    return (raw as { id: string }).id;
  }

  return null;
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

  if (allowedEvents.has(event.type)) {
    const customerId = extractCustomerId(event);
    if (customerId) {
      try {
        await syncStripeData(customerId);
      } catch (err) {
        console.error(`Stripe sync failed for ${event.type}:`, err);
        // Always return 200 to prevent Stripe retry storms
      }
    }
  }

  return Response.json({ received: true });
}
