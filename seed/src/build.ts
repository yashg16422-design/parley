/**
 * npm run fixtures:build
 *
 * Compiles the authored sources in seed/src/ into the static JSON fixtures in
 * seed/fixtures/ that `db:seed` loads. Deterministic: same sources -> same
 * bytes, so fixture diffs in git are meaningful.
 *
 * Per meeting it:
 *  1. times every turn from per-speaker speaking rates (seeded PRNG), with
 *     natural gaps, cross-talk overlaps and explicit pauses;
 *  2. splits turns into sentence-level segments, like a transcriber would;
 *  3. optionally stretches the silences between turns (never the speech) to
 *     hit an exact target length, and fails below a 110 wpm realism floor;
 *  4. resolves tags -> seqs for highlights, clips, action items, knowledge and
 *     summaries, and fails the build if an action item's quote isn't grounded;
 *  5. derives the "general" template summary and per-window chunk notes from
 *     the authored knowledge (the same shapes the live AI pipeline produces).
 */
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ChunkNotes, MeetingKnowledge, SummaryContent } from "../../src/db/json-types";
import { datasetSchema, type DatasetInput } from "../../src/db/seed/fixtures";
import { buildRows, countRows } from "../../src/db/seed/seed";
import { isGrounded, wordCount } from "../../src/lib/transcript";
import { type Cited, expandScript, type MeetingSource } from "./dsl";
import { meetings as sources } from "./meetings";
import { templates } from "./templates";
import { eventDetails } from "./event-details";
import { calendarConnections, upcomingEvents, users } from "./workspace";

const OUT = path.resolve("seed/fixtures");
const PROMPT_VERSION = "seed-v1";
const MODEL = "claude-opus-5";
const CHUNK_MS = 10 * 60_000;
const MAX_SEGMENT_WORDS = 28;
/** Below this, a meeting reads as people talking in slow motion - fail the build. */
const MIN_WPM = 110;
/** A non-standup recording must fill at least this share of its calendar slot. */
const MIN_SLOT_FILL = 0.3;
/** Most extra silence we'll insert between turns to hit a target length. */
const MAX_ADDED_GAP_MS = 2500;

// ---------------------------------------------------------------------------
// Deterministic randomness
// ---------------------------------------------------------------------------

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Transcript timing
// ---------------------------------------------------------------------------

interface Seg {
  speaker: number;
  startMs: number;
  endMs: number;
  text: string;
  /** Index of the non-overlapping turn this segment belongs to (for gap stretching). */
  gapIdx: number;
}

/** One segment per sentence, like a transcriber; very short sentences merge forward. */
function splitTurn(text: string): string[] {
  // A sentence ends at .!? (plus closing quotes) followed by whitespace - so "2.0" and "$1.80" stay intact.
  const sentences = text.split(/(?<=[.!?]["')\]]*)\s+/).map((s) => s.trim()).filter(Boolean);
  const chunks: string[] = [];
  let cur = "";
  for (const s of sentences) {
    const joined = cur ? `${cur} ${s}` : s;
    if (cur && wordCount(cur) >= 5 && wordCount(joined) > MAX_SEGMENT_WORDS) {
      chunks.push(cur);
      cur = s;
    } else if (wordCount(joined) < 5) {
      cur = joined;
    } else {
      chunks.push(joined);
      cur = "";
    }
  }
  if (cur) {
    if (chunks.length && wordCount(cur) < 5) chunks[chunks.length - 1] += ` ${cur}`;
    else chunks.push(cur);
  }
  return chunks;
}

function timeScript(m: MeetingSource) {
  const handles = Object.keys(m.participants);
  const rand = mulberry32(hash(m.key));
  const between = (lo: number, hi: number) => lo + rand() * (hi - lo);
  const wpm = handles.map((h) => 138 + (hash(m.participants[h]!.name) % 34));

  const segs: Seg[] = [];
  const turnSeqs = new Map<string, number[]>();
  let cursor = 0;
  let lastText = "";
  let gapIdx = 0;

  for (const line of expandScript(m)) {
    if (!Array.isArray(line)) {
      cursor += line.pause;
      continue;
    }
    const [handle, raw, tag] = line;
    const speaker = handles.indexOf(handle);
    if (speaker < 0) throw new Error(`${m.key}: unknown speaker "${handle}" in: ${raw.slice(0, 40)}`);
    const overlap = raw.startsWith("~");
    const text = raw.replace(/^~\s*/, "");
    const prev = segs.at(-1);

    let start: number;
    if (!(overlap && prev)) gapIdx++;
    if (overlap && prev) {
      start = Math.max(prev.startMs + 300, prev.endMs - between(400, 1200));
    } else {
      const quick = lastText.trimEnd().endsWith("?");
      start = cursor + (quick ? between(200, 650) : between(350, 1300));
    }

    const seqs: number[] = [];
    for (const chunk of splitTurn(text)) {
      const dur = (wordCount(chunk) / wpm[speaker]!) * 60_000 * between(0.92, 1.08) + 250;
      segs.push({ speaker, startMs: start, endMs: start + dur, text: chunk, gapIdx });
      seqs.push(segs.length - 1);
      start += dur + between(60, 220);
    }
    if (tag) {
      if (turnSeqs.has(tag)) throw new Error(`${m.key}: duplicate tag "${tag}"`);
      turnSeqs.set(tag, seqs);
    }
    cursor = Math.max(cursor, segs.at(-1)!.endMs);
    lastText = text;
  }

  // Hit an exact target length by lengthening the silences *between* turns only;
  // speech keeps its natural pace. Cross-talk turns move with the turn they overlap.
  let addedGapMs = 0;
  if (m.targetMinutes) {
    const remaining = m.targetMinutes * 60_000 - 1500 - cursor;
    if (remaining < 0) throw new Error(`${m.key}: script runs ${Math.round(cursor / 60_000)} min, over the ${m.targetMinutes} min target`);
    addedGapMs = remaining / gapIdx;
    if (addedGapMs > MAX_ADDED_GAP_MS) {
      const words = segs.reduce((n, sg) => n + wordCount(sg.text), 0);
      throw new Error(
        `${m.key}: needs ${Math.round(addedGapMs)}ms of extra silence per turn to reach ${m.targetMinutes} min ` +
          `(${words} words); write about ${Math.ceil(((remaining - MAX_ADDED_GAP_MS * gapIdx) / 60_000) * 140)} more words`,
      );
    }
    for (const sg of segs) {
      sg.startMs += addedGapMs * sg.gapIdx;
      sg.endMs += addedGapMs * sg.gapIdx;
    }
  }
  for (const s of segs) {
    s.startMs = Math.round(s.startMs);
    s.endMs = Math.round(s.endMs);
  }
  // Overlaps only ever start after the previous segment started, so seq order == time order.
  segs.forEach((s, i) => {
    if (i && s.startMs < segs[i - 1]!.startMs) throw new Error(`${m.key}: ordering bug at seq ${i}`);
  });
  return { segs, turnSeqs, addedGapMs, handles };
}

// ---------------------------------------------------------------------------
// Compile one meeting
// ---------------------------------------------------------------------------

function compileMeeting(m: MeetingSource) {
  const { segs, turnSeqs, addedGapMs, handles } = timeScript(m);
  const bySeq = new Map(segs.map((s, i) => [i, s]));
  const tag = (t: string) => {
    const seqs = turnSeqs.get(t);
    if (!seqs) throw new Error(`${m.key}: unknown tag "${t}"`);
    return seqs;
  };
  const cite = (c: Cited) => (typeof c === "string" ? { text: c, seqs: [] } : { text: c[0], seqs: c.slice(1).flatMap(tag) });
  const nameOf = (h: string) => {
    const p = m.participants[h];
    if (!p) throw new Error(`${m.key}: unknown participant "${h}"`);
    return p.name;
  };
  const emailOf = (h: string | undefined) => (h ? (m.participants[h]?.user ?? undefined) : undefined);
  const durationMs = segs.at(-1) ? Math.max(...segs.map((s) => s.endMs)) : 0;

  // Action items: narrow each citation to the fewest segments that contain the quote.
  const actionItems = (m.actionItems ?? []).map((a) => {
    const turn = tag(a.at);
    let seqs: number[] | undefined = turn.map((q) => [q]).find((c) => isGrounded(bySeq, c, a.quote));
    for (let i = 0; !seqs && i < turn.length - 1; i++) {
      const pair = [turn[i]!, turn[i + 1]!];
      if (isGrounded(bySeq, pair, a.quote)) seqs = pair;
    }
    if (!seqs && isGrounded(bySeq, turn, a.quote)) seqs = turn;
    if (!seqs) throw new Error(`${m.key}: quote not found in turn "${a.at}": "${a.quote}"`);
    return {
      text: a.text,
      assignee: a.owner === null ? null : handles.indexOf(a.owner),
      ownerName: a.owner === null ? null : nameOf(a.owner),
      dueDate: a.due,
      dueText: a.dueText,
      status: a.status ?? "open",
      origin: "ai" as const,
      sourceSeqs: seqs,
      evidenceQuote: a.quote,
    };
  });
  const manual = (m.manualActionItems ?? []).map((a) => ({
    text: a.text,
    assignee: a.owner === null ? null : handles.indexOf(a.owner),
    ownerName: a.owner === null ? null : nameOf(a.owner),
    dueDate: a.due,
    dueText: undefined,
    status: a.status ?? "open",
    origin: "manual" as const,
    sourceSeqs: [] as number[],
    evidenceQuote: undefined,
  }));
  for (const a of [...actionItems, ...manual]) if (a.assignee === -1) throw new Error(`${m.key}: bad action owner`);

  const knowledge: MeetingKnowledge = {
    overview: m.knowledge.overview,
    topics: m.knowledge.topics.map((t) => {
      const from = tag(t.from);
      const to = tag(t.to);
      return {
        title: t.title,
        summary: t.summary,
        startMs: bySeq.get(from[0]!)!.startMs,
        endMs: bySeq.get(to.at(-1)!)!.endMs,
        seqs: [...new Set([from[0]!, to.at(-1)!])],
      };
    }),
    decisions: m.knowledge.decisions.map(cite),
    openQuestions: m.knowledge.openQuestions.map(cite),
    speakerContributions: Object.entries(m.knowledge.speakerContributions).map(([h, summary]) => ({
      speaker: nameOf(h),
      summary,
    })),
  };

  // Summaries: "general" is a rendering of the knowledge record; others are hand-written.
  const summaries: { templateId: string; content: SummaryContent }[] = [];
  const general = templates.find((t) => t.id === "general")!;
  const generalItems: Record<string, { text: string; seqs: number[] }[]> = {
    overview: [{ text: knowledge.overview, seqs: [] }],
    topics: knowledge.topics.map((t) => ({ text: `${t.title}: ${t.summary}`, seqs: t.seqs })),
    decisions: knowledge.decisions,
    next_steps: actionItems.map((a) => ({
      text: `${a.ownerName ?? "Unassigned"}: ${a.text}${a.dueText ? ` (${a.dueText})` : ""}`,
      seqs: a.sourceSeqs,
    })),
    open_questions: knowledge.openQuestions,
  };
  summaries.push({
    templateId: "general",
    content: { sections: general.sections.map((s) => ({ id: s.id, heading: s.heading, items: generalItems[s.id] ?? [] })) },
  });
  for (const [templateId, sections] of Object.entries(m.summaries ?? {})) {
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) throw new Error(`${m.key}: summary for unknown template "${templateId}"`);
    const unknown = Object.keys(sections).filter((id) => !tpl.sections.some((s) => s.id === id));
    if (unknown.length) throw new Error(`${m.key}/${templateId}: unknown sections ${unknown.join(", ")}`);
    const missing = tpl.sections.filter((s) => !sections[s.id]);
    if (missing.length) throw new Error(`${m.key}/${templateId}: missing sections ${missing.map((s) => s.id).join(", ")}`);
    summaries.push({
      templateId,
      content: { sections: tpl.sections.map((s) => ({ id: s.id, heading: s.heading, items: sections[s.id]!.map(cite) })) },
    });
  }

  const highlights = (m.highlights ?? []).map((h) => ({
    atMs: Math.min(bySeq.get(tag(h.at)[0]!)!.startMs + 1200, durationMs),
    label: h.label,
    byEmail: emailOf(h.by) ?? m.owner,
  }));

  const clips = (m.clips ?? []).map((c) => {
    const from = tag(c.from);
    const to = tag(c.to ?? c.from);
    return {
      slug: c.slug,
      title: c.title,
      startMs: Math.max(0, bySeq.get(from[0]!)!.startMs - 400),
      endMs: Math.min(durationMs, bySeq.get(to.at(-1)!)!.endMs + 400),
      byEmail: emailOf(c.by) ?? m.owner,
      viewCount: c.views,
    };
  });

  // Chunk notes per 10-minute window: what the live pipeline stores as stage 1.
  const firstSeqIn = (seqs: number[]) => (seqs.length ? bySeq.get(Math.min(...seqs))!.startMs : -1);
  const chunkNotes = [];
  for (let w = 0; w * CHUNK_MS < durationMs; w++) {
    const lo = w * CHUNK_MS;
    const hi = lo + CHUNK_MS;
    const inWin = (ms: number) => ms >= lo && ms < hi;
    const idx = segs.flatMap((s, i) => (inWin(s.startMs) ? [i] : []));
    if (!idx.length) continue;
    const notes: ChunkNotes = {
      topics: knowledge.topics.filter((t) => inWin(t.startMs)).map((t) => ({ title: t.title, summary: t.summary, seqs: t.seqs })),
      decisions: knowledge.decisions.filter((d) => inWin(firstSeqIn(d.seqs))),
      actionItemCandidates: actionItems
        .filter((a) => inWin(firstSeqIn(a.sourceSeqs)))
        .map((a) => ({ text: a.text, owner: a.ownerName, dueText: a.dueText ?? null, evidenceQuote: a.evidenceQuote, seqs: a.sourceSeqs })),
      openQuestions: knowledge.openQuestions.filter((q) => inWin(firstSeqIn(q.seqs))),
      notableMoments: highlights
        .filter((h) => inWin(h.atMs))
        .map((h) => ({ text: h.label, seqs: [segs.findLastIndex((s) => s.startMs <= h.atMs)] })),
    };
    chunkNotes.push({ firstSeq: idx[0]!, lastSeq: idx.at(-1)!, startMs: bySeq.get(idx[0]!)!.startMs, endMs: Math.min(hi, durationMs), notes });
  }

  const participants = handles.map((h) => {
    const p = m.participants[h]!;
    return { name: p.name, userEmail: p.user, email: p.email, title: p.title, company: p.company, isExternal: p.external ?? false };
  });

  const event = {
    key: m.key,
    userEmail: m.owner,
    title: m.title,
    description: m.description,
    startsAt: m.startedAt,
    durationMin: m.scheduledMin,
    platform: m.platform,
    attendees: participants
      .filter((p) => p.userEmail ?? p.email)
      .map((p) => ({ name: p.name, email: (p.userEmail ?? p.email)!, responseStatus: "accepted" as const, isOrganizer: p.userEmail === m.owner })),
  };

  const fixture = {
    key: m.key,
    ownerEmail: m.owner,
    calendarEventKey: m.key,
    title: m.title,
    meetingType: m.meetingType,
    platform: m.platform,
    status: "ready" as const,
    defaultTemplateId: m.defaultTemplate,
    participants,
    segments: segs.map((s) => [s.speaker, s.startMs, s.endMs, s.text] as [number, number, number, string]),
    highlights,
    actionItems: [...actionItems, ...manual].map(({ ownerName: _, ...a }) => a),
    clips,
    ai: { promptVersion: PROMPT_VERSION, model: MODEL, chunkNotes, knowledge, summaries },
  };

  const words = segs.reduce((n, s) => n + wordCount(s.text), 0);
  const wpm = words / (durationMs / 60_000);
  if (wpm < MIN_WPM) throw new Error(`${m.key}: ${Math.round(wpm)} words/min is below the ${MIN_WPM} realism floor`);
  const fill = durationMs / (m.scheduledMin * 60_000);
  if (m.meetingType !== "standup" && fill < MIN_SLOT_FILL) {
    throw new Error(
      `${m.key}: recording is ${(durationMs / 60_000).toFixed(1)} min of a ${m.scheduledMin} min slot (${Math.round(fill * 100)}%); ` +
        `needs about ${Math.ceil(((MIN_SLOT_FILL * m.scheduledMin * 60_000 - durationMs) / 60_000) * wpm)} more words`,
    );
  }
  const report = {
    meeting: m.key,
    speakers: handles.length,
    segments: segs.length,
    words,
    duration: `${Math.floor(durationMs / 60_000)}:${String(Math.round((durationMs % 60_000) / 1000)).padStart(2, "0")}`,
    wpm: Math.round(wpm),
    slotFill: `${Math.round(fill * 100)}%`,
    addedGapMs: Math.round(addedGapMs),
    overlaps: segs.filter((s, i) => i && s.startMs < segs[i - 1]!.endMs).length,
    actions: fixture.actionItems.length,
    summaries: summaries.map((s) => s.templateId).join(","),
  };
  return { fixture, event, report };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const unknownDetails = Object.keys(eventDetails).filter((k) => !sources.some((m) => m.key === k) && !upcomingEvents.some((e) => e.key === k));
  if (unknownDetails.length) throw new Error(`event details for unknown events: ${unknownDetails.join(", ")}`);
  const keys = new Set<string>();
  for (const m of sources) {
    if (keys.has(m.key)) throw new Error(`duplicate meeting key ${m.key}`);
    keys.add(m.key);
  }
  // Compile everything and report every problem at once, not just the first.
  const errors: string[] = [];
  const compiled = sources.flatMap((m) => {
    try {
      return [compileMeeting(m)];
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
      return [];
    }
  });
  if (errors.length) throw new Error(`${errors.length} meeting(s) failed:\n  - ${errors.join("\n  - ")}`);

  const workspace: DatasetInput = {
    users,
    calendarConnections,
    templates,
    calendarEvents: [...compiled.map((c) => c.event), ...upcomingEvents].map((e) => ({ ...e, ...eventDetails[e.key] })),
  };

  // Validate the full dataset exactly as db:seed will, before writing anything.
  const dataset = datasetSchema.parse({ ...workspace, meetings: compiled.map((c) => c.fixture) });
  const counts = countRows(buildRows(dataset));

  await rm(OUT, { recursive: true, force: true });
  await mkdir(path.join(OUT, "meetings"), { recursive: true });
  await writeFile(path.join(OUT, "workspace.json"), JSON.stringify(workspace, null, 2) + "\n");
  for (const c of compiled) {
    await writeFile(path.join(OUT, "meetings", `${c.fixture.key}.json`), JSON.stringify({ meetings: [c.fixture] }) + "\n");
  }

  console.table(compiled.map((c) => c.report));
  console.table(counts);
  console.log(`Wrote seed/fixtures/workspace.json + ${compiled.length} meeting fixtures.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
