import { and, asc, desc, eq, sql } from "drizzle-orm";
import { renderSummary } from "./ai/pipeline";
import { SIMULATED, simulateSummary } from "./ai/simulated";
import type { Database } from "./db";
import * as s from "./db/schema";
import type { SummaryContent } from "./db/json-types";
import type { LlmClient } from "./ai/llm";
import { HttpError } from "./live";

export type SummarySource = "cache" | "live" | "simulated";
export type ResolvedSummary = { source: SummarySource; model: string | null; content: SummaryContent; note?: string };

/**
 * Cache first (real outputs preferred over simulated ones). On a miss, render
 * with the model if one is configured; without one - or if the model fails -
 * build a simulated summary from the meeting record so the UI never breaks.
 */
export async function resolveSummary(db: Database, meetingId: string, templateId: string, llm: LlmClient | null): Promise<ResolvedSummary> {
  const [cached] = await db.select().from(s.summaries)
    .where(and(eq(s.summaries.meetingId, meetingId), eq(s.summaries.templateId, templateId), eq(s.summaries.status, "ready")))
    .orderBy(sql`${s.summaries.promptVersion} = ${SIMULATED}`, desc(s.summaries.updatedAt))
    .limit(1);
  if (cached?.content && (cached.promptVersion !== SIMULATED || !llm)) {
    return { source: cached.promptVersion === SIMULATED ? "simulated" : "cache", model: cached.model, content: cached.content };
  }

  const [template, record] = await Promise.all([
    db.query.templates.findFirst({ where: eq(s.templates.id, templateId) }),
    db.query.meetingKnowledge.findFirst({ where: eq(s.meetingKnowledge.meetingId, meetingId) }),
  ]);
  if (!template) throw new HttpError(404, `unknown template ${templateId}`);
  if (!record) throw new HttpError(409, "meeting hasn't been processed yet");

  let note: string | undefined;
  if (llm) {
    try {
      const { content } = await renderSummary(db, meetingId, templateId, { llm });
      return { source: "live", model: llm.model, content };
    } catch (e) {
      note = `model unavailable, showing simulated summary: ${e instanceof Error ? e.message : e}`;
    }
  }
  const actions = await db.select().from(s.actionItems).where(eq(s.actionItems.meetingId, meetingId)).orderBy(asc(s.actionItems.sortOrder));
  const content = simulateSummary(record.knowledge, actions, template.sections);
  await db.insert(s.summaries)
    .values({ meetingId, templateId, promptVersion: SIMULATED, status: "ready", content, model: SIMULATED })
    .onConflictDoUpdate({ target: [s.summaries.meetingId, s.summaries.templateId, s.summaries.promptVersion], set: { content, status: "ready" } });
  return { source: "simulated", model: SIMULATED, content, note };
}
