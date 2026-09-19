import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { ask } from "./ai/ask";
import { llmForUser } from "./ai/providers";
import { getDb } from "./db";
import * as s from "./db/schema";
import { listMeetings, meetingDetail, openActionItems } from "./queries";
import { searchFor } from "./search";

/**
 * The read side of Parley for scripts, the /api/v1 REST API and the MCP server.
 * Everything is scoped to what the caller can already see in the app, and
 * shaped as plain JSON (stable field names, ISO dates, links back to the app).
 */
const base = () => process.env.APP_URL?.replace(/\/$/, "") ?? "";
const meetingUrl = (id: string, ms?: number) => `${base()}/meetings/${id}${ms !== undefined ? `?t=${ms}` : ""}`;

export async function apiMeetings(userId: string, limit = 25) {
  const rows = await listMeetings(userId);
  return rows.slice(0, Math.min(100, Math.max(1, limit))).map((m) => ({
    id: m.id, title: m.title, status: m.status, startedAt: m.startedAt, durationMs: m.durationMs, platform: m.platform,
    overview: m.knowledge?.overview ?? null, participants: m.participants.map((p) => p.name),
    actionItems: { total: m.actionItems.length, open: m.actionItems.filter((a) => a.status === "open").length }, url: meetingUrl(m.id),
  }));
}

export async function apiMeeting(userId: string, id: string, { transcript = false } = {}) {
  const m = await meetingDetail(id, userId);
  if (!m) return null;
  const summary = await getDb().query.summaries.findFirst({
    where: and(eq(s.summaries.meetingId, id), eq(s.summaries.templateId, m.defaultTemplateId), eq(s.summaries.status, "ready")),
    orderBy: desc(s.summaries.updatedAt), columns: { content: true, templateId: true, model: true },
  });
  return {
    id: m.id, title: m.title, status: m.status, startedAt: m.startedAt, durationMs: m.durationMs, platform: m.platform, url: meetingUrl(m.id),
    participants: m.participants.map((p) => ({ name: p.name, email: p.email, talkMs: p.talkMs })),
    overview: m.knowledge?.knowledge.overview ?? null,
    summary: summary ? { template: summary.templateId, model: summary.model, sections: summary.content?.sections ?? [] } : null,
    actionItems: m.actionItems.map((a) => ({ id: a.id, text: a.text, owner: a.assignee?.name ?? a.assigneeName, due: a.dueText, status: a.status, url: a.sourceStartMs !== null ? meetingUrl(m.id, a.sourceStartMs) : null })),
    highlights: m.highlights.map((h) => ({ atMs: h.atMs, label: h.label, url: meetingUrl(m.id, h.atMs) })),
    clips: m.clips.map((c) => ({ title: c.title, startMs: c.startMs, endMs: c.endMs, url: `${base()}/c/${c.slug}` })),
    ...(transcript ? { transcript: m.segments.map((x) => ({ seq: x.seq, startMs: x.startMs, endMs: x.endMs, speaker: x.speakerName, text: x.text })) } : {}),
  };
}

export async function apiActionItems(userId: string, status?: "open" | "done") {
  const items = await openActionItems(userId);
  return items.filter((a) => !status || a.status === status).slice(0, 200).map((a) => ({
    id: a.id, text: a.text, owner: a.assignee?.name ?? a.assigneeName, due: a.dueText, status: a.status,
    meeting: { id: a.meeting.id, title: a.meeting.title, startedAt: a.meeting.startedAt }, url: meetingUrl(a.meeting.id, a.sourceStartMs ?? undefined),
  }));
}

export async function apiSearch(userId: string, q: string, limit = 20) {
  const r = await searchFor(getDb(), userId, q, limit);
  return {
    query: q, expanded: r.expanded,
    moments: r.hits.map((h) => ({ meetingId: h.meetingId, title: h.title, startedAt: h.startedAt, startMs: h.startMs, speaker: h.speakerName, text: h.parts.map((p) => p.text).join(""), url: meetingUrl(h.meetingId, h.startMs) })),
    events: r.events.map((e) => ({ id: e.id, title: e.title, startsAt: e.startsAt, snippet: e.parts.map((p) => p.text).join("") })),
  };
}

export async function apiAsk(userId: string, question: string) {
  const db = getDb();
  const a = await ask(db, userId, question, await llmForUser(db, userId));
  return {
    answer: a.answer, source: a.source, model: a.model,
    citations: a.citations.map((c) => ({ n: c.n, kind: c.kind ?? "transcript", meeting: c.title, meetingId: c.meetingId, startMs: c.startMs, speaker: c.speakerName, text: c.text, url: `${base()}${c.href}` })),
  };
}
