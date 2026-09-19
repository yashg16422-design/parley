import { and, asc, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { badRequest, jsonError } from "@/http";
import { onMeeting } from "@/live-bus";
import { visibleMeeting } from "@/queries";
import { currentUserId } from "@/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const POLL_MS = 2_000;
const PING_MS = 15_000;
/** Close before the function limit; EventSource reconnects with Last-Event-ID and resumes. */
const LIFETIME_MS = 270_000;
const DONE = new Set(["ready", "failed"]);

/**
 * Server-Sent Events for one meeting: `lines` (new transcript rows, id = last seq)
 * and `status`. Every event is read from Postgres, so any instance can serve any
 * watcher. The ingest route's wake-up makes same-instance delivery immediate; the
 * poll covers the rest.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = z.uuid().safeParse(url.searchParams.get("meetingId"));
  if (!id.success) return badRequest(id.error);
  const uid = await currentUserId();
  const meeting = uid && /^[0-9a-f-]{36}$/.test(uid) ? await visibleMeeting(id.data, uid) : undefined;
  if (!meeting) return jsonError(uid ? 404 : 401, uid ? "meeting not found" : "no workspace session");

  const db = getDb();
  const meetingId = id.data;
  let lastSeq = Number(req.headers.get("last-event-id") ?? url.searchParams.get("after") ?? -1);
  if (!Number.isInteger(lastSeq)) lastSeq = -1;
  let lastStatus = "";
  const enc = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(ctrl) {
      let closed = false, running = false, again = false;
      const send = (chunk: string) => !closed && ctrl.enqueue(enc.encode(chunk));
      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(poll), clearInterval(ping), clearTimeout(life), off();
        try { ctrl.close(); } catch { /* already closed by the client */ }
      };
      const pump = async () => {
        if (running) return void (again = true);
        running = true;
        try {
          do {
            again = false;
            const [segs, m] = await Promise.all([
              db.select({ seq: s.transcriptSegments.seq, participantId: s.transcriptSegments.participantId, speakerName: s.transcriptSegments.speakerName, startMs: s.transcriptSegments.startMs, endMs: s.transcriptSegments.endMs, text: s.transcriptSegments.text })
                .from(s.transcriptSegments)
                .where(and(eq(s.transcriptSegments.meetingId, meetingId), gt(s.transcriptSegments.seq, lastSeq)))
                .orderBy(asc(s.transcriptSegments.seq))
                .limit(500),
              db.query.meetings.findFirst({ where: eq(s.meetings.id, meetingId), columns: { status: true, liveClockMs: true, durationMs: true } }),
            ]);
            if (segs.length) {
              lastSeq = segs.at(-1)!.seq;
              send(`id: ${lastSeq}\nevent: lines\ndata: ${JSON.stringify(segs)}\n\n`);
              if (segs.length === 500) again = true;
            }
            if (!m) return close();
            if (m.status !== lastStatus) {
              lastStatus = m.status;
              send(`event: status\ndata: ${JSON.stringify(m)}\n\n`);
            }
            if (DONE.has(m.status) && !again) return close();
          } while (again && !closed);
        } catch (e) {
          console.error(`sse ${meetingId}:`, e);
        } finally {
          running = false;
        }
      };
      const poll = setInterval(pump, POLL_MS);
      const ping = setInterval(() => send(": ping\n\n"), PING_MS);
      const life = setTimeout(close, LIFETIME_MS);
      const off = onMeeting(meetingId, () => void pump());
      req.signal.addEventListener("abort", close);
      send("retry: 2000\n\n");
      void pump();
    },
  });
  return new Response(stream, {
    headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform", connection: "keep-alive", "x-accel-buffering": "no" },
  });
}
