/**
 * npm run verify:open-core
 *
 * The open-core building blocks, in-process on PGlite (no network, no keys):
 * the secret vault, BYOK key precedence, iCal parsing + sync (recurrence,
 * exceptions, time zones, link extraction, fetch hardening) and the two-stream
 * line merger.
 */
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { LineMerger, MIC, type CapturedLine } from "../src/capture/dual-stream";
import { checkFeedUrl, connectIcs, fetchFeed, FeedError, parseFeed, syncIcs } from "../src/calendar/ics";
import * as s from "../src/db/schema";
import { resolveKey, saveKey } from "../src/keys";
import { takeToken } from "../src/rate-limit";
import { sweep } from "../src/sweep";
import { templates } from "../seed/src/templates";
import { open, seal } from "../src/vault";

process.env.PARLEY_SECRET_KEY = "test-secret-key-that-is-at-least-32-chars";
const FEED = "https://calendar.google.com/calendar/ical/maya%40example.com/private-abc123/basic.ics";

const ics = (extra = "") => `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Google Inc//Google Calendar 70.9054//EN
BEGIN:VTIMEZONE
TZID:America/New_York
BEGIN:DAYLIGHT
TZOFFSETFROM:-0500
TZOFFSETTO:-0400
TZNAME:EDT
DTSTART:19700308T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:-0400
TZOFFSETTO:-0500
TZNAME:EST
DTSTART:19701101T020000
RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU
END:STANDARD
END:VTIMEZONE
BEGIN:VEVENT
UID:standup@google.com
SUMMARY:Platform standup
DTSTART;TZID=America/New_York:20260907T093000
DTEND;TZID=America/New_York:20260907T094500
RRULE:FREQ=WEEKLY;BYDAY=MO,WE
EXDATE;TZID=America/New_York:20260916T093000
X-GOOGLE-CONFERENCE:https://meet.google.com/abc-defg-hij
ORGANIZER;CN=Maya Chen:mailto:maya@example.com
ATTENDEE;CN=Maya Chen;PARTSTAT=ACCEPTED:mailto:maya@example.com
ATTENDEE;CN=Raj Patel;PARTSTAT=TENTATIVE:mailto:raj@example.com
DESCRIPTION:Yesterday / today / blockers\\n\\n-::~:~::~:~::~:~::~:~::~:~::~:~::~\\nJoin with Google Meet: https://meet.google.com/abc-defg-hij\\n-::~:~::~:~::~:~::~:~::~:~::~:~::-
END:VEVENT
BEGIN:VEVENT
UID:standup@google.com
RECURRENCE-ID;TZID=America/New_York:20260921T093000
SUMMARY:Platform standup (moved)
DTSTART;TZID=America/New_York:20260921T110000
DTEND;TZID=America/New_York:20260921T111500
X-GOOGLE-CONFERENCE:https://meet.google.com/abc-defg-hij
END:VEVENT
BEGIN:VEVENT
UID:standup@google.com
RECURRENCE-ID;TZID=America/New_York:20260923T093000
STATUS:CANCELLED
DTSTART;TZID=America/New_York:20260923T093000
DTEND;TZID=America/New_York:20260923T094500
END:VEVENT
BEGIN:VEVENT
UID:acme-demo@google.com
SUMMARY:Acme demo
DTSTART:20260922T180000Z
DTEND:20260922T190000Z
LOCATION:https://acme.zoom.us/j/123456789?pwd=xyz
ORGANIZER:mailto:maya@example.com
ATTENDEE;CN=Dana (Acme);PARTSTAT=NEEDS-ACTION:mailto:dana@acme.example
ATTENDEE;CN=Broken:mailto:not-an-email
END:VEVENT
BEGIN:VEVENT
UID:roadmap@google.com
SUMMARY:Roadmap review
DTSTART:20260924T150000Z
DTEND:20260924T160000Z
DESCRIPTION:<b>Agenda</b><br>1. Q4 bets &amp; risks<br>Join: https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc%40thread.v2/0
END:VEVENT
BEGIN:VEVENT
UID:offsite@google.com
SUMMARY:Offsite (all day)
DTSTART;VALUE=DATE:20260925
DTEND;VALUE=DATE:20260926
END:VEVENT
BEGIN:VEVENT
UID:lunch@google.com
SUMMARY:Lunch (no link)
DTSTART:20260922T160000Z
DTEND:20260922T170000Z
LOCATION:Cafe downstairs
END:VEVENT
BEGIN:VEVENT
UID:dropped@google.com
SUMMARY:Cancelled sync
STATUS:CANCELLED
DTSTART:20260922T200000Z
DTEND:20260922T203000Z
LOCATION:https://meet.google.com/zzz-zzzz-zzz
END:VEVENT
${extra}END:VCALENDAR`;

const NOW = new Date("2026-09-19T12:00:00Z");
const FROM = new Date(NOW.getTime() - 7 * 86_400_000), TO = new Date(NOW.getTime() + 30 * 86_400_000);
const okFeed = (body: string) => async () => new Response(body, { status: 200 });

async function main() {
  // Vault: round trip; tampering, a wrong key or no key fail loudly.
  const sealed = seal("dg_secret_value");
  assert.notEqual(sealed, seal("dg_secret_value"), "fresh IV per seal");
  assert.equal(open(sealed), "dg_secret_value");
  const [v, iv, tag, ct] = sealed.split(".");
  assert.throws(() => open([v, iv, tag, ct!.slice(0, -2) + (ct!.endsWith("A") ? "B" : "A")].join(".")));
  assert.throws(() => open(sealed, "another-secret-key-also-32-characters-long"));
  assert.throws(() => seal("x", "short"));
  console.log("✓ vault: AES-256-GCM round trip; tamper / wrong key / weak key rejected");

  const client = new PGlite();
  const db = drizzle({ client, schema: s });
  await migrate(db, { migrationsFolder: "drizzle" });
  const [maya, raj] = await db.insert(s.users).values([{ name: "Maya Chen", email: "maya@example.com" }, { name: "Raj Patel", email: "raj@example.com" }]).returning();

  // BYOK precedence: tenant key → env key → none, per user.
  delete process.env.HF_TOKEN;
  process.env.DEEPGRAM_API_KEY = "server-deepgram-key";
  await saveKey(db, maya!.id, "deepgram", "maya-own-deepgram-key");
  await saveKey(db, maya!.id, "deepgram", "maya-rotated-deepgram-key");
  assert.deepEqual(await resolveKey(db, maya!.id, "deepgram"), { key: "maya-rotated-deepgram-key", source: "tenant" });
  assert.deepEqual(await resolveKey(db, raj!.id, "deepgram"), { key: "server-deepgram-key", source: "env" });
  assert.equal(await resolveKey(db, raj!.id, "huggingface"), null);
  const row = await db.query.userSecrets.findFirst({ where: eq(s.userSecrets.userId, maya!.id) });
  assert.ok(!row!.ciphertext.includes("maya-rotated") && row!.last4 === "-key", "stored sealed, only last 4 in clear");
  console.log("✓ BYOK: tenant key beats server env key, rotation upserts, other tenants fall back to env");

  // iCal parsing.
  const { events, skipped } = parseFeed(ics(), FROM, TO);
  const standups = events.filter((e) => e.externalId.startsWith("standup@"));
  assert.deepEqual(standups.map((e) => e.startsAt.toISOString()), [
    "2026-09-14T13:30:00.000Z", "2026-09-21T15:00:00.000Z", "2026-09-28T13:30:00.000Z", "2026-09-30T13:30:00.000Z",
    "2026-10-05T13:30:00.000Z", "2026-10-07T13:30:00.000Z", "2026-10-12T13:30:00.000Z", "2026-10-14T13:30:00.000Z",
  ], "EDT offsets applied; EXDATE (16th) and cancelled instance (23rd) removed; 21st moved to 11:00");
  const moved = standups[1]!;
  assert.equal(moved.title, "Platform standup (moved)");
  assert.equal(moved.externalId, "standup@google.com/2026-09-21T13:30:00.000Z", "occurrence id is its original slot, so moving it updates the same row");
  assert.equal(standups[0]!.agenda, "Yesterday / today / blockers", "Google's Meet boilerplate stripped");
  assert.deepEqual(standups[0]!.attendees.map((a) => [a.email, a.responseStatus, a.isOrganizer]), [["maya@example.com", "accepted", true], ["raj@example.com", "tentative", false]]);
  const demo = events.find((e) => e.title === "Acme demo")!;
  assert.deepEqual([demo.platform, demo.meetingUrl, demo.attendees.length], ["zoom", "https://acme.zoom.us/j/123456789?pwd=xyz", 1]);
  const roadmap = events.find((e) => e.title === "Roadmap review")!;
  assert.equal(roadmap.platform, "teams");
  assert.equal(roadmap.agenda, "Agenda\n1. Q4 bets & risks\nJoin: https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc%40thread.v2/0");
  assert.ok(!events.some((e) => /Offsite|Lunch|Cancelled/.test(e.title)) && skipped === 1, "all-day, cancelled and link-less events skipped");
  console.log(`✓ iCal parse: ${standups.length} standup occurrences (TZ, EXDATE, moved + cancelled instances), Zoom/Meet/Teams links, attendees, agenda cleanup`);

  // Fetch hardening: allowlisted https hosts only, also across redirects; size and content checks.
  for (const bad of ["http://calendar.google.com/x.ics", "https://evil.example/x.ics", "https://calendar.google.com.evil.example/x.ics", "https://u:p@calendar.google.com/x.ics", "https://calendar.google.com:8443/x.ics", "https://169.254.169.254/latest", "nonsense"]) {
    assert.throws(() => checkFeedUrl(bad), FeedError, bad);
  }
  assert.equal(checkFeedUrl("webcal://p42-caldav.icloud.com/published/2/abc").href, "https://p42-caldav.icloud.com/published/2/abc");
  const redirect = (to: string) => async () => new Response(null, { status: 302, headers: { location: to } });
  await assert.rejects(fetchFeed(checkFeedUrl(FEED), redirect("http://127.0.0.1:5432/")), (e: FeedError) => e.status === 400, "redirect to an internal host");
  let hops = 0;
  const chain = async (url: string) => (hops++ === 0 ? new Response(null, { status: 301, headers: { location: "https://outlook.office365.com/owa/calendar/x/reachcalendar.ics" } }) : new Response(ics(), { status: 200, headers: { "x-url": url } }));
  assert.ok((await fetchFeed(checkFeedUrl(FEED), chain)).includes("BEGIN:VCALENDAR") && hops === 2, "allowlisted redirect followed");
  await assert.rejects(fetchFeed(checkFeedUrl(FEED), okFeed("<html>login</html>")), /didn't return an iCal/);
  await assert.rejects(fetchFeed(checkFeedUrl(FEED), okFeed("BEGIN:VCALENDAR" + "x".repeat(6 * 1024 * 1024))), /larger than 5 MB/);
  await assert.rejects(fetchFeed(checkFeedUrl(FEED), async () => new Response("nope", { status: 404 })), (e: FeedError) => e.status === 404);
  console.log("✓ feed fetch: https + host allowlist (incl. redirects), 5 MB cap, must be iCal, 404 → 'address reset'");

  // Sync into the events schema: sealed address, idempotent upserts, removals, error state.
  const first = await connectIcs(db, maya!.id, FEED, okFeed(ics()));
  const conn = await db.query.calendarConnections.findFirst({ where: and(eq(s.calendarConnections.userId, maya!.id), eq(s.calendarConnections.provider, "ics")) });
  assert.ok(conn!.feedUrlSecret && !conn!.feedUrlSecret.includes("private-abc123") && open(conn!.feedUrlSecret) === FEED, "feed address stored sealed");
  const again = await syncIcs(db, maya!.id, okFeed(ics()), NOW);
  assert.equal(again.removed, 0);
  const count = async () => (await db.query.calendarEvents.findMany({ where: eq(s.calendarEvents.connectionId, conn!.id) })).length;
  assert.equal(await count(), again.synced, "re-sync doesn't duplicate");
  const withoutDemo = ics().replace(/BEGIN:VEVENT\nUID:acme-demo[\s\S]*?END:VEVENT\n/, "");
  const third = await syncIcs(db, maya!.id, okFeed(withoutDemo), NOW);
  assert.deepEqual([third.removed, await count()], [1, again.synced - 1], "event deleted upstream is removed");
  await assert.rejects(syncIcs(db, maya!.id, okFeed("<html/>"), NOW));
  const failed = await db.query.calendarConnections.findFirst({ where: eq(s.calendarConnections.id, conn!.id) });
  assert.deepEqual([failed!.status, failed!.lastSyncError], ["disconnected", "that address didn't return an iCal calendar"]);
  assert.equal(await count(), again.synced - 1, "a failed sync leaves existing events alone");
  console.log(`✓ iCal sync: ${first.synced} events upserted (idempotent), upstream deletion removed, failures recorded without data loss`);

  // Two-stream merger: out-of-order arrivals committed in order; a silent source can't stall the other.
  const L = (source: "mic" | "tab", startMs: number, endMs: number, text: string): CapturedLine => ({ source, speaker: source === "mic" ? MIC : 0, startMs, endMs, text });
  const m = new LineMerger(3_000);
  m.push([L("tab", 1_000, 2_000, "them 1")]);
  assert.deepEqual(m.release(2_500), [], "held while the mic might still report something earlier");
  m.push([L("mic", 500, 1_800, "me 1"), L("mic", 2_200, 3_000, "me 2")]);
  assert.deepEqual(m.release(3_100).map((l) => l.text), ["me 1", "them 1"], "both sources past 2s → released in start order");
  m.push([L("mic", 4_000, 5_000, "me 3")]);
  assert.deepEqual(m.release(7_500).map((l) => l.text), ["me 2", "me 3"], "silent tab doesn't block past the hold");
  m.push([L("tab", 3_500, 4_200, "late them")]);
  const late = m.release(9_000);
  assert.deepEqual([late[0]!.text, late[0]!.startMs], ["late them", 4_000], "straggler clamped forward to keep order");
  m.push([L("tab", 20_000, 21_000, "tail")]);
  assert.deepEqual(m.release(0, true).map((l) => l.text), ["tail"], "end of call flushes everything");
  console.log("✓ dual-stream merger: ordered commits across mic + tab, hold window, straggler clamp, final flush");

  // Sliding-window rate limit: exact under concurrency, bounded storage, window slides.
  const burst = await Promise.all(Array.from({ length: 12 }, () => takeToken(db, "dg:user:burst", 5, 1_500)));
  assert.equal(burst.filter((r) => r.ok).length, 5, "12 concurrent requests, limit 5 → exactly 5 pass");
  const denied = burst.find((r) => !r.ok) as { retryAfterSec: number };
  assert.ok(denied.retryAfterSec >= 1 && denied.retryAfterSec <= 2);
  const stored = await db.query.rateLimits.findFirst({ where: eq(s.rateLimits.key, "dg:user:burst") });
  assert.equal(stored!.hits.length, 5, "denied hits aren't stored");
  await new Promise((r) => setTimeout(r, 1_600));
  assert.ok((await takeToken(db, "dg:user:burst", 5, 1_500)).ok, "window slid");
  assert.equal((await db.query.rateLimits.findFirst({ where: eq(s.rateLimits.key, "dg:user:burst") }))!.hits.length, 1, "expired hits pruned");
  console.log("✓ rate limit: 5/12 concurrent pass, Retry-After computed, denied hits not stored, window slides and prunes");

  // Sweeper: stale calls, dead workers, stuck meetings, then drains due work.
  await db.insert(s.templates).values(templates);
  const ago = (min: number) => new Date(Date.now() - min * 60_000);
  const meeting = async (title: string, status: "live" | "processing", updatedMin: number) => {
    const [m] = await db.insert(s.meetings).values({ ownerId: maya!.id, title, platform: "google_meet", status, startedAt: ago(updatedMin + 5), liveUpdatedAt: ago(updatedMin), liveClockMs: 60_000, liveSpeed: 1 }).returning();
    return m!;
  };
  const talked = await meeting("Went quiet after talking", "live", 31);
  const [p] = await db.insert(s.meetingParticipants).values({ meetingId: talked.id, name: "Maya Chen", speakerIdx: 0, color: "#6366F1", userId: maya!.id }).returning();
  await db.insert(s.transcriptSegments).values([
    { meetingId: talked.id, seq: 0, participantId: p!.id, speakerName: "Maya Chen", startMs: 1_000, endMs: 4_000, text: "We decided to ship the beta on Monday." },
    { meetingId: talked.id, seq: 1, participantId: p!.id, speakerName: "Maya Chen", startMs: 5_000, endMs: 9_000, text: "I'll send the release notes by Thursday." },
  ]);
  const silent = await meeting("Opened and forgotten", "live", 45);
  const active = await meeting("Still going", "live", 2);
  const dead = await meeting("Worker died, retries left", "processing", 10);
  const doomed = await meeting("Worker died, out of retries", "processing", 10);
  const job = (meetingId: string, attempts: number) => ({ key: `chunk:${meetingId}:0`, meetingId, kind: "chunk_notes" as const, payload: { windowIdx: 0 }, status: "running" as const, attempts, maxAttempts: 3, lockedUntil: ago(1) });
  await db.insert(s.processingJobs).values([job(dead.id, 1), job(doomed.id, 3)]);

  const report = await sweep(db);
  const status = async (id: string) => (await db.query.meetings.findFirst({ where: eq(s.meetings.id, id), columns: { status: true } }))!.status;
  const jobOf = async (id: string) => (await db.query.processingJobs.findFirst({ where: eq(s.processingJobs.meetingId, id) }))!;
  assert.deepEqual([report.reclaimedJobs, report.endedStaleCalls, report.abandonedCalls, report.failedMeetings], [2, 1, 1, 1], JSON.stringify(report));
  assert.deepEqual([await status(talked.id), await status(silent.id), await status(active.id), await status(doomed.id)], ["ready", "abandoned", "live", "failed"]);
  assert.equal((await jobOf(dead.id)).status, "succeeded", "requeued and drained in the same sweep");
  const notes = await db.query.actionItems.findMany({ where: eq(s.actionItems.meetingId, talked.id) });
  assert.ok(notes.some((a) => /release notes/.test(a.text)), "auto-ended call still got its notes");
  assert.deepEqual(Object.values(await sweep(db)).slice(0, 5), [0, 0, 0, 0, 0], "second sweep is a no-op");
  console.log(`✓ sweeper: stale call with lines → ended + notes, silent call → abandoned, live call untouched; dead worker → requeued + drained, out of retries → meeting failed; idempotent (${report.ms}ms)`);

  await client.close();
  console.log("\nOpen core verified.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
