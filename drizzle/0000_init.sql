CREATE TYPE "public"."action_item_status" AS ENUM('open', 'done');--> statement-breakpoint
CREATE TYPE "public"."calendar_provider" AS ENUM('google', 'outlook');--> statement-breakpoint
CREATE TYPE "public"."connection_status" AS ENUM('connected', 'syncing', 'disconnected');--> statement-breakpoint
CREATE TYPE "public"."item_origin" AS ENUM('ai', 'manual');--> statement-breakpoint
CREATE TYPE "public"."job_kind" AS ENUM('chunk_notes', 'merge_knowledge', 'render_summary', 'finalize_stats');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('queued', 'running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."meeting_platform" AS ENUM('zoom', 'google_meet', 'teams');--> statement-breakpoint
CREATE TYPE "public"."meeting_status" AS ENUM('scheduled', 'live', 'processing', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."summary_status" AS ENUM('pending', 'streaming', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "action_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"text" text NOT NULL,
	"assignee_participant_id" uuid,
	"assignee_name" text,
	"due_date" date,
	"due_text" text,
	"status" "action_item_status" DEFAULT 'open' NOT NULL,
	"origin" "item_origin" DEFAULT 'ai' NOT NULL,
	"source_seqs" integer[] DEFAULT '{}'::integer[] NOT NULL,
	"source_start_ms" integer,
	"evidence_quote" text,
	"verified" boolean DEFAULT false NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone,
	"search" "tsvector" GENERATED ALWAYS AS (to_tsvector('english', text)) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" "calendar_provider" DEFAULT 'google' NOT NULL,
	"account_email" text NOT NULL,
	"status" "connection_status" DEFAULT 'connected' NOT NULL,
	"auto_record" text DEFAULT 'all' NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_synced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "calendar_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"connection_id" uuid,
	"external_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"platform" "meeting_platform" NOT NULL,
	"meeting_url" text NOT NULL,
	"attendees" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"record_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calendar_events_time_order_ck" CHECK ("calendar_events"."ends_at" > "calendar_events"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "chunk_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"prompt_version" text NOT NULL,
	"chunk_idx" smallint NOT NULL,
	"first_seq" integer NOT NULL,
	"last_seq" integer NOT NULL,
	"start_ms" integer NOT NULL,
	"end_ms" integer NOT NULL,
	"notes" jsonb NOT NULL,
	"model" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"meeting_id" uuid NOT NULL,
	"created_by" uuid,
	"title" text NOT NULL,
	"start_ms" integer NOT NULL,
	"end_ms" integer NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clips_slug_unique" UNIQUE("slug"),
	CONSTRAINT "clips_range_ck" CHECK ("clips"."start_ms" >= 0 AND "clips"."end_ms" > "clips"."start_ms")
);
--> statement-breakpoint
CREATE TABLE "highlights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"created_by" uuid,
	"at_ms" integer NOT NULL,
	"label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "highlights_at_ms_ck" CHECK ("highlights"."at_ms" >= 0)
);
--> statement-breakpoint
CREATE TABLE "meeting_knowledge" (
	"meeting_id" uuid PRIMARY KEY NOT NULL,
	"prompt_version" text NOT NULL,
	"transcript_hash" text NOT NULL,
	"knowledge" jsonb NOT NULL,
	"model" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meeting_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL,
	"email" text,
	"title" text,
	"company" text,
	"is_external" boolean DEFAULT false NOT NULL,
	"speaker_idx" smallint NOT NULL,
	"color" text NOT NULL,
	"talk_ms" integer DEFAULT 0 NOT NULL,
	"word_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"calendar_event_id" uuid,
	"title" text NOT NULL,
	"meeting_type" text DEFAULT 'general' NOT NULL,
	"platform" "meeting_platform" NOT NULL,
	"status" "meeting_status" DEFAULT 'scheduled' NOT NULL,
	"default_template_id" text DEFAULT 'general' NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"stats" jsonb,
	"transcript_hash" text,
	"search" "tsvector" GENERATED ALWAYS AS (to_tsvector('english', coalesce(title, ''))) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meetings_calendar_event_id_unique" UNIQUE("calendar_event_id")
);
--> statement-breakpoint
CREATE TABLE "processing_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"meeting_id" uuid NOT NULL,
	"kind" "job_kind" NOT NULL,
	"status" "job_status" DEFAULT 'queued' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"max_attempts" smallint DEFAULT 3 NOT NULL,
	"run_after" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_until" timestamp with time zone,
	"last_error" text,
	"duration_ms" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "processing_jobs_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"template_id" text NOT NULL,
	"prompt_version" text NOT NULL,
	"status" "summary_status" DEFAULT 'pending' NOT NULL,
	"content" jsonb,
	"model" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"cache_read_tokens" integer,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"instructions" text NOT NULL,
	"sections" jsonb NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transcript_segments" (
	"meeting_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"participant_id" uuid NOT NULL,
	"speaker_name" text NOT NULL,
	"start_ms" integer NOT NULL,
	"end_ms" integer NOT NULL,
	"text" text NOT NULL,
	"search" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('english', text), 'A') || setweight(to_tsvector('simple', speaker_name), 'C')) STORED,
	CONSTRAINT "transcript_segments_pk" PRIMARY KEY("meeting_id","seq"),
	CONSTRAINT "transcript_segments_time_order_ck" CHECK ("transcript_segments"."end_ms" >= "transcript_segments"."start_ms" AND "transcript_segments"."start_ms" >= 0)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"title" text,
	"avatar_url" text,
	"timezone" text DEFAULT 'America/New_York' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_assignee_participant_id_meeting_participants_id_fk" FOREIGN KEY ("assignee_participant_id") REFERENCES "public"."meeting_participants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_connections" ADD CONSTRAINT "calendar_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_connection_id_calendar_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."calendar_connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chunk_notes" ADD CONSTRAINT "chunk_notes_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clips" ADD CONSTRAINT "clips_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clips" ADD CONSTRAINT "clips_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "highlights" ADD CONSTRAINT "highlights_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "highlights" ADD CONSTRAINT "highlights_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_knowledge" ADD CONSTRAINT "meeting_knowledge_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_participants" ADD CONSTRAINT "meeting_participants_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_participants" ADD CONSTRAINT "meeting_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_calendar_event_id_calendar_events_id_fk" FOREIGN KEY ("calendar_event_id") REFERENCES "public"."calendar_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_default_template_id_templates_id_fk" FOREIGN KEY ("default_template_id") REFERENCES "public"."templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summaries" ADD CONSTRAINT "summaries_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summaries" ADD CONSTRAINT "summaries_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript_segments" ADD CONSTRAINT "transcript_segments_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript_segments" ADD CONSTRAINT "transcript_segments_participant_id_meeting_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."meeting_participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "action_items_meeting_idx" ON "action_items" USING btree ("meeting_id","sort_order");--> statement-breakpoint
CREATE INDEX "action_items_assignee_idx" ON "action_items" USING btree ("assignee_participant_id");--> statement-breakpoint
CREATE INDEX "action_items_open_idx" ON "action_items" USING btree ("status") WHERE "action_items"."status" = 'open';--> statement-breakpoint
CREATE INDEX "action_items_search_idx" ON "action_items" USING gin ("search");--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_connections_user_provider_uq" ON "calendar_connections" USING btree ("user_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_events_connection_external_uq" ON "calendar_events" USING btree ("connection_id","external_id");--> statement-breakpoint
CREATE INDEX "calendar_events_user_starts_idx" ON "calendar_events" USING btree ("user_id","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "chunk_notes_meeting_version_idx_uq" ON "chunk_notes" USING btree ("meeting_id","prompt_version","chunk_idx");--> statement-breakpoint
CREATE INDEX "clips_meeting_idx" ON "clips" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "highlights_meeting_at_idx" ON "highlights" USING btree ("meeting_id","at_ms");--> statement-breakpoint
CREATE UNIQUE INDEX "meeting_participants_speaker_uq" ON "meeting_participants" USING btree ("meeting_id","speaker_idx");--> statement-breakpoint
CREATE INDEX "meeting_participants_user_idx" ON "meeting_participants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "meetings_owner_started_idx" ON "meetings" USING btree ("owner_id","started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "meetings_status_idx" ON "meetings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "meetings_search_idx" ON "meetings" USING gin ("search");--> statement-breakpoint
CREATE INDEX "processing_jobs_runnable_idx" ON "processing_jobs" USING btree ("run_after") WHERE "processing_jobs"."status" = 'queued';--> statement-breakpoint
CREATE INDEX "processing_jobs_meeting_idx" ON "processing_jobs" USING btree ("meeting_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "summaries_meeting_template_version_uq" ON "summaries" USING btree ("meeting_id","template_id","prompt_version");--> statement-breakpoint
CREATE INDEX "transcript_segments_meeting_start_idx" ON "transcript_segments" USING btree ("meeting_id","start_ms");--> statement-breakpoint
CREATE INDEX "transcript_segments_participant_idx" ON "transcript_segments" USING btree ("participant_id");--> statement-breakpoint
CREATE INDEX "transcript_segments_search_idx" ON "transcript_segments" USING gin ("search");