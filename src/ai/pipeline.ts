import { and, asc, eq } from "drizzle-orm";
import type { Database } from "../db";
import * as s from "../db/schema";
import type { ChunkNotes, MeetingKnowledge, SummaryContent } from "../db/json-types";
import { emptyReport, groundActions, groundCited, type GroundReport, modelChunkNotes, modelMerge, modelSummary } from "./ground";
import { completeJson, type LlmClient } from "./llm";
import { chunkPrompt, mergePrompt, summaryPrompt } from "./prompts";
import { closedWindows, formatLine, type Seg, windowLines } from "./windows";

export const PROMPT_VERSION = "hf-v1";

type Opts = { llm: LlmClient; promptVersion?: string; concurrency?: number };

async function mapLimit<T, R>(xs: T[], n: number, f: (x: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(xs.length);
  let next = 0;
  const worker = async () => {
    while (next < xs.length) {
      const i = next++;
      out[i] = await f(xs[i]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, xs.length) }, worker));
  return out;
}

async function loadMeeting(db: Database, meetingId: string) {
  const m = await db.query.meetings.findFirst({
    where: eq(s.meetings.id, meetingId),
    with: { participants: true, segments: { orderBy: asc(s.transcriptSegments.seq) } },
  });
  if (!m) throw new Error(`meeting ${meetingId} not found`);
  const lines = new Map(m.segments.map((x) => [x.seq, x]));
  return { m, segs: m.segments as Seg[], lines, names: m.participants.map((p) => p.name) };
}

/** Match a model-reported owner name to a participant: exact, then first name. */
function matchOwner(name: string | null, participants: { id: string; name: string }[]) {
  if (!name) return null;
  const n = name.trim().toLowerCase();
  const first = n.split(/\s+/)[0];
  return participants.find((p) => p.name.toLowerCase() === n) ?? participants.find((p) => p.name.toLowerCase().split(/\s+/)[0] === first) ?? null;
}

/**
 * Stage 1: notes per ~10-minute window, in parallel. Idempotent - windows that
 * already have notes for this prompt version are skipped - so it can run
 * repeatedly while a call is live and only new windows cost a model call.
 */
export async function processWindows(db: Database, meetingId: string, { llm, promptVersion = PROMPT_VERSION, concurrency = 3 }: Opts, callEnded = true) {
  const { m, segs, lines, names } = await loadMeeting(db, meetingId);
  const done = new Set(
    (await db.select({ i: s.chunkNotes.chunkIdx }).from(s.chunkNotes).where(and(eq(s.chunkNotes.meetingId, meetingId), eq(s.chunkNotes.promptVersion, promptVersion)))).map((r) => r.i),
  );
  const windows = closedWindows(segs, callEnded);
  const todo = windows.filter((w) => !done.has(w.idx));
  const report = emptyReport();

  await mapLimit(todo, concurrency, async (w) => {
    const shown = windowLines(segs, w);
    const raw = await completeJson(
      llm,
      chunkPrompt({ title: m.title, participants: names, window: `part ${w.idx + 1} of ${windows.length}`, lines: shown.map(formatLine).join("\n") }),
      modelChunkNotes,
    );
    const allowed = new Map(shown.map((x) => [x.seq, lines.get(x.seq)!]));
    const notes: ChunkNotes = {
      topics: groundCited(raw.topics, allowed, report),
      decisions: groundCited(raw.decisions, allowed, report),
      actionItemCandidates: groundActions(raw.actionItemCandidates, allowed, report).map(({ verified: _, ...a }) => a),
      openQuestions: groundCited(raw.openQuestions, allowed, report),
      notableMoments: groundCited(raw.notableMoments, allowed, report),
    };
    await db
      .insert(s.chunkNotes)
      .values({ meetingId, promptVersion, chunkIdx: w.idx, firstSeq: w.firstSeq, lastSeq: w.lastSeq, startMs: w.startMs, endMs: w.endMs, notes, model: llm.model })
      .onConflictDoNothing();
  });
  return { windows: windows.length, processed: todo.length, skipped: windows.length - todo.length, report };
}

/** Stage 2: merge window notes into the meeting record and canonical action items. */
export async function mergeMeeting(db: Database, meetingId: string, { llm, promptVersion = PROMPT_VERSION }: Opts) {
  const { m, lines, names } = await loadMeeting(db, meetingId);
  const chunks = await db.select().from(s.chunkNotes)
    .where(and(eq(s.chunkNotes.meetingId, meetingId), eq(s.chunkNotes.promptVersion, promptVersion)))
    .orderBy(asc(s.chunkNotes.chunkIdx));
  if (!chunks.length) throw new Error("no window notes to merge");

  const notes = chunks.map((c) => `Part ${c.chunkIdx + 1}: ${JSON.stringify(c.notes)}`).join("\n");
  const raw = await completeJson(llm, mergePrompt({ title: m.title, participants: names, notes }), modelMerge, { maxTokens: 4096 });
  const report = emptyReport();
  const span = (xs: number[]) => ({ startMs: lines.get(xs[0]!)!.startMs, endMs: lines.get(xs.at(-1)!)!.endMs });

  const knowledge: MeetingKnowledge = {
    overview: raw.overview,
    topics: groundCited(raw.topics, lines, report).map((t) => ({ ...t, ...span(t.seqs) })),
    decisions: groundCited(raw.decisions, lines, report),
    openQuestions: groundCited(raw.openQuestions, lines, report),
    speakerContributions: raw.speakerContributions,
  };
  const actions = groundActions(raw.actionItems, lines, report);

  await db.transaction(async (tx) => {
    await tx
      .insert(s.meetingKnowledge)
      .values({ meetingId, promptVersion, transcriptHash: m.transcriptHash ?? "", knowledge, model: llm.model })
      .onConflictDoUpdate({ target: s.meetingKnowledge.meetingId, set: { promptVersion, knowledge, model: llm.model } });
    await tx.delete(s.actionItems).where(and(eq(s.actionItems.meetingId, meetingId), eq(s.actionItems.origin, "ai")));
    if (actions.length) {
      await tx.insert(s.actionItems).values(
        actions.map((a, i) => ({
          meetingId,
          text: a.text,
          assigneeParticipantId: matchOwner(a.owner, m.participants)?.id ?? null,
          assigneeName: a.owner,
          dueText: a.dueText,
          sourceSeqs: a.seqs,
          sourceStartMs: lines.get(a.seqs[0]!)!.startMs,
          evidenceQuote: a.evidenceQuote,
          verified: a.verified,
          sortOrder: i,
        })),
      );
    }
  });
  return { knowledge, actions, report };
}

/** Stage 3: render one template from the meeting record. Cached per (meeting, template, prompt version). */
export async function renderSummary(db: Database, meetingId: string, templateId: string, { llm, promptVersion = PROMPT_VERSION }: Opts) {
  const { m, lines } = await loadMeeting(db, meetingId);
  const [template, record, actions] = await Promise.all([
    db.query.templates.findFirst({ where: eq(s.templates.id, templateId) }),
    db.query.meetingKnowledge.findFirst({ where: eq(s.meetingKnowledge.meetingId, meetingId) }),
    db.select().from(s.actionItems).where(eq(s.actionItems.meetingId, meetingId)).orderBy(asc(s.actionItems.sortOrder)),
  ]);
  if (!template || !record) throw new Error(`missing ${template ? "meeting record" : `template ${templateId}`}`);

  const facts = JSON.stringify({
    ...record.knowledge,
    actionItems: actions.map((a) => ({ text: a.text, owner: a.assigneeName, dueText: a.dueText, seqs: a.sourceSeqs, status: a.status })),
  });
  const raw = await completeJson(llm, summaryPrompt({ title: m.title, template, record: facts }), modelSummary, { maxTokens: 3000 });
  const report = emptyReport();
  const byId = new Map(raw.sections.map((x) => [x.id, x.items]));
  // The template, not the model, decides which sections exist and in what order.
  const content: SummaryContent = {
    sections: template.sections.map((sec) => ({ id: sec.id, heading: sec.heading, items: groundCited(byId.get(sec.id) ?? [], lines, report) })),
  };
  await db
    .insert(s.summaries)
    .values({ meetingId, templateId, promptVersion, status: "ready", content, model: llm.model })
    .onConflictDoUpdate({
      target: [s.summaries.meetingId, s.summaries.templateId, s.summaries.promptVersion],
      set: { status: "ready", content, model: llm.model, error: null },
    });
  return { content, report };
}

/** Whole pipeline for a finished meeting: windows in parallel, merge, default template. */
export async function processMeeting(db: Database, meetingId: string, opts: Opts) {
  const setStatus = (status: "processing" | "ready" | "failed") => db.update(s.meetings).set({ status }).where(eq(s.meetings.id, meetingId));
  await setStatus("processing");
  try {
    const windows = await processWindows(db, meetingId, opts, true);
    const merge = await mergeMeeting(db, meetingId, opts);
    const meeting = await db.query.meetings.findFirst({ where: eq(s.meetings.id, meetingId), columns: { defaultTemplateId: true } });
    const summary = await renderSummary(db, meetingId, meeting!.defaultTemplateId, opts);
    await setStatus("ready");
    const total = (r: GroundReport[]) => r.reduce((a, b) => ({ kept: a.kept + b.kept, dropped: a.dropped + b.dropped, repaired: a.repaired + b.repaired, flagged: a.flagged + b.flagged }));
    return { windows, merge: merge.report, summary: summary.report, grounding: total([windows.report, merge.report, summary.report]) };
  } catch (e) {
    await setStatus("failed");
    throw e;
  }
}
