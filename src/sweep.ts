import { and, count, eq, lt, sql } from "drizzle-orm";
import type { Database } from "./db";
import * as s from "./db/schema";
import { syncIcs } from "./calendar/ics";
import { drainMeeting } from "./jobs";
import { endCall } from "./live";
import { notifyMeeting } from "./live-bus";

const rows = <T>(r: unknown) => (r as { rows: T[] }).rows;

/**
 * Background repair, run by cron. Each step is idempotent and safe to overlap:
 *  1. jobs whose worker died (lock expired) go back to the queue, or fail when out of attempts
 *  2. live calls silent for `staleMs`: ended (so notes still get written) if anything was said, else abandoned
 *  3. meetings stuck in processing with a permanently failed job are marked failed
 *  4. due jobs are drained, oldest first, within a time budget
 */
export async function sweep(db: Database, { staleMs = 30 * 60_000, budgetMs = 45_000, maxMeetings = 10 } = {}) {
  const t0 = Date.now();
  const reclaimed = rows<{ id: string; status: string }>(await db.execute(sql`
    UPDATE processing_jobs
    SET status = CASE WHEN attempts >= max_attempts THEN 'failed'::job_status ELSE 'queued'::job_status END,
        locked_until = NULL, last_error = coalesce(last_error, 'worker stopped before finishing (lock expired)'), updated_at = now()
    WHERE status = 'running' AND locked_until < now()
    RETURNING id, status`));

  const cutoff = new Date(Date.now() - staleMs);
  const stale = await db.select({ id: s.meetings.id, ownerId: s.meetings.ownerId, clockMs: s.meetings.liveClockMs, durationMs: s.meetings.durationMs })
    .from(s.meetings)
    .where(and(eq(s.meetings.status, "live"), lt(sql`coalesce(${s.meetings.liveUpdatedAt}, ${s.meetings.startedAt}, ${s.meetings.createdAt})`, cutoff)));
  let ended = 0, abandoned = 0;
  for (const m of stale) {
    const [{ n }] = (await db.select({ n: count() }).from(s.transcriptSegments).where(eq(s.transcriptSegments.meetingId, m.id))) as [{ n: number }];
    if (n > 0) {
      await endCall(db, m.ownerId, { op: "end", meetingId: m.id, clockMs: Math.max(m.clockMs ?? 0, m.durationMs) }).then(() => ended++, () => {});
    } else {
      await db.update(s.meetings).set({ status: "abandoned", endedAt: new Date() }).where(and(eq(s.meetings.id, m.id), eq(s.meetings.status, "live")));
      notifyMeeting(m.id), abandoned++;
    }
  }

  const failed = rows<{ id: string }>(await db.execute(sql`
    UPDATE meetings m SET status = 'failed', updated_at = now()
    WHERE m.status = 'processing'
      AND EXISTS (SELECT 1 FROM processing_jobs j WHERE j.meeting_id = m.id AND j.status = 'failed')
      AND NOT EXISTS (SELECT 1 FROM processing_jobs j WHERE j.meeting_id = m.id AND j.status IN ('queued', 'running'))
    RETURNING m.id`));
  failed.forEach((m) => notifyMeeting(m.id));

  const due = rows<{ meeting_id: string }>(await db.execute(sql`
    SELECT meeting_id FROM processing_jobs WHERE status = 'queued' AND run_after <= now()
    GROUP BY meeting_id ORDER BY min(created_at) LIMIT ${maxMeetings}`));
  let drained = 0;
  for (const { meeting_id } of due) {
    if (Date.now() - t0 > budgetMs) break;
    const r = await drainMeeting(db, meeting_id);
    if (!r.error) drained++;
  }
  // 5. Calendar feeds not refreshed in the last hour (budget permitting).
  const feeds = await db.select({ userId: s.calendarConnections.userId }).from(s.calendarConnections)
    .where(and(eq(s.calendarConnections.provider, "ics"), lt(sql`coalesce(${s.calendarConnections.lastSyncedAt}, 'epoch')`, new Date(Date.now() - 3_600_000))))
    .limit(25);
  let syncedFeeds = 0;
  for (const f of feeds) {
    if (Date.now() - t0 > budgetMs) break;
    await syncIcs(db, f.userId).then(() => syncedFeeds++, () => {});
  }
  // 6. "Try now" workspaces past their 24 hours: the user row cascades to everything they recorded.
  const expired = rows<{ id: string }>(await db.execute(sql`DELETE FROM users WHERE kind = 'guest' AND expires_at < now() RETURNING id`));
  return { expiredGuests: expired.length, syncedFeeds, reclaimedJobs: reclaimed.length, endedStaleCalls: ended, abandonedCalls: abandoned, failedMeetings: failed.length, drainedMeetings: drained, pendingMeetings: due.length - drained, ms: Date.now() - t0 };
}
