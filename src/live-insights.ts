import { asc, desc, eq, sql } from "drizzle-orm";
import { extractiveNotes } from "./ai/extractive";
import { emptyReport, groundActions, groundCited, modelChunkNotes } from "./ai/ground";
import { completeJson, type LlmClient } from "./ai/llm";
import { chunkPrompt } from "./ai/prompts";
import { formatLine, type Seg } from "./ai/windows";
import type { ChunkNotes } from "./db/json-types";
import type { Database } from "./db";
import * as s from "./db/schema";

/**
 * Notes for a call that is still going. Closed ~10-minute windows use the AI
 * notes the pipeline already wrote for them (chunk_notes); the open tail since
 * the last processed window gets AI notes refreshed every ~30s (live_tail_notes)
 * when a model is connected; only lines newer than that refresh, or the whole
 * call without a model, use the rule-based extractor. Every item points at the
 * line it came from.
 */
export type Insight = { text: string; startMs: number; seq: number; by: "ai" | "rules"; owner?: string | null };
export type LiveInsights = {
  source: "ai" | "rules" | "mixed";
  aiWindows: number;
  aiUntilMs: number;
  lines: number;
  /** Set by the route: whether the owner has any model (their key or the server's). */
  hasModel?: boolean;
  topics: (Insight & { title: string })[];
  decisions: Insight[];
  questions: Insight[];
  actions: Insight[];
};

export async function liveInsights(db: Database, meetingId: string): Promise<LiveInsights> {
  const [segs, chunks, [tailRow]] = await Promise.all([
    db.select().from(s.transcriptSegments).where(eq(s.transcriptSegments.meetingId, meetingId)).orderBy(asc(s.transcriptSegments.seq)) as Promise<Seg[]>,
    db.select().from(s.chunkNotes).where(eq(s.chunkNotes.meetingId, meetingId)).orderBy(desc(s.chunkNotes.createdAt)),
    db.select().from(s.liveTailNotes).where(eq(s.liveTailNotes.meetingId, meetingId)),
  ]);
  const bySeq = new Map(segs.map((x) => [x.seq, x]));
  // Only the newest pipeline version's windows (a model switch starts a new version).
  const version = chunks[0]?.promptVersion;
  const windows = chunks.filter((c) => c.promptVersion === version).sort((a, b) => a.chunkIdx - b.chunkIdx);
  const at = (seqs: number[]) => {
    const seg = seqs.map((q) => bySeq.get(q)).find(Boolean);
    return seg ? { startMs: seg.startMs, seq: seg.seq } : null;
  };
  const out: LiveInsights = { source: "rules", aiWindows: windows.length, aiUntilMs: 0, lines: segs.length, topics: [], decisions: [], questions: [], actions: [] };

  let coveredSeq = -1;
  for (const w of windows) {
    coveredSeq = Math.max(coveredSeq, w.lastSeq), (out.aiUntilMs = Math.max(out.aiUntilMs, w.endMs));
    for (const t of w.notes.topics) { const p = at(t.seqs); if (p) out.topics.push({ ...p, title: t.title, text: t.summary, by: "ai" }); }
    for (const d of w.notes.decisions) { const p = at(d.seqs); if (p) out.decisions.push({ ...p, text: d.text, by: "ai" }); }
    for (const q of w.notes.openQuestions) { const p = at(q.seqs); if (p) out.questions.push({ ...p, text: q.text, by: "ai" }); }
    for (const a of w.notes.actionItemCandidates) { const p = at(a.seqs); if (p) out.actions.push({ ...p, text: a.text, owner: a.owner, by: "ai" }); }
  }
  // AI notes for the open end of the call, minus anything a closed window now covers.
  let aiTail: { first: number; last: number } | null = null;
  if (tailRow?.notes && tailRow.lastSeq > coveredSeq) {
    aiTail = { first: tailRow.firstSeq, last: tailRow.lastSeq };
    const add = (seqs: number[]) => (seqs.some((q) => q > coveredSeq) ? at(seqs.filter((q) => q > coveredSeq)) : null);
    for (const t of tailRow.notes.topics) { const p = add(t.seqs); if (p) out.topics.push({ ...p, title: t.title, text: t.summary, by: "ai" }); }
    for (const d of tailRow.notes.decisions) { const p = add(d.seqs); if (p) out.decisions.push({ ...p, text: d.text, by: "ai" }); }
    for (const q of tailRow.notes.openQuestions) { const p = add(q.seqs); if (p) out.questions.push({ ...p, text: q.text, by: "ai" }); }
    for (const a of tailRow.notes.actionItemCandidates) { const p = add(a.seqs); if (p) out.actions.push({ ...p, text: a.text, owner: a.owner, by: "ai" }); }
    const lastSeg = bySeq.get(tailRow.lastSeq);
    if (lastSeg) out.aiUntilMs = Math.max(out.aiUntilMs, lastSeg.endMs);
  }
  const tail = segs.filter((x) => x.seq > coveredSeq && !(aiTail && x.seq >= aiTail.first && x.seq <= aiTail.last));
  if (tail.length) {
    const r = extractiveNotes(tail);
    const cite = (x: { text: string; seqs: number[] }) => ({ ...at(x.seqs)!, text: x.text, by: "rules" as const });
    out.decisions.push(...r.knowledge.decisions.map(cite));
    out.questions.push(...r.knowledge.openQuestions.map(cite));
    out.actions.push(...r.actions.map((a) => ({ ...cite(a), owner: a.owner })));
  }
  out.source = windows.length || aiTail ? (tail.length ? "mixed" : "ai") : "rules";
  return out;
}

/** Newest lines sent per tail refresh (older open lines stay rule-based until their window closes). */
const TAIL_MAX_LINES = 160;
const TAIL_EVERY = "30 seconds";

/**
 * Refresh the AI notes for a live call's open end. Cheap to call often: it
 * returns early unless there are new lines and 30s have passed, and the claim
 * is atomic so two instances never pay for the same refresh.
 */
export async function refreshLiveTail(db: Database, meetingId: string, llm: LlmClient) {
  const m = await db.query.meetings.findFirst({ where: eq(s.meetings.id, meetingId), columns: { title: true, status: true }, with: { participants: { columns: { name: true } } } });
  if (m?.status !== "live") return "not live";
  const [segs, [last]] = await Promise.all([
    db.select().from(s.transcriptSegments).where(eq(s.transcriptSegments.meetingId, meetingId)).orderBy(asc(s.transcriptSegments.seq)) as Promise<Seg[]>,
    db.select({ lastSeq: sql<number>`max(${s.chunkNotes.lastSeq})` }).from(s.chunkNotes).where(eq(s.chunkNotes.meetingId, meetingId)),
  ]);
  const covered = last?.lastSeq ?? -1;
  const open = segs.filter((x) => x.seq > covered).slice(-TAIL_MAX_LINES);
  if (open.length < 3) return "too short";
  const [row] = await db.select().from(s.liveTailNotes).where(eq(s.liveTailNotes.meetingId, meetingId));
  if (row && row.lastSeq >= open.at(-1)!.seq) return "up to date";

  const claimed = await db.execute(sql`
    INSERT INTO live_tail_notes (meeting_id, claimed_at) VALUES (${meetingId}, now())
    ON CONFLICT (meeting_id) DO UPDATE SET claimed_at = now() WHERE live_tail_notes.claimed_at < now() - ${TAIL_EVERY}::interval
    RETURNING meeting_id`);
  if (!(claimed as unknown as { rows: unknown[] }).rows.length) return "refreshed recently";

  const lead = segs.filter((x) => x.seq < open[0]!.seq).slice(-3);
  const raw = await completeJson(llm, chunkPrompt({ title: m.title, participants: m.participants.map((p) => p.name), window: "the latest part (the call is still going)", lines: [...lead, ...open].map(formatLine).join("\n") }), modelChunkNotes);
  const allowed = new Map(open.map((x) => [x.seq, x]));
  const r = emptyReport();
  const notes: ChunkNotes = {
    topics: groundCited(raw.topics, allowed, r),
    decisions: groundCited(raw.decisions, allowed, r),
    actionItemCandidates: groundActions(raw.actionItemCandidates, allowed, r).map(({ verified: _, ...a }) => a),
    openQuestions: groundCited(raw.openQuestions, allowed, r),
    notableMoments: groundCited(raw.notableMoments, allowed, r),
  };
  await db.update(s.liveTailNotes).set({ firstSeq: open[0]!.seq, lastSeq: open.at(-1)!.seq, notes, model: llm.model }).where(eq(s.liveTailNotes.meetingId, meetingId));
  return "refreshed";
}
