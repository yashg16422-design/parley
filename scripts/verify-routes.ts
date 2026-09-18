/**
 * BASE_URL=http://localhost:3100 tsx scripts/verify-routes.ts
 *
 * Drives the running server over HTTP: replays the first ~12.5 minutes of the
 * hour-long call at 60x through /api/ingest (with a resend, a clock cheat and a
 * seq gap along the way), ends it, waits for processing, then exercises
 * /api/summary. Finally calls the search Server Action in-process.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stableId } from "../src/lib/stable-id";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const HERO = stableId("meeting:q4-product-alignment");
const SPEED = 60;
const TICK_MS = 500;
const REPLAY_MS = 12.5 * 60_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const MAYA = stableId("user:maya@driftwood.example");
const post = async (body: object, uid: string | null = MAYA) => {
  const headers: Record<string, string> = { "content-type": "application/json", ...(uid ? { cookie: `parley_uid=${uid}` } : {}) };
  const r = await fetch(`${BASE}/api/ingest`, { method: "POST", headers, body: JSON.stringify(body) });
  return { status: r.status, body: (await r.json()) as Record<string, unknown> };
};
const summary = async (meetingId: string, templateId?: string) => {
  const r = await fetch(`${BASE}/api/summary?meetingId=${meetingId}${templateId ? `&templateId=${templateId}` : ""}`);
  if (!r.headers.get("content-type")?.includes("ndjson")) return { status: r.status, events: [] as Record<string, unknown>[] };
  return { status: r.status, events: (await r.text()).trim().split("\n").map((l) => JSON.parse(l) as Record<string, unknown>) };
};

async function main() {
  const source = JSON.parse(readFileSync("seed/fixtures/meetings/q4-product-alignment.json", "utf8")).meetings[0];
  const segments: [number, number, number, string][] = source.segments;

  // Start.
  const start = await post({ op: "start", sourceMeetingId: HERO, speed: SPEED });
  assert.equal(start.status, 201, JSON.stringify(start.body));
  const meetingId = start.body.meetingId as string;
  assert.equal((start.body.participants as unknown[]).length, 8);
  assert.equal((await post({ op: "start", sourceMeetingId: HERO, speed: 90 })).status, 400, "speed is capped at 60x");
  assert.equal((await post({ op: "start", sourceMeetingId: HERO, speed: 60 }, null)).status, 401, "starting a call needs a workspace session");

  // Replay at 60x: every 500ms of wall time the clock moves 30s.
  let clockMs = 0, sent = 0, queued = 0, lastBatch: object | null = null;
  const t0 = Date.now();
  while (clockMs < REPLAY_MS) {
    await sleep(TICK_MS);
    clockMs = Math.min(REPLAY_MS, (Date.now() - t0) * SPEED);
    const batch = segments.slice(sent).filter(([, , end]) => end <= clockMs);
    if (!batch.length) continue;
    const body = { op: "append", meetingId, clockMs, speed: SPEED, fromSeq: sent, lines: batch.map(([speakerIdx, startMs, endMs, text]) => ({ speakerIdx, startMs, endMs, text })) };
    const r = await post(body);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.accepted, batch.length);
    sent += batch.length;
    queued += r.body.queued as number;
    lastBatch = body;
  }
  const wall = Date.now() - t0;
  console.log(`✓ replayed ${sent} lines / ${REPLAY_MS / 60_000} min of call in ${(wall / 1000).toFixed(1)}s at ${SPEED}x; ${queued} window job(s) queued mid-call`);
  assert.equal(queued, 1, "the first 10-minute window closed during the call");

  const resend = await post(lastBatch!);
  assert.deepEqual([resend.status, resend.body.accepted], [200, 0], "resending a batch is harmless");
  const cheat = await post({ op: "append", meetingId, clockMs: clockMs + 20 * 60_000, speed: SPEED, fromSeq: sent, lines: [{ speakerIdx: 0, startMs: clockMs + 1000, endMs: clockMs + 2000, text: "from the future" }] });
  assert.equal(cheat.status, 429, "clock can't outrun the speed limit");
  const gap = await post({ op: "append", meetingId, clockMs, speed: SPEED, fromSeq: sent + 5, lines: [{ speakerIdx: 0, startMs: clockMs - 1000, endMs: clockMs, text: "gap" }] });
  assert.equal(gap.status, 409, "seq gaps are rejected");
  assert.equal((await post({ op: "append", meetingId, clockMs, speed: SPEED, fromSeq: sent, lines: [] })).status, 400);
  console.log("✓ resend idempotent; 20-minute clock jump → 429; seq gap → 409; empty batch → 400");

  // End and wait for background processing (no HF_TOKEN → simulated outputs).
  const end = await post({ op: "end", meetingId, clockMs });
  assert.equal(end.status, 200, JSON.stringify(end.body));
  let state: { status: string; jobs: { kind: string; status: string; lastError: string | null }[] } = { status: "", jobs: [] };
  for (let i = 0; i < 40 && state.status !== "ready"; i++) {
    await sleep(250);
    state = await (await fetch(`${BASE}/api/ingest?meetingId=${meetingId}`)).json();
  }
  assert.equal(state.status, "ready", JSON.stringify(state));
  assert.ok(state.jobs.length === 3 && state.jobs.every((j) => j.status === "succeeded"), JSON.stringify(state.jobs));
  assert.equal((await post({ op: "append", meetingId, clockMs, speed: SPEED, fromSeq: sent, lines: [{ speakerIdx: 0, startMs: 1, endMs: 2, text: "late" }] })).status, 409, "ended calls reject lines");
  console.log(`✓ end → processed in background → ready; jobs: ${state.jobs.map((j) => `${j.kind}:${j.status}`).join(", ")}`);

  // Summaries.
  const live = await summary(meetingId);
  const meta = live.events.find((e) => e.type === "meta");
  const sections = live.events.filter((e) => e.type === "section").map((e) => e.section as { id: string; items: { seqs: number[] }[] });
  assert.equal(meta?.source, "simulated");
  assert.equal(sections.length, 7, "product_review has 7 sections");
  assert.ok(sections.every((sec) => sec.items.every((i) => i.seqs.every((q) => q < sent))), "no citation beyond the replayed lines");
  assert.equal(live.events.at(-1)?.type, "done");

  const cached = await summary(HERO, "product_review");
  assert.deepEqual([cached.events[1]?.source, cached.events[1]?.model], ["cache", "claude-opus-5"]);
  const switched = await summary(HERO, "interview");
  const switchedSections = switched.events.filter((e) => e.type === "section");
  assert.equal(switched.events[1]?.source, "simulated");
  assert.equal(switchedSections.length, 6, "interview template has 6 sections");
  assert.equal((await summary(HERO, "interview")).events[1]?.source, "simulated", "simulated result is cached, not rebuilt");
  assert.equal((await summary(stableId("meeting:nope"))).status, 404);
  assert.equal((await summary("not-a-uuid")).status, 400);
  const unknownTpl = await summary(HERO, "no-such-template");
  assert.deepEqual([unknownTpl.events.at(-1)?.type, unknownTpl.events.at(-1)?.status], ["error", 404]);
  console.log("✓ summary: live meeting simulated (7 sections, citations in range); seeded → cache; template switch → simulated; bad input → 400/404");

  // Live mic path: a real-time (1x) call linked to a calendar event, rule-based notes without a model.
  const goNoGo = stableId("event:up-go-no-go");
  const mic = await post({ op: "start_mic", title: "Beta go/no-go (mic test)", participants: ["Maya Chen", "Raj Patel"], calendarEventId: goNoGo });
  assert.equal(mic.status, 201, JSON.stringify(mic.body));
  const micId = mic.body.meetingId as string;
  const said = [
    [0, "Okay, let's look at the precision numbers before we decide anything."],
    [1, "We're at eighty-one percent on the new set, so still below the bar."],
    [0, "Agreed, we ship the beta on schedule and keep GA gated. I'll send the update to leadership today."],
    [1, "I'll rerun the latency test tomorrow and share the p95 numbers."],
  ] as const;
  const m0 = Date.now();
  let seq = 0;
  for (const [speakerIdx, text] of said) {
    await sleep(700);
    const now = Date.now() - m0;
    const r = await post({ op: "append", meetingId: micId, clockMs: now, speed: 1, fromSeq: seq, lines: [{ speakerIdx, startMs: Math.max(0, now - 600), endMs: now, text }] });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    seq++;
  }
  assert.equal((await post({ op: "append", meetingId: micId, clockMs: 10 * 60_000, speed: 1, fromSeq: seq, lines: [{ speakerIdx: 0, startMs: 1, endMs: 2, text: "x" }] })).status, 429, "1x clock is enforced for mic calls too");
  assert.equal((await post({ op: "end", meetingId: micId, clockMs: Date.now() - m0 })).status, 200);
  let micState = { status: "" };
  for (let i = 0; i < 40 && micState.status !== "ready"; i++) (await sleep(250)), (micState = await (await fetch(`${BASE}/api/ingest?meetingId=${micId}`)).json());
  assert.equal(micState.status, "ready");
  const micSummary = await summary(micId);
  const micSections = micSummary.events.filter((e) => e.type === "section").map((e) => e.section as { id: string; items: { text: string }[] });
  assert.equal(micSummary.events[1]?.source, "simulated");
  const nextSteps = micSections.find((x) => x.id === "next_steps")!.items.map((i) => i.text);
  assert.ok(nextSteps.some((t) => /send the update to leadership/.test(t)) && nextSteps.some((t) => /rerun the latency test/.test(t)), JSON.stringify(nextSteps));
  assert.ok(micSections.find((x) => x.id === "decisions")!.items.some((i) => /ship the beta on schedule/.test(i.text)));
  console.log(`✓ mic call: 4 lines at 1x, linked to calendar event, rule-based notes → ${nextSteps.length} next steps, decision captured`);

  console.log("\nRoutes verified.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
