ALTER TABLE "user" ALTER COLUMN "account_tier" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "account_tier" SET DEFAULT 'adventurer'::text;--> statement-breakpoint
UPDATE "user" SET "account_tier" = 'adventurer' WHERE "account_tier" NOT IN ('adventurer', 'hero', 'dungeon_master', 'the_six', 'lodestar');--> statement-breakpoint
DROP TYPE IF EXISTS "public"."account_tier";--> statement-breakpoint
CREATE TYPE "public"."account_tier" AS ENUM('adventurer', 'hero', 'dungeon_master', 'the_six', 'lodestar');--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "account_tier" SET DEFAULT 'adventurer'::"public"."account_tier";--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "account_tier" SET DATA TYPE "public"."account_tier" USING "account_tier"::"public"."account_tier";