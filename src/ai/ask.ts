import { sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../db";
import { searchTranscripts, SYNONYMS } from "../search";
import { completeJson, type LlmClient } from "./llm";

/**
 * Ask Parley: a question across every meeting the user can see.
 *  1. retrieve: keywords → the synonym-expanding (ts_rewrite) transcript search, OR-joined so a
 *     natural-language question still matches; capped per meeting for variety
 *  2. context: each hit plus its neighbouring lines, numbered as evidence [1]..[n]
 *  3. answer: the model may only use that evidence and must cite it inline
 *  4. ground: invalid citations are removed and uncited sentences dropped; no model → quotes
 */
const STOP = new Set("a an and are as at be but by can could did do does for from had has have how i in is it its me my of on or our so than that the their them then there these they this to up was we were what when where which who why will with would you your about any all also been get got just like more most much not now only over some such tell very".split(" "));
const MAX_EVIDENCE = 20;
const PER_MEETING = 5;

export type Evidence = {
  n: number; meetingId: string; title: string; startedAt: Date | null;
  seq: number; startMs: number; speakerName: string; text: string; before: string | null; after: string | null;
};
export type AskResult = {
  answer: string;
  citations: (Evidence & { href: string })[];
  source: "ai" | "quotes" | "none";
  model: string | null;
  dropped: number;
};

/** Words people use to ask, not what they ask about: matching them would drown the real terms. */
const ASKING = new Set("make made say said says saying talk talked talking mention mentioned discuss discussed think thought told tell ask asked know knew want wanted going thing things people someone anyone".split(" "));

export function keywords(q: string) {
  const words = q.toLowerCase().replace(/[^\p{L}\p{N}\s'-]/gu, " ").split(/\s+/).map((w) => w.replace(/^'+|'+$/g, ""));
  return [...new Set(words.filter((w) => w.length >= 3 && !STOP.has(w) && !ASKING.has(w)))].slice(0, 8);
}

/**
 * Searches for a question: each known synonym phrase gets its own search (so
 * ts_rewrite expands "single sign-on" to SSO/SAML exactly as the search page
 * does), then the remaining keywords OR-ed so a natural question still matches.
 */
export function retrievalQuery(q: string) {
  let rest = q.toLowerCase();
  const phrases: string[] = [];
  for (const term of SYNONYMS.flat().sort((a, b) => b.length - a.length)) {
    if (new RegExp(`(^|[^\\p{L}])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}])`, "iu").test(rest)) {
      phrases.push(term);
      rest = rest.replace(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), " ");
    }
  }
  const kw = keywords(rest);
  return [...phrases, ...(kw.length ? [kw.join(" or ")] : [])];
}

const rows = <T>(r: unknown) => (r as { rows: T[] }).rows;

export async function gatherEvidence(db: Database, userId: string, question: string): Promise<Evidence[]> {
  const queries = retrievalQuery(question);
  if (!queries.length) return [];
  // Specific phrase matches first, then the broad keyword match; one entry per line.
  const seen = new Set<string>();
  const hits = (await Promise.all(queries.map((q) => searchTranscripts(db, q, { userId, limit: 40 })))).flat()
    .filter((h) => !seen.has(`${h.meetingId}:${h.seq}`) && seen.add(`${h.meetingId}:${h.seq}`));
  const perMeeting = new Map<string, number>();
  const picked = hits.filter((h) => {
    const n = perMeeting.get(h.meetingId) ?? 0;
    if (n >= PER_MEETING) return false;
    perMeeting.set(h.meetingId, n + 1);
    return true;
  }).slice(0, MAX_EVIDENCE);
  if (!picked.length) return [];

  // One query for every hit's line and its neighbours.
  const keys = picked.flatMap((h) => [h.seq - 1, h.seq, h.seq + 1].map((seq) => sql`(${h.meetingId}::uuid, ${seq}::int)`));
  const lines = rows<{ meeting_id: string; seq: number; text: string; speaker_name: string }>(await db.execute(sql`
    SELECT meeting_id, seq, text, speaker_name FROM transcript_segments WHERE (meeting_id, seq) IN (${sql.join(keys, sql`, `)})`));
  const at = (m: string, seq: number) => lines.find((l) => l.meeting_id === m && l.seq === seq);
  return picked.map((h, i) => ({
    n: i + 1, meetingId: h.meetingId, title: h.title, startedAt: h.startedAt ? new Date(h.startedAt) : null,
    seq: h.seq, startMs: h.startMs, speakerName: h.speakerName, text: at(h.meetingId, h.seq)?.text ?? h.parts.map((p) => p.text).join(""),
    before: at(h.meetingId, h.seq - 1) ? `${at(h.meetingId, h.seq - 1)!.speaker_name}: ${at(h.meetingId, h.seq - 1)!.text}` : null,
    after: at(h.meetingId, h.seq + 1) ? `${at(h.meetingId, h.seq + 1)!.speaker_name}: ${at(h.meetingId, h.seq + 1)!.text}` : null,
  }));
}

const clock = (ms: number) => `${Math.floor(ms / 60_000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "undated");

export function askPrompt(question: string, ev: Evidence[]) {
  const block = ev.map((e) => `[${e.n}] "${e.title}" (${day(e.startedAt)}) at ${clock(e.startMs)}\n${e.before ? `   (before) ${e.before}\n` : ""}   ${e.speakerName}: ${e.text}\n${e.after ? `   (after) ${e.after}\n` : ""}`).join("\n");
  return [
    { role: "system" as const, content: "You answer questions about the user's own recorded meetings. Use ONLY the numbered evidence. Put citations like [2] or [1][4] at the end of every sentence, pointing at the evidence that supports it. Name who said what and in which meeting when it matters. If the evidence doesn't answer the question, say so plainly in one sentence with no citation. Be concise: at most 6 sentences. Reply with JSON only: {\"answer\": string}." },
    { role: "user" as const, content: `Question: ${question}\n\nEvidence:\n${block}` },
  ];
}

const NOT_FOUND = "I couldn't find that in your meetings.";

/** Keep only sentences backed by real evidence numbers; strip citations that point nowhere. */
export function groundAnswer(answer: string, ev: Evidence[]) {
  const valid = new Set(ev.map((e) => e.n));
  const sentences = answer.replace(/\s+/g, " ").trim().match(/[^.!?]+[.!?]*(?:\s*\[\d+\])*/g) ?? [];
  let dropped = 0;
  const kept: string[] = [];
  const used = new Set<number>();
  for (const raw of sentences) {
    const s = raw.trim();
    if (!s) continue;
    const cited = [...s.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])).filter((n) => valid.has(n));
    const clean = s.replace(/\[(\d+)\]/g, (m, n) => (valid.has(Number(n)) ? m : "")).replace(/\s+([.!?])/g, "$1").trim();
    if (cited.length) cited.forEach((n) => used.add(n)), kept.push(clean);
    else if (/couldn't find|could not find|doesn't (say|mention|cover)|no (mention|evidence)/i.test(s) && !kept.length) kept.push(clean);
    else dropped++;
  }
  return { answer: kept.join(" ") || NOT_FOUND, used, dropped };
}

export async function ask(db: Database, userId: string, question: string, llm: LlmClient | null): Promise<AskResult> {
  const ev = await gatherEvidence(db, userId, question);
  const link = (e: Evidence) => ({ ...e, href: `/meetings/${e.meetingId}?t=${e.startMs}#line-${e.seq}` });
  if (!ev.length) return { answer: NOT_FOUND, citations: [], source: "none", model: null, dropped: 0 };
  if (!llm) {
    const top = ev.slice(0, 4);
    return {
      answer: `No AI model is connected, so here is what was said: ${top.map((e) => `${e.speakerName} in "${e.title}": “${e.text}” [${e.n}]`).join(" ")}`,
      citations: top.map(link), source: "quotes", model: null, dropped: 0,
    };
  }
  const { answer: raw } = await completeJson(llm, askPrompt(question, ev), z.object({ answer: z.string().min(1).max(4000) }), { maxTokens: 800 });
  const g = groundAnswer(raw, ev);
  return { answer: g.answer, citations: ev.filter((e) => g.used.has(e.n)).map(link), source: "ai", model: llm.model, dropped: g.dropped };
}
