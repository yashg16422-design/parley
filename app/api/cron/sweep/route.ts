import { timingSafeEqual } from "node:crypto";
import { getDb } from "@/db";
import { jsonError } from "@/http";
import { sweep } from "@/sweep";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Vercel Cron (or any scheduler) with `Authorization: Bearer $CRON_SECRET`; Vercel adds that header itself. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return jsonError(503, "CRON_SECRET is not set");
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  if (got.length !== want.length || !timingSafeEqual(got, want)) return jsonError(401, "unauthorized");
  return Response.json(await sweep(getDb()));
}
