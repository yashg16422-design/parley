/**
 * npm run db:verify
 *
 * Applies drizzle/ migrations to an in-memory Postgres (PGlite), runs the real
 * seed on a small smoke dataset, and asserts the schema behaves: relations,
 * search indexes, range queries, constraints, deterministic re-seed. Then loads
 * the real seed/fixtures the same way db:seed does and sanity-checks them.
 * Needs no DATABASE_URL - runs anywhere, including CI.
 */
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "../src/db/schema";
import { datasetSchema, type DatasetInput, loadFixtures } from "../src/db/seed/fixtures";
import { seed } from "../src/db/seed/seed";
import { stableId } from "../src/lib/stable-id";

const smoke: DatasetInput = {
  users: [
    { email: "maya@acme.test", name: "Maya Chen", title: "Head of Product" },
    { email: "raj@acme.test", name: "Raj Patel", title: "Eng Lead" },
  ],
  calendarConnections: [{ userEmail: "maya@acme.test", accountEmail: "maya@acme.test" }],
  calendarEvents: [
    { key: "roadmap", userEmail: "maya@acme.test", title: "Q4 Roadmap Review", startsAt: "D-1@15:00", durationMin: 60, platform: "zoom" },
    { key: "future", userEmail: "maya@acme.test", title: "Pricing sync", startsAt: "D+2@16:30", durationMin: 30, platform: "google_meet" },
  ],
  templates: [
    { id: "general", name: "General", description: "Default", instructions: "Summarize.", isDefault: true, sections: [{ id: "overview", heading: "Overview", guidance: "2-3 sentences" }] },
  ],
  meetings: [
    {
      key: "roadmap",
      ownerEmail: "maya@acme.test",
      calendarEventKey: "roadmap",
      title: "Q4 Roadmap Review",
      platform: "zoom",
      participants: [{ name: "Maya Chen", userEmail: "maya@acme.test" }, { name: "Raj Patel", userEmail: "raj@acme.test" }, { name: "Dana Ortiz", company: "Globex", isExternal: true }],
      segments: [
        [0, 0, 4000, "Let's start with the onboarding revamp."],
        [1, 4000, 9000, "I'll ship the new onboarding checklist by Friday."],
        [2, 9000, 15000, "From the customer side, pricing clarity is our biggest blocker."],
        [0, 15000, 21000, "Agreed. Raj, can you also draft the pricing page experiment?"],
      ],
      highlights: [{ atMs: 9500, label: "Customer pain" }],
      actionItems: [
        { text: "Ship onboarding checklist", assignee: 1, dueText: "by Friday", sourceSeqs: [1], evidenceQuote: "ship the new onboarding checklist by Friday" },
        { text: "Hallucinated item", assignee: 1, sourceSeqs: [2], evidenceQuote: "we will double the price" },
      ],
      clips: [{ slug: "pricing-pain", title: "Pricing is the blocker", startMs: 9000, endMs: 15000 }],
      ai: {
        promptVersion: "v1",
        model: "claude-opus-5",
        summaries: [{ templateId: "general", content: { sections: [{ id: "overview", heading: "Overview", items: [{ text: "Roadmap review.", seqs: [0] }] }] } }],
      },
    },
  ],
};

async function main() {
  const client = new PGlite();
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: "drizzle" });
  console.log("✓ migrations applied");

  const data = datasetSchema.parse(smoke);
  const counts = await seed(db, data);
  assert.equal(counts.transcriptSegments, 4);
  assert.equal(counts.unverifiedActionItems, 1, "ungrounded quote must be flagged unverified");
  console.log("✓ seed ran", counts);

  // Relational query API across the main edges.
  const m = await db.query.meetings.findFirst({
    where: eq(schema.meetings.id, stableId("meeting:roadmap")),
    with: {
      participants: true,
      segments: { orderBy: (t, { asc }) => asc(t.seq) },
      actionItems: { with: { assignee: true } },
      calendarEvent: { with: { connection: true } },
      summaries: { with: { template: true } },
      clips: true,
      highlights: true,
    },
  });
  assert.ok(m);
  assert.equal(m.participants.length, 3);
  assert.equal(m.segments[1]!.speakerName, "Raj Patel");
  assert.equal(m.actionItems[0]!.assignee?.name, "Raj Patel");
  assert.equal(m.actionItems[0]!.verified, true);
  assert.equal(m.actionItems[0]!.sourceStartMs, 4000);
  assert.equal(m.calendarEvent?.connection?.accountEmail, "maya@acme.test");
  assert.equal(m.summaries[0]!.template.name, "General");
  assert.equal(m.durationMs, 21000);
  assert.equal(m.stats?.talkTime[0]!.participantId, m.participants[0]!.id, "Maya talked most");
  console.log("✓ relations + derived stats");

  // Reverse 1:1 (event -> meeting).
  const ev = await db.query.calendarEvents.findFirst({ where: eq(schema.calendarEvents.title, "Q4 Roadmap Review"), with: { meeting: true } });
  assert.equal(ev?.meeting?.id, m.id);
  const upcoming = await db.select().from(schema.calendarEvents).where(gt(schema.calendarEvents.startsAt, new Date()));
  assert.equal(upcoming.length, 1, "relative D+2 event must be in the future");
  console.log("✓ calendar: 1:1 meeting link, relative dates resolve");

  // Full-text search across meetings, ranked, with snippet; uses the GIN index.
  const q = "pricing";
  const hits = await db.execute<{ seq: number; rank: number; snippet: string }>(sql`
    SELECT seq, ts_rank(search, websearch_to_tsquery('english', ${q})) AS rank,
           ts_headline('english', text, websearch_to_tsquery('english', ${q})) AS snippet
    FROM transcript_segments
    WHERE search @@ websearch_to_tsquery('english', ${q})
    ORDER BY rank DESC`);
  assert.deepEqual(hits.rows.map((r) => r.seq).sort(), [2, 3]);
  assert.match(hits.rows[0]!.snippet, /<b>pricing<\/b>/i);
  const bySpeaker = await db.execute(sql`SELECT seq FROM transcript_segments WHERE search @@ websearch_to_tsquery('simple', 'Dana')`);
  assert.equal(bySpeaker.rows.length, 1, "speaker name is searchable");
  console.log("✓ full-text search (ranked, highlighted, speaker-aware)");

  // Clip window = overlap range query on (meeting_id, start_ms).
  const clip = m.clips[0]!;
  const window = await db
    .select({ seq: schema.transcriptSegments.seq })
    .from(schema.transcriptSegments)
    .where(and(eq(schema.transcriptSegments.meetingId, m.id), lt(schema.transcriptSegments.startMs, clip.endMs), gt(schema.transcriptSegments.endMs, clip.startMs)));
  assert.deepEqual(window.map((r) => r.seq), [2]);
  console.log("✓ clip range query");

  // Constraints.
  await assert.rejects(db.insert(schema.clips).values({ slug: "bad", meetingId: m.id, title: "x", startMs: 5000, endMs: 1000 }));
  await assert.rejects(db.insert(schema.transcriptSegments).values({ meetingId: m.id, seq: 1, participantId: m.participants[0]!.id, speakerName: "x", startMs: 0, endMs: 1, text: "dup seq" }));
  await assert.rejects(db.insert(schema.summaries).values({ meetingId: m.id, templateId: "general", promptVersion: "v1" }), "summary cache key is unique");
  console.log("✓ constraints (clip range, segment PK, summary cache key)");

  // Cascade + idempotent, deterministic re-seed.
  await db.delete(schema.meetings).where(eq(schema.meetings.id, m.id));
  const left = await db.execute(sql`SELECT count(*)::int AS n FROM transcript_segments`);
  assert.equal((left.rows[0] as { n: number }).n, 0, "segments cascade with meeting");
  const again = await seed(db, data);
  assert.deepEqual(again, counts);
  const same = await db.query.clips.findFirst({ where: eq(schema.clips.slug, "pricing-pain") });
  assert.equal(same?.id, stableId("clip:pricing-pain"), "ids stable across re-seeds");
  console.log("✓ cascade delete, idempotent + deterministic re-seed");

  // The real fixtures: load them exactly as db:seed would, into this database.
  const { dataset, files } = await loadFixtures("seed/fixtures");
  if (files.length) {
    const t0 = performance.now();
    const real = await seed(db, dataset);
    const ms = Math.round(performance.now() - t0);
    const [{ n }] = (await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM transcript_segments`)).rows as [{ n: number }];
    assert.equal(n, real.transcriptSegments);
    assert.equal(real.unverifiedActionItems, 0, "every AI action item in the fixtures must be grounded");
    const hero = await db.query.meetings.findFirst({ where: eq(schema.meetings.id, stableId("meeting:q4-product-alignment")) });
    assert.ok(hero && hero.durationMs >= 59 * 60_000 && hero.stats?.speakerCount === 8, "hero meeting is 8 speakers, ~60 min");
    const upcoming = await db.select().from(schema.calendarEvents).where(gt(schema.calendarEvents.startsAt, new Date()));
    assert.ok(upcoming.length >= 20, "calendar has plenty of upcoming events");
    const sso = await db.execute(sql`
      SELECT DISTINCT meeting_id FROM transcript_segments
      WHERE search @@ websearch_to_tsquery('english', 'SSO')`);
    assert.ok(sso.rows.length >= 5, "cross-meeting search finds the SSO thread in several meetings");
    console.log(`✓ real fixtures: ${files.length} files seeded in ${ms}ms`, real);
    console.log(`  upcoming events: ${upcoming.length}, meetings mentioning "SSO": ${sso.rows.length}`);
  }

  await client.close();
  console.log("\nSchema verified.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
