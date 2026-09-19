import { eq, inArray, sql } from "drizzle-orm";
import { applyExtractiveOutputs, applySimulatedOutputs } from "./ai/simulated";
import { hfClient, type LlmClient } from "./ai/llm";
import { processMeeting, processWindows } from "./ai/pipeline";
import type { Database } from "./db";
import * as s from "./db/schema";
import { resolveKey } from "./keys";
import { notifyMeeting } from "./live-bus";

const rows = <T>(r: unknown) => (r as { rows: T[] }).rows;

/** The live model for a meeting: its owner's own HF key, else the server's, else null (simulated outputs). */
export async function llmFor(db: Database, meetingId: string): Promise<LlmClient | null> {
  const m = await db.query.meetings.findFirst({ where: eq(s.meetings.id, meetingId), columns: { ownerId: true } });
  const k = await resolveKey(db, m?.ownerId, "huggingface");
  return k ? hfClient({ token: k.key }) : null;
}

/**
 * Claim this meeting's queued jobs (SKIP LOCKED, so concurrent drains never
 * double-claim) and run them. Chunk jobs share one processWindows call, which
 * only pays for windows that don't have notes yet; a merge job finishes the
 * meeting. Failures are re-queued with backoff until max_attempts.
 */
export async function drainMeeting(db: Database, meetingId: string, llmOverride?: LlmClient | null) {
  const llm = llmOverride === undefined ? await llmFor(db, meetingId) : llmOverride;
  const claimed = rows<{ id: string; kind: string }>(
    await db.execute(sql`
      UPDATE processing_jobs SET status = 'running', attempts = attempts + 1, locked_until = now() + interval '5 minutes', updated_at = now()
      WHERE id IN (
        SELECT id FROM processing_jobs
        WHERE meeting_id = ${meetingId} AND status = 'queued' AND run_after <= now()
        ORDER BY created_at FOR UPDATE SKIP LOCKED)
      RETURNING id, kind`),
  );
  if (!claimed.length) return { ran: 0 };
  const ids = claimed.map((j) => j.id);
  const final = claimed.some((j) => j.kind === "merge_knowledge");
  const t0 = Date.now();
  try {
    if (!llm) {
      if (final) {
        if (!(await applySimulatedOutputs(db, meetingId)).copied) await applyExtractiveOutputs(db, meetingId);
        await db.update(s.meetings).set({ status: "ready" }).where(eq(s.meetings.id, meetingId));
      }
    } else if (final) await processMeeting(db, meetingId, { llm });
    else await processWindows(db, meetingId, { llm }, false);
    await db.update(s.processingJobs)
      .set({ status: "succeeded", durationMs: Date.now() - t0, lastError: llm ? null : "no HF_TOKEN: simulated", lockedUntil: null })
      .where(inArray(s.processingJobs.id, ids));
    if (final) notifyMeeting(meetingId);
    return { ran: ids.length, simulated: !llm };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db.execute(sql`
      UPDATE processing_jobs
      SET status = CASE WHEN attempts >= max_attempts THEN 'failed'::job_status ELSE 'queued'::job_status END,
          run_after = now() + (attempts * interval '30 seconds'), last_error = ${msg.slice(0, 500)}, locked_until = NULL, updated_at = now()
      WHERE id IN ${ids}`);
    return { ran: 0, error: msg };
  }
}
