import Stripe from "stripe";
import { env } from "~/.server/env";

export const stripe = new Stripe(env.STRIPE_SECRET_KEY);
