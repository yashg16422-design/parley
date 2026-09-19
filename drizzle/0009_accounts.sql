CREATE TYPE "public"."user_kind" AS ENUM('demo', 'guest', 'account');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "kind" "user_kind" DEFAULT 'demo' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "google_sub" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "users_guest_expiry_idx" ON "users" USING btree ("expires_at") WHERE "users"."expires_at" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_google_sub_unique" UNIQUE("google_sub");--> statement-breakpoint
UPDATE "users" SET "kind" = 'guest', "expires_at" = now() + interval '24 hours' WHERE "email" LIKE 'guest-%@guest.parley.example';
