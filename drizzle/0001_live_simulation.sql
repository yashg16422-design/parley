ALTER TABLE "meetings" ADD COLUMN "simulated_from_id" uuid;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "live_clock_ms" integer;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "live_speed" smallint;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "live_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_simulated_from_id_meetings_id_fk" FOREIGN KEY ("simulated_from_id") REFERENCES "public"."meetings"("id") ON DELETE set null ON UPDATE no action;