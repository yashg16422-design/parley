CREATE TABLE "recording_chunks" (
	"meeting_id" uuid NOT NULL,
	"idx" integer NOT NULL,
	"start_ms" integer NOT NULL,
	"mime" text NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recording_chunks_meeting_id_idx_pk" PRIMARY KEY("meeting_id","idx")
);
--> statement-breakpoint
ALTER TABLE "recording_chunks" ADD CONSTRAINT "recording_chunks_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;