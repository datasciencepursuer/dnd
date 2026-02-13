CREATE TABLE "group_availabilities" (
	"id" text PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"user_id" text NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "group_availabilities" ADD CONSTRAINT "group_availabilities_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_availabilities" ADD CONSTRAINT "group_availabilities_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "group_availabilities_group_id_idx" ON "group_availabilities" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "group_availabilities_group_time_idx" ON "group_availabilities" USING btree ("group_id","start_time","end_time");--> statement-breakpoint
CREATE INDEX "group_availabilities_user_group_idx" ON "group_availabilities" USING btree ("user_id","group_id");