CREATE TYPE "public"."rsvp_status" AS ENUM('available', 'unavailable');--> statement-breakpoint
CREATE TABLE "meetup_proposals" (
	"id" text PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"proposed_by" text NOT NULL,
	"proposed_date" timestamp NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meetup_rsvps" (
	"id" text PRIMARY KEY NOT NULL,
	"proposal_id" text NOT NULL,
	"user_id" text NOT NULL,
	"status" "rsvp_status" NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "meetup_rsvps_proposal_id_user_id_unique" UNIQUE("proposal_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "meetup_proposals" ADD CONSTRAINT "meetup_proposals_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetup_proposals" ADD CONSTRAINT "meetup_proposals_proposed_by_user_id_fk" FOREIGN KEY ("proposed_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetup_rsvps" ADD CONSTRAINT "meetup_rsvps_proposal_id_meetup_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."meetup_proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetup_rsvps" ADD CONSTRAINT "meetup_rsvps_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meetup_proposals_group_id_idx" ON "meetup_proposals" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "meetup_proposals_group_date_idx" ON "meetup_proposals" USING btree ("group_id","proposed_date");--> statement-breakpoint
CREATE INDEX "meetup_rsvps_proposal_id_idx" ON "meetup_rsvps" USING btree ("proposal_id");