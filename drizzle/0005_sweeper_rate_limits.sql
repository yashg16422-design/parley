ALTER TYPE "public"."meeting_status" ADD VALUE 'abandoned';--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"hits" timestamp with time zone[] NOT NULL
);
