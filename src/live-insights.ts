import { asc, desc, eq } from "drizzle-orm";
import { extractiveNotes } from "./ai/extractive";
import type { Seg } from "./ai/windows";
import type { Database } from "./db";
import * as s from "./db/schema";

/**
 * Notes for a call that is still going. Closed ~10-minute windows use the AI
 * notes the pipeline already wrote for them (chunk_notes); the open tail since
 * the last processed window, or the whole call when no model is connected, uses
 * the rule-based extractor. Every item points at the line it came from.
 */
export type Insight = { text: string; startMs: number; seq: number; by: "ai" | "rules"; owner?: string | null };
export type LiveInsights = {
  source: "ai" | "rules" | "mixed";
  aiWindows: number;
  aiUntilMs: number;
  lines: number;
  topics: (Insight & { title: string })[];
  decisions: Insight[];
  questions: Insight[];
  actions: Insight[];
};

export async function liveInsights(db: Database, meetingId: string): Promise<LiveInsights> {
  const [segs, chunks] = await Promise.all([
    db.select().from(s.transcriptSegments).where(eq(s.transcriptSegments.meetingId, meetingId)).orderBy(asc(s.transcriptSegments.seq)) as Promise<Seg[]>,
    db.select().from(s.chunkNotes).where(eq(s.chunkNotes.meetingId, meetingId)).orderBy(desc(s.chunkNotes.createdAt)),
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
  const tail = segs.filter((x) => x.seq > coveredSeq);
  if (tail.length) {
    const r = extractiveNotes(tail);
    const cite = (x: { text: string; seqs: number[] }) => ({ ...at(x.seqs)!, text: x.text, by: "rules" as const });
    out.decisions.push(...r.knowledge.decisions.map(cite));
    out.questions.push(...r.knowledge.openQuestions.map(cite));
    out.actions.push(...r.actions.map((a) => ({ ...cite(a), owner: a.owner })));
  }
  out.source = windows.length ? (tail.length ? "mixed" : "ai") : "rules";
  return out;
}
