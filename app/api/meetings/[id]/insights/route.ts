import { z } from "zod";
import { requestUser } from "@/auth";
import { getDb } from "@/db";
import { jsonError } from "@/http";
import { liveInsights } from "@/live-insights";
import { visibleMeeting } from "@/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Running notes for a meeting in progress (also works after it ends). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return jsonError(400, "bad meeting id");
  const me = await requestUser(req, "ingest");
  if (!me) return jsonError(401, "no workspace session");
  if (!(await visibleMeeting(id.data, me.id))) return jsonError(404, "meeting not found");
  return Response.json(await liveInsights(getDb(), id.data), { headers: { "cache-control": "no-store" } });
}
