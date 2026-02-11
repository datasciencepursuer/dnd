CREATE TABLE "map_chat_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"map_id" text NOT NULL,
	"user_id" text NOT NULL,
	"user_name" text NOT NULL,
	"message" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "map_chat_messages" ADD CONSTRAINT "map_chat_messages_map_id_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."maps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_chat_messages" ADD CONSTRAINT "map_chat_messages_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "map_chat_messages_map_id_idx" ON "map_chat_messages" USING btree ("map_id");--> statement-breakpoint
CREATE INDEX "map_chat_messages_map_created_idx" ON "map_chat_messages" USING btree ("map_id","created_at");