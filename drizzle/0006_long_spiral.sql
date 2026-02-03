ALTER TABLE "characters" DROP CONSTRAINT "characters_group_id_groups_id_fk";
--> statement-breakpoint
DROP INDEX "characters_group_id_idx";--> statement-breakpoint
ALTER TABLE "characters" DROP COLUMN "group_id";