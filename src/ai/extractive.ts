/**
 * Rule-based notes for meetings with no model and no seeded outputs (e.g. a mic
 * recording without HF_TOKEN). Every item quotes the line it came from, so it is
 * grounded by construction. Stored as "simulated" so a real model replaces it.
 */
import type { MeetingKnowledge } from "../db/json-types";
import { planWindows, type Seg } from "./windows";

const sentences = (s: Seg) => s.text.split(/(?<=[.!?])\s+/).map((t) => t.trim()).filter((t) => t.split(/\s+/).length >= 4);
const COMMIT = /\b(i'll|i will|i'm going to|we'll|we will|let me|i can take|i'll take)\b/i;
const DECIDE = /\b(decided|agreed|let's go with|we're going with|decision is|let's do)\b/i;

export function extractiveNotes(segs: Seg[]) {
  const said = segs.flatMap((s) => sentences(s).map((t) => ({ s, t })));
  const cite = (x: { s: Seg; t: string }) => ({ text: x.t, seqs: [x.s.seq] });
  const actions = said.filter((x) => COMMIT.test(x.t)).slice(0, 15).map((x) => ({
    text: x.t.replace(/^(so|okay|and|yes|yeah),?\s+/i, "").replace(/^./, (c) => c.toUpperCase()),
    owner: /\bwe\b/i.test(x.t.match(COMMIT)![0]) ? null : x.s.speakerName,
    quote: x.t,
    seqs: [x.s.seq],
    startMs: x.s.startMs,
  }));
  const talk = new Map<string, number>();
  for (const s of segs) talk.set(s.speakerName, (talk.get(s.speakerName) ?? 0) + s.endMs - s.startMs);
  const total = [...talk.values()].reduce((a, b) => a + b, 0) || 1;
  const mins = Math.max(1, Math.round((segs.at(-1)?.endMs ?? 0) / 60_000));
  const knowledge: MeetingKnowledge = {
    overview: `${mins}-minute conversation with ${[...talk.keys()].join(", ")}. ${actions.length} commitment${actions.length === 1 ? "" : "s"} noted. (Rule-based notes: add HF_TOKEN for AI summaries.)`,
    topics: planWindows(segs).map((w) => {
      const first = said.find((x) => x.s.seq >= w.firstSeq && x.s.seq <= w.lastSeq);
      return { title: `From ${Math.floor(w.startMs / 60_000)}:${String(Math.floor(w.startMs / 1000) % 60).padStart(2, "0")}`, summary: first?.t ?? "", startMs: w.startMs, endMs: w.endMs, seqs: first ? [first.s.seq] : [w.firstSeq] };
    }),
    decisions: said.filter((x) => DECIDE.test(x.t)).slice(0, 8).map(cite),
    openQuestions: said.filter((x) => x.t.endsWith("?") && x.t.split(/\s+/).length >= 6).slice(0, 6).map(cite),
    speakerContributions: [...talk].map(([speaker, ms]) => ({ speaker, summary: `${Math.round((ms / total) * 100)}% of talk time` })),
  };
  return { knowledge, actions };
}
