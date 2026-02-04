CREATE INDEX "group_members_group_user_idx" ON "group_members" USING btree ("group_id","user_id");--> statement-breakpoint
CREATE INDEX "maps_user_id_idx" ON "maps" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "maps_group_id_idx" ON "maps" USING btree ("group_id");