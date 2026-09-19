CREATE TABLE "live_tail_notes" (
	"meeting_id" uuid PRIMARY KEY NOT NULL,
	"first_seq" integer DEFAULT 0 NOT NULL,
	"last_seq" integer DEFAULT -1 NOT NULL,
	"notes" jsonb,
	"model" text,
	"claimed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "live_tail_notes" ADD CONSTRAINT "live_tail_notes_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;