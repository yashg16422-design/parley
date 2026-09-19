import { and, asc, count, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { closedWindows, type Seg } from "./ai/windows";
import { notifyMeeting } from "./live-bus";
import type { Database } from "./db";
import * as s from "./db/schema";
import type { MeetingStats } from "./db/json-types";
import { SPEAKER_COLORS } from "./lib/colors";
import { participantTotals, transcriptHash, wordCount } from "./lib/transcript";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const speed = z.int().min(1).max(60);
const ms = z.int().min(0);
export const ingestSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("start"), sourceMeetingId: z.uuid(), speed }),
  /** A real call recorded from the browser mic (Deepgram live STT); participants are who might speak. */
  z.object({
    op: z.literal("start_mic"),
    title: z.string().trim().min(1).max(160),
    participants: z.array(z.string().trim().min(1).max(60)).min(1).max(8),
    calendarEventId: z.uuid().optional(),
    /** Pasted join link's platform, for ad-hoc calls without a calendar event. */
    platform: z.enum(["zoom", "google_meet", "teams"]).optional(),
  }),
  z.object({
    op: z.literal("append"),
    meetingId: z.uuid(),
    clockMs: ms,
    speed,
    /** seq of lines[0]; lets the client resend a batch safely after a network error. */
    fromSeq: ms,
    lines: z.array(z.object({ speakerIdx: z.int().min(0), startMs: ms, endMs: ms, text: z.string().trim().min(1).max(4000) })).min(1).max(200),
  }),
  z.object({ op: z.literal("end"), meetingId: z.uuid(), clockMs: ms }),
  /** Leave without keeping anything: deletes the live call and everything recorded so far. */
  z.object({ op: z.literal("discard"), meetingId: z.uuid() }),
]);
export type IngestInput = z.infer<typeof ingestSchema>;

/** Slack for network jitter when checking the replay clock against wall time. */
const CLOCK_SLACK_MS = 5_000;
/**
 * Requests reach the server unevenly (a slow one, then a fast one), so the
 * wall time between them can undercount the client's by a few seconds. That
 * jitter is wall time, so it scales with speed: at 60x, 3s of jitter is 3 min
 * of meeting clock. A clock that runs away still fails.
 */
const WALL_JITTER_MS = 3_000;

/** Only the meeting's owner may write to it; anyone else gets the same 404 as a missing meeting. */
async function liveMeeting(db: Database, id: string, ownerId: string) {
  const m = await db.query.meetings.findFirst({ where: eq(s.meetings.id, id), with: { participants: true } });
  if (!m || m.ownerId !== ownerId) throw new HttpError(404, "meeting not found");
  if (m.status !== "live") throw new HttpError(409, `meeting is ${m.status}, not live`);
  return m;
}

/** Enqueue one chunk job per closed window (idempotent via the job key). Returns how many were new. */
async function queueWindows(db: Database, meetingId: string, callEnded: boolean) {
  const segs = (await db.select().from(s.transcriptSegments).where(eq(s.transcriptSegments.meetingId, meetingId)).orderBy(asc(s.transcriptSegments.seq))) as Seg[];
  const windows = closedWindows(segs, callEnded);
  const jobs: (typeof s.processingJobs.$inferInsert)[] = windows.map((w) => ({ key: `chunk:${meetingId}:${w.idx}`, meetingId, kind: "chunk_notes" as const, payload: { windowIdx: w.idx } }));
  if (callEnded) jobs.push({ key: `merge:${meetingId}`, meetingId, kind: "merge_knowledge" as const, payload: { windowIdx: -1 } });
  const inserted = jobs.length ? await db.insert(s.processingJobs).values(jobs).onConflictDoNothing().returning({ id: s.processingJobs.id }) : [];
  return { closedWindows: windows.length, queued: inserted.length };
}

/** Start replaying a seeded meeting as a new live call. */
export async function startSimulation(db: Database, ownerId: string, { sourceMeetingId, speed }: Extract<IngestInput, { op: "start" }>) {
  const src = await db.query.meetings.findFirst({ where: eq(s.meetings.id, sourceMeetingId), with: { participants: true } });
  if (!src) throw new HttpError(404, "source meeting not found");
  return db.transaction(async (tx) => {
    const [m] = await tx
      .insert(s.meetings)
      .values({
        ownerId, title: src.title, meetingType: src.meetingType, platform: src.platform, defaultTemplateId: src.defaultTemplateId,
        status: "live", startedAt: new Date(), simulatedFromId: src.id, liveClockMs: 0, liveSpeed: speed, liveUpdatedAt: new Date(),
      })
      .returning({ id: s.meetings.id });
    const participants = await tx
      .insert(s.meetingParticipants)
      .values(src.participants.map(({ id: _, meetingId: __, talkMs: ___, wordCount: ____, ...p }) => ({ ...p, meetingId: m!.id })))
      .returning({ speakerIdx: s.meetingParticipants.speakerIdx, name: s.meetingParticipants.name, color: s.meetingParticipants.color });
    return { meetingId: m!.id, participants: participants.sort((a, b) => a.speakerIdx - b.speakerIdx) };
  });
}

export async function startMic(db: Database, owner: { id: string; name: string; email: string }, input: Extract<IngestInput, { op: "start_mic" }>) {
  const event = input.calendarEventId
    ? await db.query.calendarEvents.findFirst({ where: and(eq(s.calendarEvents.id, input.calendarEventId), eq(s.calendarEvents.userId, owner.id)), with: { meeting: { columns: { id: true } } } })
    : undefined;
  return db.transaction(async (tx) => {
    const [m] = await tx
      .insert(s.meetings)
      .values({
        ownerId: owner.id, title: input.title, platform: event?.platform ?? input.platform ?? "google_meet", status: "live", startedAt: new Date(),
        calendarEventId: event && !event.meeting ? event.id : null, liveClockMs: 0, liveSpeed: 1, liveUpdatedAt: new Date(),
      })
      .returning({ id: s.meetings.id });
    const participants = await tx
      .insert(s.meetingParticipants)
      .values(input.participants.map((name, i) => ({
        meetingId: m!.id, name, speakerIdx: i, color: SPEAKER_COLORS[i % SPEAKER_COLORS.length]!,
        userId: i === 0 ? owner.id : null, email: i === 0 ? owner.email : null,
      })))
      .returning({ id: s.meetingParticipants.id, speakerIdx: s.meetingParticipants.speakerIdx, name: s.meetingParticipants.name, color: s.meetingParticipants.color });
    return { meetingId: m!.id, participants: participants.sort((a, b) => a.speakerIdx - b.speakerIdx) };
  });
}

/**
 * Append a batch of transcript lines. The client owns the replay clock; the
 * server checks it can't run faster than the chosen speed allows, that seqs are
 * contiguous (resends are harmless), and that no line is ahead of the clock.
 */
export async function appendLines(db: Database, ownerId: string, input: Extract<IngestInput, { op: "append" }>, now = new Date()) {
  const m = await liveMeeting(db, input.meetingId, ownerId);
  const prevClock = m.liveClockMs ?? 0;
  const elapsed = now.getTime() - (m.liveUpdatedAt ?? m.startedAt ?? now).getTime();
  const allowed = (elapsed + WALL_JITTER_MS) * Math.max(input.speed, m.liveSpeed ?? 1) + CLOCK_SLACK_MS;
  if (input.clockMs < prevClock) throw new HttpError(409, "clock went backwards");
  if (input.clockMs - prevClock > allowed) throw new HttpError(429, `clock advanced ${input.clockMs - prevClock}ms in ${elapsed}ms of wall time; faster than ${input.speed}x`);
  if (input.lines.some((l, i) => l.endMs < l.startMs || l.endMs > input.clockMs + CLOCK_SLACK_MS || (i > 0 && l.startMs < input.lines[i - 1]!.startMs))) {
    throw new HttpError(422, "lines must be ordered, well-formed and not ahead of the clock");
  }

  const [{ n }] = (await db.select({ n: count() }).from(s.transcriptSegments).where(eq(s.transcriptSegments.meetingId, m.id))) as [{ n: number }];
  if (input.fromSeq > n) throw new HttpError(409, `gap: server has ${n} lines, batch starts at ${input.fromSeq}`);
  const bySpeaker = new Map(m.participants.map((p) => [p.speakerIdx, p]));
  const rows = input.lines.map((l, i) => {
    const p = bySpeaker.get(l.speakerIdx);
    if (!p) throw new HttpError(422, `unknown speakerIdx ${l.speakerIdx}`);
    return { meetingId: m.id, seq: input.fromSeq + i, participantId: p.id, speakerName: p.name, startMs: l.startMs, endMs: l.endMs, text: l.text };
  });
  const inserted = await db.insert(s.transcriptSegments).values(rows).onConflictDoNothing().returning({ seq: s.transcriptSegments.seq });
  await db
    .update(s.meetings)
    .set({ liveClockMs: input.clockMs, liveSpeed: input.speed, liveUpdatedAt: now, durationMs: sql`greatest(${s.meetings.durationMs}, ${Math.max(...rows.map((r) => r.endMs))})` })
    .where(eq(s.meetings.id, m.id));
  if (inserted.length) notifyMeeting(m.id);
  const q = await queueWindows(db, m.id, false);
  return { accepted: inserted.length, nextSeq: Math.max(n, input.fromSeq + rows.length), clockMs: input.clockMs, ...q };
}

/** End the call: compute stats once, move to processing, queue remaining windows + merge. */
export async function endCall(db: Database, ownerId: string, { meetingId, clockMs }: Extract<IngestInput, { op: "end" }>) {
  const m = await liveMeeting(db, meetingId, ownerId);
  const segs = await db.select().from(s.transcriptSegments).where(eq(s.transcriptSegments.meetingId, meetingId)).orderBy(asc(s.transcriptSegments.seq));
  if (!segs.length) throw new HttpError(409, "no transcript to process");
  const totals = participantTotals(segs);
  const durationMs = Math.max(clockMs, ...segs.map((x) => x.endMs));
  const talk = [...totals.values()].reduce((a, t) => a + t.talkMs, 0) || 1;
  const stats: MeetingStats = {
    durationMs,
    segmentCount: segs.length,
    wordCount: segs.reduce((a, x) => a + wordCount(x.text), 0),
    speakerCount: totals.size,
    talkTime: [...totals].map(([participantId, t]) => ({ participantId, talkMs: t.talkMs, share: +(t.talkMs / talk).toFixed(4) })).sort((a, b) => b.talkMs - a.talkMs),
    actionItemCount: 0,
    highlightCount: 0,
  };
  await db.transaction(async (tx) => {
    for (const [participantId, t] of totals) {
      await tx.update(s.meetingParticipants).set({ talkMs: t.talkMs, wordCount: t.wordCount }).where(and(eq(s.meetingParticipants.id, participantId), eq(s.meetingParticipants.meetingId, meetingId)));
    }
    await tx
      .update(s.meetings)
      .set({ status: "processing", endedAt: new Date(), durationMs, liveClockMs: clockMs, stats, transcriptHash: transcriptHash(segs) })
      .where(eq(s.meetings.id, m.id));
  });
  notifyMeeting(meetingId);
  return { segments: segs.length, durationMs, ...(await queueWindows(db, meetingId, true)) };
}

export async function discardCall(db: Database, ownerId: string, { meetingId }: Extract<IngestInput, { op: "discard" }>) {
  const gone = await db.delete(s.meetings).where(and(eq(s.meetings.id, meetingId), eq(s.meetings.ownerId, ownerId), eq(s.meetings.status, "live"))).returning({ id: s.meetings.id });
  if (!gone.length) throw new HttpError(404, "no live call to discard");
  notifyMeeting(meetingId);
  return { discarded: true, queued: 0 };
}
