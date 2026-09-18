/**
 * No-token fallback: build output from data we already have instead of calling a
 * model. Everything produced here is stored with promptVersion "simulated" so it
 * is never mistaken for real model output, and is replaced once a token exists.
 */
import { asc, eq } from "drizzle-orm";
import type { Database } from "../db";
import * as s from "../db/schema";
import type { MeetingKnowledge, SummaryContent, TemplateSection } from "../db/json-types";
import { extractiveNotes } from "./extractive";
import type { Seg } from "./windows";

export const SIMULATED = "simulated";

type Item = { text: string; seqs: number[] };
type Action = { text: string; assigneeName: string | null; dueText: string | null; sourceSeqs: number[] };

/** Which part of the meeting record feeds a template section, by section id. */
const SOURCES: [RegExp, (k: MeetingKnowledge, a: Action[]) => Item[]][] = [
  [/overview|tldr|goals|background|company/, (k) => [{ text: k.overview, seqs: [] }]],
  [/decision|recommendation/, (k) => k.decisions],
  [/next|follow|asks|today|launch/, (_, a) => a.map((x) => ({ text: `${x.assigneeName ?? "Unassigned"}: ${x.text}${x.dueText ? ` (${x.dueText})` : ""}`, seqs: x.sourceSeqs }))],
  [/question|risk|concern|blocker|requirement/, (k) => k.openQuestions],
  [/contribution|communication|feedback|strength/, (k) => k.speakerContributions.map((c) => ({ text: `${c.speaker}: ${c.summary}`, seqs: [] }))],
  [/.*/, (k) => k.topics.map((t) => ({ text: `${t.title}: ${t.summary}`, seqs: t.seqs }))],
];

export function simulateSummary(k: MeetingKnowledge, actions: Action[], sections: TemplateSection[]): SummaryContent {
  return { sections: sections.map((sec) => ({ id: sec.id, heading: sec.heading, items: SOURCES.find(([re]) => re.test(sec.id))![1](k, actions).slice(0, 6) })) };
}

/**
 * A replayed live call without a token gets the seeded AI outputs of the meeting
 * it replays, limited to lines that were actually replayed.
 */
export async function applySimulatedOutputs(db: Database, meetingId: string) {
  const m = await db.query.meetings.findFirst({ where: eq(s.meetings.id, meetingId), with: { participants: true } });
  if (!m?.simulatedFromId) return { copied: false };
  const src = await db.query.meetings.findFirst({
    where: eq(s.meetings.id, m.simulatedFromId),
    with: { knowledge: true, actionItems: true, summaries: true, participants: true },
  });
  const segCount = m.stats?.segmentCount ?? 0;
  const inRange = (xs: number[]) => xs.filter((q) => q < segCount);
  const byIdx = new Map(m.participants.map((p) => [p.speakerIdx, p.id]));
  const srcIdx = new Map(src!.participants.map((p) => [p.id, p.speakerIdx]));

  await db.transaction(async (tx) => {
    if (src!.knowledge) {
      const k = src!.knowledge.knowledge;
      const cut = <T extends { seqs: number[] }>(xs: T[]) => xs.filter((x) => !x.seqs.length || inRange(x.seqs).length).map((x) => ({ ...x, seqs: inRange(x.seqs) }));
      const knowledge = { ...k, topics: cut(k.topics), decisions: cut(k.decisions), openQuestions: cut(k.openQuestions) };
      await tx.insert(s.meetingKnowledge).values({ meetingId, promptVersion: SIMULATED, transcriptHash: m.transcriptHash ?? "", knowledge, model: SIMULATED }).onConflictDoNothing();
    }
    const actions = src!.actionItems.filter((a) => a.origin === "ai" && a.sourceSeqs.length && inRange(a.sourceSeqs).length === a.sourceSeqs.length);
    if (actions.length) {
      await tx.insert(s.actionItems).values(
        actions.map(({ id: _, meetingId: __, createdAt: ___, updatedAt: ____, search: _____, assigneeParticipantId, completedAt: ______, ...a }) => ({
          ...a,
          meetingId,
          status: "open" as const,
          assigneeParticipantId: assigneeParticipantId ? (byIdx.get(srcIdx.get(assigneeParticipantId)!) ?? null) : null,
        })),
      );
    }
    const summaries = src!.summaries.filter((x) => x.content);
    if (summaries.length) {
      await tx.insert(s.summaries).values(
        summaries.map((x) => ({
          meetingId, templateId: x.templateId, promptVersion: SIMULATED, status: "ready" as const, model: SIMULATED,
          content: { sections: x.content!.sections.map((sec) => ({ ...sec, items: sec.items.filter((i) => !i.seqs.length || inRange(i.seqs).length).map((i) => ({ ...i, seqs: inRange(i.seqs) })) })) },
        })),
      ).onConflictDoNothing();
    }
  });
  return { copied: true };
}

/** No model, not a replay: rule-based meeting record and action items from the transcript itself. */
export async function applyExtractiveOutputs(db: Database, meetingId: string) {
  const m = await db.query.meetings.findFirst({ where: eq(s.meetings.id, meetingId), with: { participants: true } });
  const segs = (await db.select().from(s.transcriptSegments).where(eq(s.transcriptSegments.meetingId, meetingId)).orderBy(asc(s.transcriptSegments.seq))) as Seg[];
  const { knowledge, actions } = extractiveNotes(segs);
  const byName = new Map(m!.participants.map((p) => [p.name, p.id]));
  await db.transaction(async (tx) => {
    await tx.insert(s.meetingKnowledge).values({ meetingId, promptVersion: SIMULATED, transcriptHash: m!.transcriptHash ?? "", knowledge, model: "rules" }).onConflictDoNothing();
    if (actions.length) {
      await tx.insert(s.actionItems).values(actions.map((a, i) => ({
        meetingId, text: a.text, assigneeName: a.owner, assigneeParticipantId: a.owner ? (byName.get(a.owner) ?? null) : null,
        sourceSeqs: a.seqs, sourceStartMs: a.startMs, evidenceQuote: a.quote, verified: true, sortOrder: i,
      })));
    }
  });
}
