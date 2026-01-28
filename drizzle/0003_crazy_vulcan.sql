ALTER TABLE "rateLimit" ADD COLUMN "last_request" bigint NOT NULL;--> statement-breakpoint
ALTER TABLE "rateLimit" ALTER COLUMN "expires_at" SET DEFAULT now() + interval '12 hours';