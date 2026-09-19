import { after } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { llmForUser } from "@/ai/providers";
import { requestUser } from "@/auth";
import { getDb } from "@/db";
import { jsonError } from "@/http";
import * as s from "@/db/schema";
import { liveInsights, refreshLiveTail } from "@/live-insights";
import { visibleMeeting } from "@/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Running notes for a meeting in progress (also works after it ends). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return jsonError(400, "bad meeting id");
  const me = await requestUser(req, "ingest");
  if (!me) return jsonError(401, "no workspace session");
  const m = await visibleMeeting(id.data, me.id);
  if (!m) return jsonError(404, "meeting not found");
  const db = getDb();
  // Notes run on the owner's model (their key, else the server's), like the rest of the pipeline.
  const owner = await db.query.meetings.findFirst({ where: eq(s.meetings.id, id.data), columns: { ownerId: true } });
  const [insights, llm] = await Promise.all([liveInsights(db, id.data), llmForUser(db, owner!.ownerId)]);
  // While the call runs, bring the AI notes up to the latest lines in the background (throttled to ~30s).
  if (m.status === "live" && llm) after(() => refreshLiveTail(db, id.data, llm).catch((e) => console.error(`live tail ${id.data}:`, e instanceof Error ? e.message : e)));
  return Response.json({ ...insights, hasModel: !!llm }, { headers: { "cache-control": "no-store" } });
}
