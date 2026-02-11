CREATE TABLE "map_chat_chunks" (
	"id" text PRIMARY KEY NOT NULL,
	"map_id" text NOT NULL,
	"messages" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "map_chat_chunks" ADD CONSTRAINT "map_chat_chunks_map_id_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."maps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "map_chat_chunks_map_created_idx" ON "map_chat_chunks" USING btree ("map_id","created_at");