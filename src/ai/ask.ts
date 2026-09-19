import { sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../db";
import { searchEvents, searchTranscripts, SYNONYMS } from "../search";
import { completeJson, type LlmClient } from "./llm";

/**
 * Ask Parley: a question across every meeting the user can see, plus their calendar.
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
  /** Transcript lines by default; "event" = a calendar entry (schedule, not speech). */
  kind?: "event";
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

export function askPrompt(question: string, ev: Evidence[], today?: string) {
  const block = ev.map((e) => e.kind === "event"
    ? `[${e.n}] (calendar) "${e.title}"\n   ${e.text}\n`
    : `[${e.n}] "${e.title}" (${day(e.startedAt)}) at ${clock(e.startMs)}\n${e.before ? `   (before) ${e.before}\n` : ""}   ${e.speakerName}: ${e.text}\n${e.after ? `   (after) ${e.after}\n` : ""}`).join("\n");
  const cal = ev.some((e) => e.kind === "event") ? " Evidence marked (calendar) is the user's schedule (planned meetings, attendees, agendas), not something anyone said: use it for when/who/what's-next questions." : "";
  return [
    { role: "system" as const, content: "You answer questions about the user's own recorded meetings and calendar. Use ONLY the numbered evidence. Put citations like [2] or [1][4] at the end of every sentence, pointing at the evidence that supports it. Name who said what and in which meeting when it matters. If the evidence doesn't answer the question, say so plainly in one sentence with no citation. Be concise: at most 6 sentences. Reply with JSON only: {\"answer\": string}." + cal },
    { role: "user" as const, content: `${today ? `Today is ${today}.\n` : ""}Question: ${question}\n\nEvidence:\n${block}` },
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

/** Questions about the schedule ("what's next", "who's in Thursday's call") get the nearby calendar, not just keyword matches. */
const CALENDARISH = /\b(calendar|schedule[ds]?|upcoming|next|today|tonight|tomorrow|yesterday|(this|next|last) week|mon|tue|wed|thu|fri|sat|sun)(day|sday|nesday|rsday|urday)?\b|\b(when|agenda|invite[ds]?|invitees?|attend(ees?|ing)?|booked|busy|free)\b/i;
const MAX_EVENTS = 12;

function fmtWhen(start: Date, end: Date, tz: string) {
  const f = (d: Date, o: Intl.DateTimeFormatOptions) => { try { return d.toLocaleString("en-US", { ...o, timeZone: tz }); } catch { return d.toLocaleString("en-US", { ...o, timeZone: "UTC" }); } };
  return `${f(start, { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}–${f(end, { hour: "numeric", minute: "2-digit", timeZoneName: "short" })}`;
}

/** Calendar entries relevant to a question: keyword matches (titles, agendas, attachments) plus, for schedule questions, the past week and next two. */
export async function gatherEvents(db: Database, userId: string, question: string, firstN: number, tz = "UTC", now = new Date()): Promise<Evidence[]> {
  const matched = (await Promise.all(retrievalQuery(question).map((q) => searchEvents(db, q, userId, 5)))).flat().map((e) => e.id);
  const around = CALENDARISH.test(question)
    ? rows<{ id: string }>(await db.execute(sql`SELECT id FROM calendar_events WHERE user_id = ${userId}
        AND starts_at BETWEEN ${new Date(now.getTime() - 7 * 86_400_000)} AND ${new Date(now.getTime() + 14 * 86_400_000)} ORDER BY starts_at LIMIT 20`)).map((r) => r.id)
    : [];
  const ids = [...new Set([...matched, ...around])].slice(0, MAX_EVENTS);
  if (!ids.length) return [];
  const events = rows<{ id: string; title: string; starts_at: string; ends_at: string; platform: string; attendees: { name?: string; email: string }[]; agenda: string | null; meeting_id: string | null }>(await db.execute(sql`
    SELECT e.id, e.title, e.starts_at, e.ends_at, e.platform, e.attendees, e.agenda, m.id AS meeting_id
    FROM calendar_events e LEFT JOIN meetings m ON m.calendar_event_id = e.id
    WHERE e.user_id = ${userId} AND e.id IN (${sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)}) ORDER BY e.starts_at`));
  const PLATFORM: Record<string, string> = { zoom: "Zoom", google_meet: "Google Meet", teams: "Teams" };
  return events.map((e, i) => {
    const start = new Date(e.starts_at);
    const who = (e.attendees ?? []).map((a) => a.name || a.email).slice(0, 12).join(", ");
    return {
      kind: "event" as const, n: firstN + i, meetingId: e.meeting_id ?? "", title: e.title, startedAt: start, seq: 0, startMs: 0, speakerName: "Calendar",
      text: [fmtWhen(start, new Date(e.ends_at), tz), PLATFORM[e.platform] ?? e.platform, who && `with ${who}`, e.agenda && `Agenda: ${e.agenda.replace(/\s+/g, " ").slice(0, 400)}`, start < now ? (e.meeting_id ? "recorded" : "past, not recorded") : "upcoming"].filter(Boolean).join(" · "),
      before: null, after: null,
    };
  });
}

export async function ask(db: Database, userId: string, question: string, llm: LlmClient | null, now = new Date()): Promise<AskResult> {
  const tz = rows<{ timezone: string }>(await db.execute(sql`SELECT timezone FROM users WHERE id = ${userId}`))[0]?.timezone ?? "UTC";
  const said = await gatherEvidence(db, userId, question);
  const ev = [...said, ...(await gatherEvents(db, userId, question, said.length + 1, tz, now))];
  const link = (e: Evidence) => ({ ...e, href: e.kind === "event" ? (e.meetingId ? `/meetings/${e.meetingId}` : "/calendar") : `/meetings/${e.meetingId}?t=${e.startMs}#line-${e.seq}` });
  if (!ev.length) return { answer: NOT_FOUND, citations: [], source: "none", model: null, dropped: 0 };
  if (!llm) {
    const top = [...said.slice(0, 4), ...ev.filter((e) => e.kind === "event").slice(0, said.length ? 2 : 4)];
    return {
      answer: `No AI model is connected, so here is what was found: ${top.map((e) => (e.kind === "event" ? `"${e.title}" on your calendar: ${e.text} [${e.n}]` : `${e.speakerName} in "${e.title}": “${e.text}” [${e.n}]`)).join(" ")}`,
      citations: top.map(link), source: "quotes", model: null, dropped: 0,
    };
  }
  let today: string;
  try { today = now.toLocaleString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: tz, timeZoneName: "short" }); } catch { today = now.toUTCString(); }
  const { answer: raw } = await completeJson(llm, askPrompt(question, ev, today), z.object({ answer: z.string().min(1).max(4000) }), { maxTokens: 800 });
  const g = groundAnswer(raw, ev);
  return { answer: g.answer, citations: ev.filter((e) => g.used.has(e.n)).map(link), source: "ai", model: llm.model, dropped: g.dropped };
}
