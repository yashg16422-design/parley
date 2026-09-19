import { z } from "zod";
import { getDb } from "@/db";
import { badRequest, errorResponse, jsonError } from "@/http";
import { requestUser } from "@/auth";
import { llmFor } from "@/jobs";
import { visibleMeeting } from "@/queries";
import { HttpError } from "@/live";
import { resolveSummary } from "@/summaries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const query = z.object({ meetingId: z.uuid(), templateId: z.string().min(1).max(64).optional() });

/**
 * Stream a meeting summary as NDJSON: `meta` (source: cache | live | simulated),
 * then one `section` per template section, then `done` (or `error`).
 */
export async function GET(req: Request) {
  const q = query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!q.success) return badRequest(q.error);
  const db = getDb();
  const me = await requestUser(req, "ingest");
  if (!me) return jsonError(401, "no workspace session");
  if (!(await visibleMeeting(q.data.meetingId, me.id))) return jsonError(404, "meeting not found");
  const meeting = await db.query.meetings.findFirst({ where: (t, { eq }) => eq(t.id, q.data.meetingId), columns: { defaultTemplateId: true } });
  if (!meeting) return jsonError(404, "meeting not found");
  const templateId = q.data.templateId ?? meeting.defaultTemplateId;
  const llm = await llmFor(db, q.data.meetingId);

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(c) {
      const send = (o: object) => c.enqueue(enc.encode(`${JSON.stringify(o)}\n`));
      send({ type: "start", templateId, model: llm ? "available" : "none" });
      try {
        const r = await resolveSummary(db, q.data.meetingId, templateId, llm);
        send({ type: "meta", source: r.source, model: r.model, ...(r.note ? { note: r.note } : {}) });
        for (const section of r.content.sections) send({ type: "section", section });
        send({ type: "done" });
      } catch (e) {
        const res = errorResponse(e);
        send({ type: "error", status: res.status, message: e instanceof HttpError ? e.message : "internal error" });
      } finally {
        c.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
