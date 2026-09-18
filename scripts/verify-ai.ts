/**
 * npm run db:verify (second half)
 *
 * Runs the real AI pipeline against the real fixtures in PGlite, with a scripted
 * fake model that misbehaves on purpose: prose around its JSON, one broken
 * reply, citations to lines that don't exist, invented quotes, wrong line
 * numbers, an unknown template section. Then checks synonym search.
 */
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { and, asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { modelChunkNotes } from "../src/ai/ground";
import { extractJson, type LlmClient } from "../src/ai/llm";
import { processMeeting, processWindows } from "../src/ai/pipeline";
import { drainMeeting } from "../src/jobs";
import { closedWindows, planWindows, type Seg } from "../src/ai/windows";
import * as s from "../src/db/schema";
import { loadFixtures } from "../src/db/seed/fixtures";
import { seed } from "../src/db/seed/seed";
import { stableId } from "../src/lib/stable-id";
import { expandQuery, searchTranscripts } from "../src/search";

const FAKE = 999_999;
const lineRe = /^\[#(\d+) \S+ [^\]]+\] (.*)$/gm;

/** A deliberately unreliable model. Counts calls so idempotency can be checked. */
function fakeModel() {
  let brokeOnce = false;
  const llm: LlmClient & { calls: number } = {
    model: "fake/unreliable",
    calls: 0,
    async complete(messages) {
      llm.calls++;
      const u = messages.find((m) => m.role === "user")!.content; // the task, as a real model would read it
      const wrap = (o: unknown) => `Sure! Here is the JSON:\n\`\`\`json\n${JSON.stringify(o)}\n\`\`\`\nLet me know if you need more.`;
      if (u.includes("Extract notes")) {
        if (!brokeOnce) return (brokeOnce = true), '{"topics": [ {"title": "unterminated';
        const lines = [...u.matchAll(lineRe)].map((m) => ({ seq: Number(m[1]), text: m[2]! }));
        const [a, b, c] = [lines[4]!, lines[5]!, lines[6]!];
        const quote = (t: string) => t.split(" ").slice(0, 6).join(" ");
        return wrap({
          topics: [{ title: "Topic", summary: "x", seqs: [`#${a.seq}`] }],
          decisions: [{ text: "invented decision", seqs: [FAKE] }],
          actionItemCandidates: [
            { text: "grounded", owner: "Maya", dueText: null, evidenceQuote: quote(a.text), seqs: [a.seq] },
            { text: "wrong line", owner: "raj", evidenceQuote: quote(b.text), seqs: [c.seq] },
            { text: "no such line", owner: null, evidenceQuote: "we will double every price", seqs: [FAKE] },
            { text: "made-up quote", owner: "Nobody", evidenceQuote: "we promise a free pony", seqs: [c.seq] },
          ],
          notableMoments: [{ text: "moment", seqs: [b.seq, FAKE] }],
        });
      }
      if (u.includes("Merge them")) {
        const parts = [...u.matchAll(/^Part \d+: (.*)$/gm)].map((m) => JSON.parse(m[1]!));
        return wrap({
          overview: "Merged overview.",
          topics: parts.flatMap((p) => p.topics),
          decisions: [{ text: "invented", seqs: [FAKE] }],
          speakerContributions: [{ speaker: "Maya Chen", summary: "led" }],
          actionItems: [...parts.flatMap((p) => p.actionItemCandidates), { text: "hallucinated", evidenceQuote: "nothing like this was said", seqs: [FAKE] }],
        });
      }
      const ids = [...u.matchAll(/^- "([^"]+)"/gm)].map((m) => m[1]!);
      const seq = Number(/"seqs":\[(\d+)/.exec(u)?.[1]);
      return wrap({ sections: [...ids.map((id) => ({ id, items: [{ text: `about ${id}`, seqs: [seq, FAKE] }, { text: "ghost", seqs: [FAKE] }] })), { id: "bogus", items: [{ text: "x", seqs: [seq] }] }] });
    },
  };
  return llm;
}

async function main() {
  const client = new PGlite();
  const db = drizzle({ client, schema: s });
  await migrate(db, { migrationsFolder: "drizzle" });
  await seed(db, (await loadFixtures("seed/fixtures")).dataset);

  // JSON extraction tolerates prose, fences and braces inside strings; wrong shapes are rejected.
  assert.deepEqual(extractJson('ok ```json\n{"a":"x}y","b":[1]}\n``` bye'), { a: "x}y", b: [1] });
  assert.equal(modelChunkNotes.safeParse({ sections: [] }).success, false, "a summary-shaped reply is not valid window notes");

  // Windowing: the hero meeting partitions into contiguous ~10 minute windows.
  const heroId = stableId("meeting:q4-product-alignment");
  const segs = (await db.select().from(s.transcriptSegments).where(eq(s.transcriptSegments.meetingId, heroId)).orderBy(asc(s.transcriptSegments.seq))) as Seg[];
  const wins = planWindows(segs);
  assert.equal(wins.length, 6);
  assert.equal(wins[0]!.firstSeq, 0);
  assert.equal(wins.at(-1)!.lastSeq, segs.length - 1);
  wins.slice(1).forEach((w, i) => {
    assert.equal(w.firstSeq, wins[i]!.lastSeq + 1, "no gaps or overlaps between windows");
    assert.notEqual(segs[w.firstSeq]!.participantId, segs[w.firstSeq - 1]!.participantId, "cuts land on speaker changes");
    assert.equal(w.contextSeq, w.firstSeq - 3, "3 lines of lead-in");
  });
  assert.ok(wins.every((w) => w.endMs - w.startMs <= 11 * 60_000));
  assert.equal(closedWindows(segs, false).length, 5, "live call holds back the open window");
  console.log(`✓ windows: ${wins.map((w) => `${w.firstSeq}-${w.lastSeq}`).join(", ")}`);

  // Live call: process closed windows, then finish. Nothing is paid for twice.
  const llm = fakeModel();
  const live = await processWindows(db, heroId, { llm }, false);
  assert.deepEqual([live.processed, live.skipped], [5, 0]);
  assert.equal(llm.calls, 6, "5 windows + 1 repair retry for the broken reply");
  const result = await processMeeting(db, heroId, { llm });
  assert.deepEqual([result.windows.processed, result.windows.skipped], [1, 5], "only the last window is new");
  console.log("✓ live-then-final processing is incremental; broken JSON repaired by retry");

  // Grounding counters across all stages. Each window: 1 fake decision + 1 fake-line action
  // dropped, 1 invented quote flagged (again at merge). A "wrong line" whose quote also
  // appears in the cited line is rightly kept, not repaired (happens in 1 window here).
  const r = result.grounding;
  const g = { kept: r.kept + live.report.kept, dropped: r.dropped + live.report.dropped, repaired: r.repaired + live.report.repaired, flagged: r.flagged + live.report.flagged };
  assert.equal(g.flagged, 2 * wins.length, JSON.stringify(g));
  assert.ok(g.dropped >= 2 * wins.length && g.repaired >= wins.length - 1, JSON.stringify(g));
  const chunkRows = await db.select().from(s.chunkNotes).where(and(eq(s.chunkNotes.meetingId, heroId), eq(s.chunkNotes.promptVersion, "hf-v1")));
  assert.ok(chunkRows.length === wins.length && chunkRows.every((c) => c.notes.actionItemCandidates.length === 3), "every window kept its 3 grounded candidates");
  const actions = await db.select().from(s.actionItems).where(and(eq(s.actionItems.meetingId, heroId), eq(s.actionItems.origin, "ai")));
  const seqSet = new Set(segs.map((x) => x.seq));
  assert.equal(actions.length, 3 * wins.length, "18 candidates survive the merge");
  assert.ok(actions.every((a) => a.sourceSeqs.length && a.sourceSeqs.every((q) => seqSet.has(q))), "no action cites a missing line");
  assert.ok(!actions.some((a) => a.text === "no such line" || a.text === "hallucinated"), "fully hallucinated items are dropped");
  const flagged = actions.filter((a) => !a.verified);
  assert.ok(flagged.length > 0 && flagged.every((a) => a.text === "made-up quote"), "invented quotes are kept but flagged");
  const repaired = actions.filter((a) => a.text === "wrong line");
  assert.ok(repaired.every((a) => a.verified && segs[a.sourceSeqs[0]!]!.text.startsWith(a.evidenceQuote!)), "wrong citations re-pointed to the quoted line");
  assert.ok(actions.some((a) => a.assigneeParticipantId !== null && a.assigneeName === "raj"), "owner matched by first name");
  const manual = await db.select().from(s.actionItems).where(and(eq(s.actionItems.meetingId, heroId), eq(s.actionItems.origin, "manual")));
  assert.equal(manual.length, 1, "manual action items survive re-processing");
  console.log(`✓ grounding: ${JSON.stringify(g)} → ${actions.length} AI actions, ${flagged.length} flagged`);

  // Summary: template decides sections; fake citations and unknown sections are gone.
  const summary = await db.query.summaries.findFirst({ where: and(eq(s.summaries.meetingId, heroId), eq(s.summaries.promptVersion, "hf-v1")) });
  const tpl = await db.query.templates.findFirst({ where: eq(s.templates.id, "product_review") });
  assert.equal(summary?.status, "ready");
  assert.deepEqual(summary!.content!.sections.map((x) => x.id), tpl!.sections.map((x) => x.id));
  assert.ok(summary!.content!.sections.every((x) => x.items.every((i) => i.seqs.length && i.seqs.every((q) => seqSet.has(q)))));
  const meeting = await db.query.meetings.findFirst({ where: eq(s.meetings.id, heroId) });
  assert.equal(meeting?.status, "ready");
  console.log("✓ summary rendered in template order; ghost items and bogus section discarded");

  // A model that never produces valid JSON fails the meeting cleanly.
  const junk: LlmClient = { model: "junk", complete: async () => "I cannot help with that." };
  const otherId = stableId("meeting:globex-security-review");
  await db.delete(s.chunkNotes).where(eq(s.chunkNotes.meetingId, otherId));
  await assert.rejects(processMeeting(db, otherId, { llm: junk, promptVersion: "junk" }), /failed validation/);
  assert.equal((await db.query.meetings.findFirst({ where: eq(s.meetings.id, otherId) }))?.status, "failed");
  console.log("✓ invalid model output fails the meeting instead of storing junk");

  // Job queue: a failing model re-queues with backoff, then fails for good at max_attempts.
  // (13.6-minute interview: its first window is closed while "live", so a model call happens.)
  const retryId = stableId("meeting:interview-backend-jordan");
  await db.insert(s.processingJobs).values({ key: "chunk:retry-test", meetingId: retryId, kind: "chunk_notes" });
  const jobState = async () => (await db.query.processingJobs.findFirst({ where: eq(s.processingJobs.key, "chunk:retry-test") }))!;
  for (let i = 1; i <= 3; i++) {
    assert.ok((await drainMeeting(db, retryId, junk)).error);
    const j = await jobState();
    assert.deepEqual([j.attempts, j.status], [i, i < 3 ? "queued" : "failed"]);
    assert.ok(j.runAfter > new Date() && /failed validation/.test(j.lastError ?? ""));
    await db.update(s.processingJobs).set({ runAfter: new Date(0) }).where(eq(s.processingJobs.key, "chunk:retry-test"));
  }
  assert.deepEqual(await drainMeeting(db, retryId, junk), { ran: 0 }, "failed jobs are not picked up again");
  console.log("✓ job queue: model failure re-queued with backoff twice, then marked failed");

  // Search Server Action, through the same getDb() the app uses.
  process.env.DATABASE_URL = "pglite:";
  const { getDb } = await import("../src/db");
  const appDb = getDb();
  await migrate(appDb as never, { migrationsFolder: "drizzle" });
  await seed(appDb, (await loadFixtures("seed/fixtures")).dataset);
  const { searchAction } = await import("../app/actions/search");
  const res = await searchAction({ query: "single sign-on", limit: 100 });
  assert.ok(res.ok && res.meetings >= 10 && /'sso'/.test(res.expanded));
  assert.ok(res.hits.every((h) => h.href === `/meetings/${h.meetingId}?t=${h.startMs}#line-${h.seq}`));
  assert.deepEqual(await searchAction({ query: "   " }), { ok: false, error: "Too small: expected string to have >=1 characters" });
  console.log(`✓ searchAction: ${res.hits.length} cited hits across ${res.meetings} meetings; empty query rejected`);

  // Synonym search.
  assert.match(await expandQuery(db, "single sign-on"), /'sso'/);
  const meetingsFor = async (q: string) => new Set((await searchTranscripts(db, q, { limit: 1000 })).map((h) => h.meetingId)).size;
  const [sso = 0, longForm, saml, both = 0] = await Promise.all(["SSO", "single sign-on", "SAML", "SSO timeline"].map(meetingsFor));
  assert.ok(sso >= 10 && longForm === sso && saml === sso, `SSO ${sso}, single sign-on ${longForm}, SAML ${saml}`);
  assert.ok(both > 0 && both < sso, "other query terms still narrow the search");
  const hits = await searchTranscripts(db, "single sign-on", { ownerId: stableId("user:aisha@driftwood.example") });
  assert.ok(hits.length > 0 && hits.every((h) => h.parts.some((p) => p.hit) && !h.parts.some((p) => /[\u0002\u0003<]/.test(p.text))), "owner filter + safe highlighted parts");
  console.log(`✓ search: "single sign-on" ${longForm} meetings (was 2), "SSO" ${sso}, "SAML" ${saml}, "SSO timeline" ${both}`);

  await client.close();
  console.log("\nAI pipeline verified.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
