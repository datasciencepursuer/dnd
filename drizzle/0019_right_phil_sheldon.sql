CREATE TABLE "group_schedule_votes" (
	"id" text PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"user_id" text NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"vote" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "group_schedule_votes_group_id_user_id_start_time_end_time_unique" UNIQUE("group_id","user_id","start_time","end_time")
);
--> statement-breakpoint
ALTER TABLE "group_schedule_votes" ADD CONSTRAINT "group_schedule_votes_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_schedule_votes" ADD CONSTRAINT "group_schedule_votes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "group_schedule_votes_group_idx" ON "group_schedule_votes" USING btree ("group_id");