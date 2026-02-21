CREATE TABLE "ai_image_generations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"prompt" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_image_generations" ADD CONSTRAINT "ai_image_generations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_image_generations_user_id_idx" ON "ai_image_generations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_image_generations_user_created_idx" ON "ai_image_generations" USING btree ("user_id","created_at");