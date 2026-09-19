import { after } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { badRequest, errorResponse, jsonError } from "@/http";
import { drainMeeting } from "@/jobs";
import { appendLines, endCall, ingestSchema, startMic, startSimulation } from "@/live";
import { requestUser } from "@/auth";
import { visibleMeeting } from "@/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Live call simulation: start a replay, append line batches, end the call. */
export async function POST(req: Request) {
  const parsed = ingestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error);
  const input = parsed.data;
  const db = getDb();
  try {
    // Session cookie (browser) or `Bearer parley_pat_…` with the ingest scope (scripts, capture extension).
    const me = await requestUser(req, "ingest");
    if (!me) return jsonError(401, "no workspace session or valid ingest token");
    if (input.op === "start" || input.op === "start_mic") {
      return Response.json(input.op === "start" ? await startSimulation(db, me.id, input) : await startMic(db, me, input), { status: 201 });
    }
    const result = input.op === "append" ? await appendLines(db, me.id, input) : await endCall(db, me.id, input);
    // Window processing runs after the response is sent; the client never waits on the model.
    if (result.queued > 0) {
      after(async () => {
        const r = await drainMeeting(db, input.meetingId);
        if (r.error) console.error(`drain ${input.meetingId}: ${r.error}`);
      });
    }
    return Response.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}

/** Poll call state and processing progress. */
export async function GET(req: Request) {
  const id = z.uuid().safeParse(new URL(req.url).searchParams.get("meetingId"));
  if (!id.success) return badRequest(id.error);
  const me = await requestUser(req, "ingest");
  if (!me) return jsonError(401, "no workspace session or valid ingest token");
  if (!(await visibleMeeting(id.data, me.id))) return jsonError(404, "meeting not found");
  const m = await getDb().query.meetings.findFirst({
    where: (t, { eq }) => eq(t.id, id.data),
    columns: { id: true, status: true, liveClockMs: true, liveSpeed: true, durationMs: true },
    with: { jobs: { columns: { kind: true, status: true, attempts: true, lastError: true } } },
  });
  return m ? Response.json(m) : jsonError(404, "meeting not found");
}
