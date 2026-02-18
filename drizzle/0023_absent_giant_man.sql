CREATE TYPE "public"."account_tier" AS ENUM('free', 'adventurer', 'dungeon_master', 'admin');--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "account_tier" "account_tier" DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "stripe_subscription_id" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "stripe_current_period_end" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "stripe_cancel_at_period_end" boolean DEFAULT false NOT NULL;