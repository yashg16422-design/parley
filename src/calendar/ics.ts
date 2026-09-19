import ICAL from "ical.js";
import { and, eq, gte, lte, notInArray, sql } from "drizzle-orm";
import type { Database } from "../db";
import * as s from "../db/schema";
import type { Attendee } from "../db/json-types";
import { findMeetingLink, type Platform } from "../lib/meeting-links";
import { open, seal } from "../vault";

/**
 * Read-only calendar sync from a secret iCal address (Google: Settings →
 * "Secret address in iCal format"). No OAuth: the address itself is the read
 * credential, so it's stored sealed and never logged or echoed back.
 */
const HOSTS = [/^calendar\.google\.com$/, /^outlook\.office365\.com$/, /^outlook\.live\.com$/, /^p\d+-caldav\.icloud\.com$/];
const MAX_BYTES = 5 * 1024 * 1024;
const WINDOW = { pastDays: 7, futureDays: 30 };
const sqlExcluded = (col: string) => sql.raw(`excluded.${col}`);

export class FeedError extends Error {
  constructor(public status: 400 | 404 | 502, message: string) {
    super(message);
  }
}

/** Only https feeds on known calendar hosts: stops the server being used to fetch arbitrary or internal URLs. */
export function checkFeedUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw.trim().replace(/^webcals?:\/\//i, "https://"));
  } catch {
    throw new FeedError(400, "that isn't a valid URL");
  }
  if (u.protocol !== "https:" || u.username || u.password || (u.port && u.port !== "443")) throw new FeedError(400, "feed must be a plain https:// address");
  if (!HOSTS.some((h) => h.test(u.hostname))) throw new FeedError(400, "feed must come from Google Calendar, Outlook or iCloud");
  return u;
}

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

export async function fetchFeed(url: URL, fetcher: Fetcher = fetch, timeoutMs = 10_000) {
  let u = url;
  for (let hop = 0; hop < 4; hop++) {
    const r = await fetcher(u.href, { redirect: "manual", signal: AbortSignal.timeout(timeoutMs), headers: { accept: "text/calendar" } }).catch(() => null);
    if (!r) throw new FeedError(502, "couldn't reach the calendar feed");
    if (r.status >= 300 && r.status < 400 && r.headers.get("location")) {
      u = checkFeedUrl(new URL(r.headers.get("location")!, u).href);
      continue;
    }
    if (r.status === 404 || r.status === 403 || r.status === 401) throw new FeedError(404, "the calendar rejected this address; it may have been reset");
    if (!r.ok || !r.body) throw new FeedError(502, `calendar feed returned HTTP ${r.status}`);
    const chunks: Uint8Array[] = [];
    let size = 0;
    for await (const c of r.body as AsyncIterable<Uint8Array>) {
      if ((size += c.byteLength) > MAX_BYTES) throw new FeedError(502, "calendar feed is larger than 5 MB");
      chunks.push(c);
    }
    const text = Buffer.concat(chunks).toString("utf8");
    if (!text.includes("BEGIN:VCALENDAR")) throw new FeedError(502, "that address didn't return an iCal calendar");
    return text;
  }
  throw new FeedError(502, "too many redirects");
}

export type FeedEvent = {
  externalId: string; title: string; startsAt: Date; endsAt: Date;
  platform: Platform; meetingUrl: string; attendees: Attendee[]; agenda: string | null;
};

const PARTSTAT: Record<string, Attendee["responseStatus"]> = { ACCEPTED: "accepted", TENTATIVE: "tentative", DECLINED: "declined", "NEEDS-ACTION": "needsAction" };
const text = (v: unknown) => (typeof v === "string" ? v : "");

function cleanAgenda(raw: string) {
  const t = raw
    .replace(/-::~[\s\S]*?~::-/g, "") // Google's appended "join with Meet" block
    .replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n").trim();
  return t ? t.slice(0, 4000) : null;
}

function details(ev: ICAL.Event) {
  const c = ev.component;
  const hay = [c.getFirstPropertyValue("x-google-conference"), ev.location, c.getFirstPropertyValue("url"), ev.description].map(text).join("\n");
  const link = findMeetingLink(hay);
  const organizer = text(ev.organizer).replace(/^mailto:/i, "").toLowerCase();
  const attendees = ev.attendees.slice(0, 50).flatMap((p): Attendee[] => {
    const email = text(p.getFirstValue()).replace(/^mailto:/i, "").toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return [];
    const cn = text(p.getParameter("cn")) || email.split("@")[0]!;
    return [{ name: cn, email, responseStatus: PARTSTAT[text(p.getParameter("partstat")).toUpperCase()] ?? "needsAction", isOrganizer: email === organizer }];
  });
  return { link, title: ev.summary?.trim() || "(No title)", attendees, agenda: cleanAgenda(ev.description ?? "") };
}

const cancelled = (c: ICAL.Component) => text(c.getFirstPropertyValue("status")).toUpperCase() === "CANCELLED";

/**
 * Timed video-call occurrences inside [from, to]. Recurring series are
 * expanded (EXDATEs and moved/cancelled instances applied); all-day entries
 * and events without a Meet/Zoom/Teams link are skipped, since there is
 * nothing to join or record.
 */
export function parseFeed(ics: string, from: Date, to: Date) {
  const root = new ICAL.Component(ICAL.parse(ics));
  for (const tz of root.getAllSubcomponents("vtimezone")) ICAL.TimezoneService.register(tz);
  const vevents = root.getAllSubcomponents("vevent");
  const masters = new Map<string, ICAL.Event>();
  const orphans: ICAL.Event[] = [];
  for (const v of vevents) if (!v.hasProperty("recurrence-id")) masters.set(text(v.getFirstPropertyValue("uid")), new ICAL.Event(v));
  for (const v of vevents) {
    if (!v.hasProperty("recurrence-id")) continue;
    const master = masters.get(text(v.getFirstPropertyValue("uid")));
    if (master) master.relateException(v);
    else orphans.push(new ICAL.Event(v));
  }

  const out: FeedEvent[] = [];
  let skipped = 0;
  const add = (ev: ICAL.Event, start: ICAL.Time, end: ICAL.Time, externalId: string) => {
    if (start.isDate || cancelled(ev.component)) return;
    const [startsAt, endsAt] = [start.toJSDate(), end.toJSDate()];
    if (endsAt < from || startsAt > to || endsAt <= startsAt) return;
    const d = details(ev);
    if (!d.link) return void skipped++;
    out.push({ externalId, title: d.title, startsAt, endsAt, platform: d.link.platform, meetingUrl: d.link.url!, attendees: d.attendees, agenda: d.agenda });
  };

  for (const [uid, ev] of masters) {
    if (cancelled(ev.component)) continue;
    if (!ev.isRecurring()) {
      add(ev, ev.startDate, ev.endDate, uid);
      continue;
    }
    const it = ev.iterator();
    // Bounded walk from the series start: covers ~13 years of a daily meeting.
    for (let i = 0, t: ICAL.Time | null; i < 5_000 && (t = it.next()); i++) {
      if (t.toJSDate() > to) break;
      const o = ev.getOccurrenceDetails(t);
      add(o.item, o.startDate, o.endDate, `${uid}/${o.recurrenceId.toJSDate().toISOString()}`);
    }
  }
  for (const ev of orphans) add(ev, ev.startDate, ev.endDate, `${ev.uid}/${ev.recurrenceId?.toJSDate().toISOString()}`);
  return { events: out.sort((a, b) => +a.startsAt - +b.startsAt), skipped };
}

/** Save (sealed) and sync a user's feed. One iCal connection per user; reconnecting replaces the address. */
export async function connectIcs(db: Database, userId: string, rawUrl: string, fetcher?: Fetcher, now = new Date()) {
  const u = checkFeedUrl(rawUrl);
  await db
    .insert(s.calendarConnections)
    .values({ userId, provider: "ics", accountEmail: `iCal feed · ${u.hostname}`, feedUrlSecret: seal(u.href), status: "syncing" })
    .onConflictDoUpdate({ target: [s.calendarConnections.userId, s.calendarConnections.provider], set: { feedUrlSecret: seal(u.href), accountEmail: `iCal feed · ${u.hostname}`, status: "syncing" } });
  return syncIcs(db, userId, fetcher, now);
}

export async function syncIcs(db: Database, userId: string, fetcher?: Fetcher, now = new Date()) {
  const conn = await db.query.calendarConnections.findFirst({ where: and(eq(s.calendarConnections.userId, userId), eq(s.calendarConnections.provider, "ics")) });
  if (!conn?.feedUrlSecret) throw new FeedError(404, "no iCal feed connected");
  const from = new Date(now.getTime() - WINDOW.pastDays * 86_400_000), to = new Date(now.getTime() + WINDOW.futureDays * 86_400_000);
  try {
    const { events, skipped } = parseFeed(await fetchFeed(checkFeedUrl(open(conn.feedUrlSecret)), fetcher), from, to);
    const rows = events.map((e) => ({ ...e, userId, connectionId: conn.id }));
    for (let i = 0; i < rows.length; i += 200) {
      await db.insert(s.calendarEvents).values(rows.slice(i, i + 200)).onConflictDoUpdate({
        target: [s.calendarEvents.connectionId, s.calendarEvents.externalId],
        set: { title: sqlExcluded("title"), startsAt: sqlExcluded("starts_at"), endsAt: sqlExcluded("ends_at"), platform: sqlExcluded("platform"), meetingUrl: sqlExcluded("meeting_url"), attendees: sqlExcluded("attendees"), agenda: sqlExcluded("agenda") },
      });
    }
    // Occurrences that vanished from the feed (deleted, moved out of range, cancelled) go too.
    const inWindow = and(eq(s.calendarEvents.connectionId, conn.id), gte(s.calendarEvents.startsAt, from), lte(s.calendarEvents.startsAt, to));
    const removed = await db.delete(s.calendarEvents).where(rows.length ? and(inWindow, notInArray(s.calendarEvents.externalId, rows.map((r) => r.externalId))) : inWindow).returning({ id: s.calendarEvents.id });
    await db.update(s.calendarConnections).set({ status: "connected", lastSyncedAt: now, lastSyncError: null }).where(eq(s.calendarConnections.id, conn.id));
    return { synced: rows.length, removed: removed.length, skippedNoLink: skipped };
  } catch (e) {
    await db.update(s.calendarConnections).set({ status: "disconnected", lastSyncError: e instanceof FeedError ? e.message : "couldn't read the calendar feed" }).where(eq(s.calendarConnections.id, conn.id));
    throw e instanceof FeedError ? e : new FeedError(502, "couldn't read the calendar feed");
  }
}

export async function disconnectIcs(db: Database, userId: string) {
  const conn = await db.query.calendarConnections.findFirst({ where: and(eq(s.calendarConnections.userId, userId), eq(s.calendarConnections.provider, "ics")) });
  if (!conn) return;
  await db.delete(s.calendarEvents).where(eq(s.calendarEvents.connectionId, conn.id));
  await db.delete(s.calendarConnections).where(eq(s.calendarConnections.id, conn.id));
}
