/**
 * Seed runner: fixtures -> database, in one transaction.
 *
 * - Idempotent: wipes every app table first, so re-running is always safe.
 * - Deterministic ids (stableId) so URLs survive re-seeds.
 * - Batched multi-row inserts (BATCH rows per statement) to stay far below
 *   Postgres' 65,535 bind-parameter limit and avoid one round-trip per row.
 * - Derived fields (talk time, stats, transcript hash, action-item `verified`)
 *   are computed here with the same helpers the live pipeline uses.
 */
import { sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import type { Database } from "../index";
import * as s from "../schema";
import type { MeetingStats } from "../json-types";
import { SPEAKER_COLORS } from "../../lib/colors";
import { stableId } from "../../lib/stable-id";
import { isGrounded, participantTotals, transcriptHash, wordCount } from "../../lib/transcript";
import { type Dataset, type MeetingFixture, resolveDate, resolveRelativeTime } from "./fixtures";

const BATCH = 500;


/** Tables in dependency order; TRUNCATE ... CASCADE handles FKs anyway. */
const ALL_TABLES = [
  "processing_jobs",
  "summaries",
  "meeting_knowledge",
  "chunk_notes",
  "clips",
  "action_items",
  "highlights",
  "transcript_segments",
  "meeting_participants",
  "meetings",
  "templates",
  "calendar_events",
  "calendar_connections",
  "users",
] as const;

export type SeedCounts = Record<string, number>;

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

async function insertBatched<T extends PgTable>(tx: Tx, table: T, rows: T["$inferInsert"][]): Promise<number> {
  for (let i = 0; i < rows.length; i += BATCH) {
    await tx.insert(table).values(rows.slice(i, i + BATCH));
  }
  return rows.length;
}

// ---------------------------------------------------------------------------
// Validation of cross-references that zod can't see (keys, speakers, seqs)
// ---------------------------------------------------------------------------

export function validateReferences(data: Dataset): string[] {
  const errors: string[] = [];
  const emails = new Set(data.users.map((u) => u.email));
  const eventKeys = new Set(data.calendarEvents.map((e) => e.key));
  const templateIds = new Set(data.templates.map((t) => t.id));
  const dup = (label: string, xs: string[]) => {
    const seen = new Set<string>();
    for (const x of xs) {
      if (seen.has(x)) errors.push(`duplicate ${label}: ${x}`);
      seen.add(x);
    }
  };
  dup("user email", data.users.map((u) => u.email));
  dup("calendar event key", data.calendarEvents.map((e) => e.key));
  dup("template id", data.templates.map((t) => t.id));
  dup("meeting key", data.meetings.map((m) => m.key));
  dup("clip slug", data.meetings.flatMap((m) => m.clips.map((c) => c.slug)));
  dup("meeting calendarEventKey", data.meetings.flatMap((m) => (m.calendarEventKey ? [m.calendarEventKey] : [])));

  const needUser = (where: string, email: string | undefined) => {
    if (email && !emails.has(email)) errors.push(`${where}: unknown user ${email}`);
  };
  data.calendarConnections.forEach((c) => needUser("calendarConnection", c.userEmail));
  data.calendarEvents.forEach((e) => needUser(`event ${e.key}`, e.userEmail));
  if (!data.templates.some((t) => t.isDefault)) errors.push("no template has isDefault: true");

  for (const m of data.meetings) {
    const at = `meeting ${m.key}`;
    needUser(at, m.ownerEmail);
    if (m.calendarEventKey && !eventKeys.has(m.calendarEventKey)) errors.push(`${at}: unknown event ${m.calendarEventKey}`);
    if (!m.calendarEventKey && !m.startedAt) errors.push(`${at}: needs startedAt or calendarEventKey`);
    if (!templateIds.has(m.defaultTemplateId)) errors.push(`${at}: unknown template ${m.defaultTemplateId}`);
    m.participants.forEach((p, i) => needUser(`${at} participant ${i}`, p.userEmail));

    let prevStart = -1;
    m.segments.forEach(([speaker, start, end], seq) => {
      if (speaker >= m.participants.length) errors.push(`${at} seq ${seq}: speaker ${speaker} not in participants`);
      if (end < start) errors.push(`${at} seq ${seq}: endMs < startMs`);
      if (start < prevStart) errors.push(`${at} seq ${seq}: segments not ordered by startMs`);
      prevStart = start;
    });
    const lastSeq = m.segments.length - 1;
    m.actionItems.forEach((a, i) => {
      if (a.assignee !== null && a.assignee >= m.participants.length) errors.push(`${at} actionItem ${i}: bad assignee`);
      for (const q of a.sourceSeqs) if (q > lastSeq) errors.push(`${at} actionItem ${i}: seq ${q} out of range`);
    });
    m.highlights.forEach((h) => needUser(`${at} highlight`, h.byEmail));
    m.clips.forEach((c) => {
      needUser(`${at} clip ${c.slug}`, c.byEmail);
      if (c.endMs <= c.startMs) errors.push(`${at} clip ${c.slug}: empty range`);
    });
    for (const sm of m.ai?.summaries ?? []) {
      if (!templateIds.has(sm.templateId)) errors.push(`${at}: summary for unknown template ${sm.templateId}`);
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Row builders
// ---------------------------------------------------------------------------

const userId = (email: string) => stableId(`user:${email}`);
const eventId = (key: string) => stableId(`event:${key}`);
const connectionId = (email: string, provider: string) => stableId(`connection:${email}:${provider}`);
const meetingId = (key: string) => stableId(`meeting:${key}`);
const participantId = (meetingKey: string, idx: number) => stableId(`participant:${meetingKey}:${idx}`);

function buildMeetingRows(m: MeetingFixture, data: Dataset, now: Date) {
  const id = meetingId(m.key);
  const event = m.calendarEventKey ? data.calendarEvents.find((e) => e.key === m.calendarEventKey) : undefined;
  const startedAt = m.startedAt
    ? resolveRelativeTime(m.startedAt, now)
    : event
      ? resolveRelativeTime(event.startsAt, now)
      : null;

  const participantIds = m.participants.map((_, i) => participantId(m.key, i));
  const segments = m.segments.map(([speaker, startMs, endMs, text], seq) => ({
    meetingId: id,
    seq,
    participantId: participantIds[speaker]!,
    speakerName: m.participants[speaker]!.name,
    startMs,
    endMs,
    text,
  }));
  const bySeq = new Map(segments.map((sg) => [sg.seq, sg]));
  const totals = participantTotals(segments);
  const durationMs = segments.reduce((max, sg) => Math.max(max, sg.endMs), 0);
  const totalTalk = [...totals.values()].reduce((a, t) => a + t.talkMs, 0) || 1;

  const participants = m.participants.map((p, i) => ({
    id: participantIds[i]!,
    meetingId: id,
    userId: p.userEmail ? userId(p.userEmail) : null,
    name: p.name,
    email: p.email ?? p.userEmail ?? null,
    title: p.title ?? null,
    company: p.company ?? null,
    isExternal: p.isExternal,
    speakerIdx: i,
    color: p.color ?? SPEAKER_COLORS[i % SPEAKER_COLORS.length]!,
    talkMs: totals.get(participantIds[i]!)?.talkMs ?? 0,
    wordCount: totals.get(participantIds[i]!)?.wordCount ?? 0,
  }));

  const actionItems = m.actionItems.map((a, i) => ({
    id: stableId(`action:${m.key}:${i}`),
    meetingId: id,
    text: a.text,
    assigneeParticipantId: a.assignee === null ? null : participantIds[a.assignee]!,
    assigneeName: a.assigneeName ?? (a.assignee === null ? null : m.participants[a.assignee]!.name),
    dueDate: a.dueDate ? resolveDate(a.dueDate, now) : null,
    dueText: a.dueText ?? null,
    status: a.status,
    origin: a.origin,
    sourceSeqs: a.sourceSeqs,
    sourceStartMs: a.sourceSeqs.length ? (bySeq.get(Math.min(...a.sourceSeqs))?.startMs ?? null) : null,
    evidenceQuote: a.evidenceQuote ?? null,
    verified: a.origin === "manual" || isGrounded(bySeq, a.sourceSeqs, a.evidenceQuote),
    sortOrder: i,
    // Marked done "the next day", but never in the future for very recent meetings.
    completedAt:
      a.status === "done" && startedAt
        ? new Date(Math.min(startedAt.getTime() + durationMs + 86_400_000, now.getTime() - 60_000))
        : null,
  }));

  const stats: MeetingStats | null =
    segments.length > 0
      ? {
          durationMs,
          segmentCount: segments.length,
          wordCount: segments.reduce((a, sg) => a + wordCount(sg.text), 0),
          speakerCount: totals.size,
          talkTime: participants
            .filter((p) => p.talkMs > 0)
            .map((p) => ({ participantId: p.id, talkMs: p.talkMs, share: +(p.talkMs / totalTalk).toFixed(4) }))
            .sort((a, b) => b.talkMs - a.talkMs),
          actionItemCount: actionItems.length,
          highlightCount: m.highlights.length,
        }
      : null;

  const meeting = {
    id,
    ownerId: userId(m.ownerEmail),
    calendarEventId: m.calendarEventKey ? eventId(m.calendarEventKey) : null,
    title: m.title,
    meetingType: m.meetingType,
    platform: m.platform,
    status: m.status,
    defaultTemplateId: m.defaultTemplateId,
    startedAt,
    endedAt: startedAt && segments.length ? new Date(startedAt.getTime() + durationMs) : null,
    durationMs,
    stats,
    transcriptHash: segments.length ? transcriptHash(segments) : null,
  };

  const highlights = m.highlights.map((h, i) => ({
    id: stableId(`highlight:${m.key}:${i}`),
    meetingId: id,
    createdBy: h.byEmail ? userId(h.byEmail) : meeting.ownerId,
    atMs: h.atMs,
    label: h.label ?? null,
  }));

  const clips = m.clips.map((c) => ({
    id: stableId(`clip:${c.slug}`),
    slug: c.slug,
    meetingId: id,
    createdBy: c.byEmail ? userId(c.byEmail) : meeting.ownerId,
    title: c.title,
    startMs: c.startMs,
    endMs: c.endMs,
    viewCount: c.viewCount,
  }));

  const ai = m.ai;
  const chunkNotes = (ai?.chunkNotes ?? []).map((c, i) => ({
    meetingId: id,
    promptVersion: ai!.promptVersion,
    chunkIdx: i,
    model: ai!.model,
    ...c,
  }));
  const knowledge =
    ai?.knowledge && meeting.transcriptHash
      ? [
          {
            meetingId: id,
            promptVersion: ai.promptVersion,
            transcriptHash: meeting.transcriptHash,
            knowledge: ai.knowledge,
            model: ai.model,
          },
        ]
      : [];
  const summaries = (ai?.summaries ?? []).map((sm) => ({
    meetingId: id,
    templateId: sm.templateId,
    promptVersion: ai!.promptVersion,
    status: "ready" as const,
    content: sm.content,
    model: ai!.model,
  }));

  return { meeting, participants, segments, highlights, actionItems, clips, chunkNotes, knowledge, summaries };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/** Validate and build every row without touching the database. */
export function buildRows(data: Dataset, now = new Date()) {
  const errors = validateReferences(data);
  if (errors.length) throw new Error(`Fixture reference errors:\n  - ${errors.join("\n  - ")}`);

  const users = data.users.map((u) => ({
    id: userId(u.email),
    email: u.email,
    name: u.name,
    title: u.title ?? null,
    avatarUrl: u.avatarUrl ?? null,
    ...(u.timezone ? { timezone: u.timezone } : {}),
  }));
  const connections = data.calendarConnections.map((c) => ({
    id: connectionId(c.userEmail, c.provider),
    userId: userId(c.userEmail),
    provider: c.provider,
    accountEmail: c.accountEmail,
    autoRecord: c.autoRecord,
    status: "connected" as const,
    lastSyncedAt: now,
  }));
  const events = data.calendarEvents.map((e) => {
    const startsAt = resolveRelativeTime(e.startsAt, now);
    const conn = data.calendarConnections.find((c) => c.userEmail === e.userEmail);
    return {
      id: eventId(e.key),
      userId: userId(e.userEmail),
      connectionId: conn ? connectionId(conn.userEmail, conn.provider) : null,
      externalId: `gcal_${eventId(e.key).replaceAll("-", "").slice(0, 20)}`,
      title: e.title,
      description: e.description ?? null,
      startsAt,
      endsAt: new Date(startsAt.getTime() + e.durationMin * 60_000),
      platform: e.platform,
      meetingUrl: meetingUrl(e.platform, e.key),
      attendees: e.attendees,
      agenda: e.agenda ?? e.description ?? null,
      attachments: e.attachments,
      recordEnabled: e.recordEnabled,
    };
  });
  const templates = data.templates.map((t) => ({ ...t }));
  const built = data.meetings.map((m) => buildMeetingRows(m, data, now));
  return {
    users,
    calendarConnections: connections,
    calendarEvents: events,
    templates,
    meetings: built.map((b) => b.meeting),
    meetingParticipants: built.flatMap((b) => b.participants),
    transcriptSegments: built.flatMap((b) => b.segments),
    highlights: built.flatMap((b) => b.highlights),
    actionItems: built.flatMap((b) => b.actionItems),
    clips: built.flatMap((b) => b.clips),
    chunkNotes: built.flatMap((b) => b.chunkNotes),
    meetingKnowledge: built.flatMap((b) => b.knowledge),
    summaries: built.flatMap((b) => b.summaries),
  };
}

export type SeedRows = ReturnType<typeof buildRows>;

export function countRows(rows: SeedRows): SeedCounts {
  const counts: SeedCounts = Object.fromEntries(Object.entries(rows).map(([k, v]) => [k, v.length]));
  counts.unverifiedActionItems = rows.actionItems.filter((a) => !a.verified).length;
  return counts;
}

export async function seed(db: Database, data: Dataset, now = new Date()): Promise<SeedCounts> {
  const rows = buildRows(data, now);
  return db.transaction(async (tx) => {
    await tx.execute(sql.raw(`TRUNCATE ${ALL_TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`));
    // Parents before children.
    await insertBatched(tx, s.users, rows.users);
    await insertBatched(tx, s.calendarConnections, rows.calendarConnections);
    await insertBatched(tx, s.calendarEvents, rows.calendarEvents);
    await insertBatched(tx, s.templates, rows.templates);
    await insertBatched(tx, s.meetings, rows.meetings);
    await insertBatched(tx, s.meetingParticipants, rows.meetingParticipants);
    await insertBatched(tx, s.transcriptSegments, rows.transcriptSegments);
    await insertBatched(tx, s.highlights, rows.highlights);
    await insertBatched(tx, s.actionItems, rows.actionItems);
    await insertBatched(tx, s.clips, rows.clips);
    await insertBatched(tx, s.chunkNotes, rows.chunkNotes);
    await insertBatched(tx, s.meetingKnowledge, rows.meetingKnowledge);
    await insertBatched(tx, s.summaries, rows.summaries);
    const counts = countRows(rows);
    return counts;
  });
}

function meetingUrl(platform: MeetingFixture["platform"], key: string): string {
  const code = stableId(`url:${key}`).replaceAll("-", "");
  switch (platform) {
    case "zoom":
      return `https://zoom.us/j/${parseInt(code.slice(0, 10), 16).toString().slice(0, 10)}`;
    case "google_meet":
      return `https://meet.google.com/${code.slice(0, 3)}-${code.slice(3, 7)}-${code.slice(7, 10)}`;
    case "teams":
      return `https://teams.microsoft.com/l/meetup-join/${code}`;
  }
}
