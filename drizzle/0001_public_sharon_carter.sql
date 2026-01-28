CREATE TYPE "public"."dnd_role" AS ENUM('dm', 'player', 'observer');--> statement-breakpoint
ALTER TABLE "map_presence" DROP CONSTRAINT "map_presence_map_id_user_id_connection_id_unique";--> statement-breakpoint
CREATE INDEX "map_presence_user_id_idx" ON "map_presence" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "map_presence" ADD CONSTRAINT "map_presence_map_id_user_id_unique" UNIQUE("map_id","user_id");