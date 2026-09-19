CREATE TYPE "public"."media_provider" AS ENUM('mux');--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "media_provider" "media_provider";--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "media_asset_id" text;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "media_playback_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "meetings_media_asset_uq" ON "meetings" USING btree ("media_provider","media_asset_id");--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_media_ck" CHECK (("meetings"."media_provider" IS NULL) = ("meetings"."media_asset_id" IS NULL));