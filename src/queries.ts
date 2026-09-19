import "server-only";
import { and, asc, desc, eq, exists, gte, inArray, lte, notInArray, or, sql } from "drizzle-orm";
import { getDb } from "./db";
import * as s from "./db/schema";

export { currentUser } from "./session";

/** Meetings the user recorded or attended. */
const mine = (userId: string) =>
  or(
    eq(s.meetings.ownerId, userId),
    exists(getDb().select().from(s.meetingParticipants).where(and(eq(s.meetingParticipants.meetingId, s.meetings.id), eq(s.meetingParticipants.userId, userId)))),
  );

export async function visibleMeeting(id: string, userId: string) {
  return getDb().query.meetings.findFirst({ where: and(eq(s.meetings.id, id), mine(userId)), columns: { id: true, status: true } });
}

export async function listMeetings(userId: string) {
  return getDb().query.meetings.findMany({
    where: and(mine(userId), notInArray(s.meetings.status, ["scheduled", "abandoned"])),
    orderBy: desc(s.meetings.startedAt),
    columns: { id: true, title: true, status: true, startedAt: true, durationMs: true, meetingType: true, platform: true, stats: true },
    with: { participants: { columns: { name: true, color: true, isExternal: true } }, actionItems: { columns: { status: true } }, knowledge: { columns: { knowledge: true } } },
  });
}

export async function upcomingEvents(userId: string, days = 14) {
  const now = new Date();
  return getDb().query.calendarEvents.findMany({
    where: and(eq(s.calendarEvents.userId, userId), gte(s.calendarEvents.startsAt, now), lte(s.calendarEvents.startsAt, new Date(now.getTime() + days * 86_400_000))),
    orderBy: asc(s.calendarEvents.startsAt),
    with: { connection: { columns: { provider: true } } },
  });
}

/** A meeting the user can see (`userId`), or any meeting when replaying a sample (`userId` omitted). */
export async function meetingDetail(id: string, userId?: string) {
  const db = getDb();
  const [m, templates] = await Promise.all([
    db.query.meetings.findFirst({
      where: userId ? and(eq(s.meetings.id, id), mine(userId)) : eq(s.meetings.id, id),
      with: {
        participants: { orderBy: asc(s.meetingParticipants.speakerIdx) },
        segments: { orderBy: asc(s.transcriptSegments.seq), columns: { seq: true, participantId: true, speakerName: true, startMs: true, endMs: true, text: true } },
        highlights: { orderBy: asc(s.highlights.atMs) },
        actionItems: { orderBy: asc(s.actionItems.sortOrder), with: { assignee: { columns: { name: true, color: true } } } },
        clips: { orderBy: desc(s.clips.createdAt) },
        knowledge: { columns: { knowledge: true } },
        calendarEvent: { columns: { id: true, agenda: true, attachments: true, meetingUrl: true } },
      },
    }),
    db.query.templates.findMany({ orderBy: asc(s.templates.sortOrder), columns: { id: true, name: true, description: true } }),
  ]);
  if (!m) return null;
  const [recording] = await db.select({ startMs: s.recordingChunks.startMs, mime: s.recordingChunks.mime }).from(s.recordingChunks).where(and(eq(s.recordingChunks.meetingId, id), eq(s.recordingChunks.idx, 0)));
  return { ...m, templates, recording: recording ?? null };
}

export async function openActionItems(userId: string) {
  const db = getDb();
  const ids = db.select({ id: s.meetings.id }).from(s.meetings).where(mine(userId));
  return db.query.actionItems.findMany({
    where: inArray(s.actionItems.meetingId, ids),
    orderBy: [asc(s.actionItems.status), desc(s.actionItems.createdAt)],
    with: { meeting: { columns: { id: true, title: true, startedAt: true } }, assignee: { columns: { name: true, color: true } } },
  });
}

export async function calendar(userId: string, fromDays = -7, toDays = 14) {
  const now = Date.now();
  return getDb().query.calendarEvents.findMany({
    where: and(eq(s.calendarEvents.userId, userId), gte(s.calendarEvents.startsAt, new Date(now + fromDays * 86_400_000)), lte(s.calendarEvents.startsAt, new Date(now + toDays * 86_400_000))),
    orderBy: asc(s.calendarEvents.startsAt),
    with: { meeting: { columns: { id: true, status: true } }, connection: { columns: { provider: true, accountEmail: true } } },
  });
}

export async function eventAttachment(eventId: string, idx: number, userId: string) {
  const e = await getDb().query.calendarEvents.findFirst({ where: and(eq(s.calendarEvents.id, eventId), eq(s.calendarEvents.userId, userId)) });
  const a = e?.attachments[idx];
  return e && a ? { event: e, attachment: a } : null;
}

export async function calendarEvent(eventId: string, userId: string) {
  return getDb().query.calendarEvents.findFirst({ where: and(eq(s.calendarEvents.id, eventId), eq(s.calendarEvents.userId, userId)), with: { meeting: { columns: { id: true } } } });
}

export async function clipBySlug(slug: string) {
  const db = getDb();
  const clip = await db.query.clips.findFirst({
    where: eq(s.clips.slug, slug),
    with: { meeting: { columns: { title: true, startedAt: true }, with: { participants: { orderBy: asc(s.meetingParticipants.speakerIdx) } } }, author: { columns: { name: true } } },
  });
  if (!clip || !clip.isPublic) return null;
  const segments = await db.query.transcriptSegments.findMany({
    where: and(eq(s.transcriptSegments.meetingId, clip.meetingId), lte(s.transcriptSegments.startMs, clip.endMs), gte(s.transcriptSegments.endMs, clip.startMs)),
    orderBy: asc(s.transcriptSegments.seq),
    columns: { seq: true, participantId: true, speakerName: true, startMs: true, endMs: true, text: true },
  });
  return { clip, segments };
}

/** The demo workspace's recorded calls, offered to everyone as sample replays. */
export async function sampleMeetings() {
  const demo = getDb().select({ id: s.users.id }).from(s.users).where(eq(s.users.email, process.env.DEMO_USER_EMAIL ?? "maya@driftwood.example"));
  return getDb().query.meetings.findMany({
    where: and(eq(s.meetings.status, "ready"), inArray(s.meetings.ownerId, demo), sql`${s.meetings.simulatedFromId} IS NULL`),
    columns: { id: true, title: true, durationMs: true, simulatedFromId: true },
    orderBy: desc(s.meetings.durationMs),
  });
}
