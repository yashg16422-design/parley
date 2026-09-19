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
import { createIngestClient } from "../src/capture/dual-stream";
import { wordsToLines } from "../src/lib/deepgram";
import { checkClipRange, muxClipAssetRequest, muxClipPlaybackUrl } from "../src/media";
import { stableId } from "../src/lib/stable-id";
import { signSession } from "../src/session-token";

/** Session cookies are HMAC-signed; the test signs with the same PARLEY_SECRET_KEY as the server under test. */
const sess = (uid: string) => signSession(uid);

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const HERO = stableId("meeting:q4-product-alignment");
const SPEED = 60;
const TICK_MS = 500;
const REPLAY_MS = 12.5 * 60_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const MAYA = stableId("user:maya@driftwood.example");
const post = async (body: object, uid: string | null = MAYA) => {
  const headers: Record<string, string> = { "content-type": "application/json", ...(uid ? { cookie: `parley_uid=${sess(uid)}` } : {}) };
  const r = await fetch(`${BASE}/api/ingest`, { method: "POST", headers, body: JSON.stringify(body) });
  return { status: r.status, body: (await r.json()) as Record<string, unknown> };
};
const summary = async (meetingId: string, templateId?: string) => {
  const r = await fetch(`${BASE}/api/summary?meetingId=${meetingId}${templateId ? `&templateId=${templateId}` : ""}`, { headers: { cookie: `parley_uid=${sess(MAYA)}` } });
  if (!r.headers.get("content-type")?.includes("ndjson")) return { status: r.status, events: [] as Record<string, unknown>[] };
  return { status: r.status, events: (await r.text()).trim().split("\n").map((l) => JSON.parse(l) as Record<string, unknown>) };
};

/** Minimal SSE client: collects events until the server closes the stream. */
function watch(meetingId: string, uid: string | null = MAYA) {
  const events: { event: string; id?: string; data: unknown; at: number }[] = [];
  const done = (async () => {
    const r = await fetch(`${BASE}/api/streams/meetings?meetingId=${meetingId}`, { headers: uid ? { cookie: `parley_uid=${sess(uid)}` } : {} });
    if (!r.ok || !r.body) return r.status;
    let buf = "";
    for await (const chunk of r.body.pipeThrough(new TextDecoderStream())) {
      buf += chunk;
      for (let i; (i = buf.indexOf("\n\n")) >= 0; buf = buf.slice(i + 2)) {
        const f = Object.fromEntries(buf.slice(0, i).split("\n").filter((l) => !l.startsWith(":")).map((l) => [l.slice(0, l.indexOf(":")), l.slice(l.indexOf(":") + 1).trim()]));
        if (f.data) events.push({ event: f.event ?? "message", id: f.id, data: JSON.parse(f.data), at: Date.now() });
      }
    }
    return r.status;
  })();
  return { events, done };
}

function pureChecks() {
  const lines = wordsToLines([
    { word: "okay", punctuated_word: "Okay,", start: 0.2, end: 0.5, speaker: 0 },
    { word: "ship", punctuated_word: "ship", start: 0.6, end: 0.9, speaker: 0 },
    { word: "it", punctuated_word: "it.", start: 0.9, end: 1.1, speaker: 0 },
    { word: "agreed", punctuated_word: "Agreed.", start: 1.4, end: 1.9, speaker: 1 },
  ], 5_000);
  assert.deepEqual(lines, [{ speaker: 0, startMs: 5200, endMs: 6100, text: "Okay, ship it." }, { speaker: 1, startMs: 6400, endMs: 6900, text: "Agreed." }]);
  const mux = { mediaProvider: "mux" as const, mediaAssetId: "a1", mediaPlaybackId: "p1" };
  assert.deepEqual(muxClipAssetRequest(mux, { startMs: 61_250, endMs: 95_000 }), { input: [{ url: "mux://assets/a1", start_time: 61.25, end_time: 95 }], playback_policies: ["public"] });
  assert.equal(muxClipPlaybackUrl(mux, { startMs: 61_250, endMs: 95_000 }), "https://stream.mux.com/p1.m3u8?asset_start_time=61.25&asset_end_time=95");
  assert.equal(muxClipAssetRequest({ mediaProvider: null, mediaAssetId: null, mediaPlaybackId: null }, { startMs: 0, endMs: 1 }), null);
  assert.equal(checkClipRange({ startMs: 0, endMs: 5_000 }, 60_000), null);
  assert.ok(checkClipRange({ startMs: 50_000, endMs: 70_000 }, 60_000) && checkClipRange({ startMs: 5_000, endMs: 5_000 }, 60_000));
  console.log("✓ deepgram diarized words → speaker-turn lines with call-clock ms; Mux clip contract (asset + instant playback), range checks");
}

/** Hardening + open-core surface: ownership, access tokens, the extension's ingest client, the iCal route. */
async function openCore(mayasMeeting: string) {
  const RAJ = stableId("user:raj@driftwood.example");
  const live = await post({ op: "start_mic", title: "Ownership check", participants: ["Maya Chen"] });
  const id = live.body.meetingId as string;
  const line = { op: "append", meetingId: id, clockMs: 1000, speed: 1, fromSeq: 0, lines: [{ speakerIdx: 0, startMs: 0, endMs: 900, text: "injected" }] };
  assert.equal((await post(line, RAJ)).status, 404, "another user can't write into Maya's call");
  assert.equal((await post({ op: "end", meetingId: id, clockMs: 1000 }, RAJ)).status, 404, "…or end it");
  assert.equal((await post(line, null)).status, 401);
  const peek = async (uid: string | null, path: string) => (await fetch(`${BASE}${path}`, { headers: uid ? { cookie: `parley_uid=${sess(uid)}` } : {} })).status;
  assert.deepEqual([await peek(RAJ, `/api/ingest?meetingId=${id}`), await peek(null, `/api/summary?meetingId=${mayasMeeting}`), await peek(RAJ, `/api/summary?meetingId=${mayasMeeting}`)], [404, 401, 404]);
  console.log("✓ hardening: append/end/status/summary are owner- or attendee-only (other user → 404, no session → 401)");

  const mint = async (scopes: string[], auth: Record<string, string> = { cookie: `parley_uid=${sess(MAYA)}` }) =>
    fetch(`${BASE}/api/tokens`, { method: "POST", headers: { "content-type": "application/json", ...auth }, body: JSON.stringify({ name: "verify", scopes }) });
  const { id: tokenId, token } = (await (await mint(["ingest"])).json()) as { id: string; token: string };
  assert.match(token, /^parley_pat_[\w-]{32}$/);
  assert.equal((await mint(["ingest"], { authorization: `Bearer ${token}` })).status, 401, "a token can't mint tokens");

  // The companion extension's path: bearer token, no cookie, from "another origin".
  const ext = createIngestClient({ baseUrl: BASE, token });
  const started = await ext.start("Captured from a Meet tab", ["Maya Chen", "Dana (Acme)"]);
  ext.add([{ speakerIdx: 0, startMs: 200, endMs: 1500, text: "Thanks for joining, Dana." }, { speakerIdx: 1, startMs: 1700, endMs: 3000, text: "Happy to. We need SSO before we sign." }]);
  await sleep(3200);
  await ext.flush();
  ext.add([{ speakerIdx: 0, startMs: 3100, endMs: 4000, text: "I'll send the SSO timeline tomorrow." }]);
  const ended = (await ext.end()) as { segments: number };
  assert.deepEqual([started.participants.length, ended.segments], [2, 3], "token-authenticated start → append (2 batches) → end");
  const dg = await fetch(`${BASE}/api/deepgram/token`, { method: "POST", headers: { authorization: `Bearer ${token}` } });
  assert.ok([200, 503].includes(dg.status), `deepgram token via access token → ${dg.status}`);

  const cal = (await (await mint(["calendar"])).json()) as { token: string };
  const asCal = await fetch(`${BASE}/api/ingest`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${cal.token}` }, body: JSON.stringify({ op: "start_mic", title: "x", participants: ["x"] }) });
  assert.equal(asCal.status, 401, "calendar-scoped token can't ingest");
  await fetch(`${BASE}/api/tokens?id=${tokenId}`, { method: "DELETE", headers: { cookie: `parley_uid=${sess(MAYA)}` } });
  assert.equal((await createIngestClient({ baseUrl: BASE, token }).start("x", ["x"]).catch((e: Error) => e.message)), "no workspace session or valid ingest token", "revoked token rejected");
  console.log("✓ access tokens: extension client ingests with Bearer (3 lines, 2 batches), scopes enforced, revocation immediate, tokens can't mint tokens");

  const ics = (body: object, auth: Record<string, string>) => fetch(`${BASE}/api/calendar/ics`, { method: "POST", headers: { "content-type": "application/json", ...auth }, body: JSON.stringify(body) });
  const asCookie = { cookie: `parley_uid=${sess(MAYA)}` };
  assert.equal((await ics({ url: "http://169.254.169.254/latest/meta-data" }, asCookie)).status, 400, "non-allowlisted feed host");
  assert.equal((await ics({}, asCookie)).status, 404, "no feed connected yet");
  assert.equal((await ics({}, {})).status, 401);
  assert.equal((await ics({}, { authorization: `Bearer ${cal.token}` })).status, 404, "calendar token accepted by the iCal route");
  console.log("✓ iCal route: host allowlist → 400, not connected → 404, calendar-scoped token accepted, no auth → 401");
  for (const path of ["/settings", "/live/mic"]) assert.equal(await peek(MAYA, path), 200, path);

  // Call recordings: owner uploads ordered chunks (idempotent); visible users stream with Range; outsiders get 404.
  const rec = (await post({ op: "start_mic", title: "Recorded call", participants: ["Maya Chen"] })).body.meetingId as string;
  const put = (idx: number, body: string, uid = MAYA, type = "audio/webm;codecs=opus") =>
    fetch(`${BASE}/api/recordings/${rec}?idx=${idx}&startMs=120`, { method: "POST", headers: { "content-type": type, cookie: `parley_uid=${sess(uid)}` }, body });
  assert.deepEqual([(await put(0, "AAAA")).status, (await put(1, "BBBB")).status, (await put(0, "XXXX")).status], [200, 200, 200]);
  assert.deepEqual([(await put(2, "CC", RAJ)).status, (await put(2, "CC", MAYA, "text/html")).status], [404, 400]);
  const get = (uid: string | null, range?: string) => fetch(`${BASE}/api/recordings/${rec}`, { headers: { ...(uid ? { cookie: `parley_uid=${sess(uid)}` } : {}), ...(range ? { range } : {}) } });
  const full = await get(MAYA);
  assert.deepEqual([full.status, await full.text(), full.headers.get("content-type")], [200, "AAAABBBB", "audio/webm"], "chunks in order; the retried chunk 0 wasn't duplicated");
  const part = await get(MAYA, "bytes=2-5");
  assert.deepEqual([part.status, await part.text(), part.headers.get("content-range")], [206, "AABB", "bytes 2-5/8"]);
  assert.deepEqual([(await get(RAJ)).status, (await get(null)).status, (await get(MAYA, "bytes=50-60")).status], [404, 401, 416]);
  console.log("✓ recordings: ordered idempotent chunk upload (owner only, audio/* only), streamed with Range (206/416), hidden from other users");

  // Leaving a call: discard deletes it (and its audio) for the owner only.
  assert.equal((await post({ op: "discard", meetingId: rec }, RAJ)).status, 404);
  assert.equal((await post({ op: "discard", meetingId: rec })).status, 200);
  assert.deepEqual([(await post({ op: "discard", meetingId: rec })).status, (await get(MAYA)).status], [404, 404], "gone, recording included");
  console.log("✓ discard: owner deletes the live call and its recording; others 404; second discard 404");

  // Ask Parley and live notes over HTTP (no model configured on the test server → cited quotes / rule-based).
  const askIt = (question: string, uid: string | null = MAYA) => fetch(`${BASE}/api/ai/ask`, { method: "POST", headers: { "content-type": "application/json", ...(uid ? { cookie: `parley_uid=${sess(uid)}` } : {}) }, body: JSON.stringify({ question }) });
  assert.equal((await askIt("What about SSO?", null)).status, 401);
  assert.equal((await askIt("x")).status, 400);
  const answer = (await (await askIt("What did customers say about single sign-on?")).json()) as { source: string; citations: { href: string }[] };
  assert.ok(answer.source === "quotes" && answer.citations.length > 0 && answer.citations.every((c) => /^\/meetings\/[0-9a-f-]{36}\?t=\d+#line-\d+$/.test(c.href)), JSON.stringify(answer).slice(0, 300));
  const notes = await fetch(`${BASE}/api/meetings/${mayasMeeting}/insights`, { headers: { cookie: `parley_uid=${sess(MAYA)}` } });
  const insight = (await notes.json()) as { source: string; actions: { text: string }[]; lines: number };
  assert.ok(notes.status === 200 && insight.lines === 4 && insight.actions.some((x) => /send the update to leadership/.test(x.text)), JSON.stringify(insight).slice(0, 300));
  assert.equal((await fetch(`${BASE}/api/meetings/${mayasMeeting}/insights`, { headers: { cookie: `parley_uid=${sess(RAJ)}` } })).status, 404);
  console.log(`✓ Ask Parley API: ${answer.citations.length} cited quotes with ?t= links (no model on server), 401/400 guards; live notes API: ${insight.actions.length} actions, owner-scoped`);

  // Scratchpad: private per user, autosave upserts.
  const pad = (uid: string, method = "GET", body?: string) => fetch(`${BASE}/api/meetings/${mayasMeeting}/scratchpad`, { method, headers: { "content-type": "application/json", cookie: `parley_uid=${sess(uid)}` }, ...(body !== undefined ? { body: JSON.stringify({ body }) } : {}) });
  assert.equal((await (await pad(MAYA)).json()).body, "");
  assert.equal((await pad(MAYA, "PUT", "[0:02] ask Raj about p95")).status, 200);
  assert.equal((await pad(MAYA, "PUT", "[0:02] ask Raj about p95\nfollow up Friday")).status, 200);
  assert.equal((await (await pad(MAYA)).json()).body, "[0:02] ask Raj about p95\nfollow up Friday");
  assert.deepEqual([(await pad(RAJ)).status, (await pad(RAJ, "PUT", "hijack")).status, (await pad(MAYA, "PUT", "x".repeat(20_001))).status], [404, 404, 400]);
  console.log("✓ scratchpad: private autosave (upsert, 20k cap), invisible to other users");

  // Sessions are signed: a bare or forged user id is not a login.
  const as = (cookie: string) => fetch(`${BASE}/api/ingest?meetingId=${mayasMeeting}`, { headers: { cookie } });
  assert.deepEqual([(await as(`parley_uid=${MAYA}`)).status, (await as(`parley_uid=${MAYA}.${"A".repeat(43)}`)).status, (await as(`parley_uid=${sess(MAYA)}`)).status], [401, 401, 200]);
  // Google sign-in: PKCE redirect with state cookie; a callback that doesn't match the state is refused.
  const start = await fetch(`${BASE}/api/auth/google?next=/settings`, { redirect: "manual" });
  const loc = new URL(start.headers.get("location") ?? "http://x/");
  if (process.env.GOOGLE_CLIENT_ID) {
    assert.equal(loc.origin + loc.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
    assert.ok(loc.searchParams.get("code_challenge_method") === "S256" && loc.searchParams.get("scope") === "openid email profile" && loc.searchParams.get("state") && /parley_oauth=/.test(start.headers.get("set-cookie") ?? ""));
  } else assert.equal(loc.search, "?auth=unconfigured");
  const cb = await fetch(`${BASE}/api/auth/google/callback?code=x&state=forged`, { redirect: "manual" });
  assert.equal(new URL(cb.headers.get("location")!).search, "?auth=expired");
  console.log(`✓ auth: unsigned/forged session cookies → 401; Google start → ${process.env.GOOGLE_CLIENT_ID ? "PKCE (S256) redirect, basic scopes, state cookie" : "'not configured' notice"}; mismatched state → refused`);

  // Public API + MCP with a read-scoped token; an ingest-only token can't read.
  const readTok = ((await (await mint(["read"])).json()) as { token: string }).token;
  const ingestTok = ((await (await mint(["ingest"])).json()) as { token: string }).token;
  const api = (path: string, tok: string | null = readTok, init: RequestInit = {}) => fetch(`${BASE}${path}`, { ...init, headers: { "content-type": "application/json", ...(tok ? { authorization: `Bearer ${tok}` } : {}), ...(init.headers ?? {}) } });
  assert.deepEqual([(await api("/api/v1/meetings", null)).status, (await api("/api/v1/meetings", ingestTok)).status], [401, 401]);
  const list = (await (await api("/api/v1/meetings?limit=5")).json()) as { meetings: { id: string; url: string }[] };
  const hero = (await (await api(`/api/v1/meetings/${HERO}?transcript=1`)).json()) as { summary: { sections: unknown[] }; transcript: unknown[]; actionItems: unknown[] };
  const items = (await (await api("/api/v1/action-items?status=open")).json()) as { actionItems: { status: string }[] };
  const found = (await (await api("/api/v1/search?q=single%20sign-on")).json()) as { moments: { url: string }[] };
  const asked = (await (await api("/api/v1/ask", readTok, { method: "POST", body: JSON.stringify({ question: "What did customers say about SSO?" }) })).json()) as { citations: unknown[] };
  assert.ok(list.meetings.length === 5 && hero.summary.sections.length > 0 && hero.transcript.length > 500 && items.actionItems.every((i) => i.status === "open") && found.moments.length > 5 && asked.citations.length > 0);
  assert.equal((await api(`/api/v1/meetings/${stableId("meeting:nope")}`)).status, 404);
  const mcp = (body: object, tok: string | null = readTok) => api("/api/mcp", tok, { method: "POST", headers: { accept: "application/json, text/event-stream" }, body: JSON.stringify(body) });
  const noAuth = await mcp({ jsonrpc: "2.0", id: 1, method: "initialize" }, null);
  assert.ok(noAuth.status === 401 && /Bearer/.test(noAuth.headers.get("www-authenticate") ?? ""));
  const init = (await (await mcp({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "verify", version: "1" } } })).json()) as { result: { protocolVersion: string; capabilities: { tools: object } } };
  assert.equal(init.result.protocolVersion, "2025-06-18");
  assert.equal((await mcp({ jsonrpc: "2.0", method: "notifications/initialized" })).status, 202);
  const tools = (await (await mcp({ jsonrpc: "2.0", id: 2, method: "tools/list" })).json()) as { result: { tools: { name: string }[] } };
  assert.deepEqual(tools.result.tools.map((t) => t.name).sort(), ["ask_parley", "get_meeting", "list_action_items", "list_meetings", "search_meetings"]);
  const call = async (name: string, args: object) => ((await (await mcp({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name, arguments: args } })).json()) as { result: { isError?: boolean; content: { text: string }[] } }).result;
  const hit = await call("search_meetings", { query: "SAML", limit: 3 });
  const got = await call("get_meeting", { meeting_id: HERO });
  const bad = await call("get_meeting", { meeting_id: "nope" });
  assert.ok(!hit.isError && JSON.parse(hit.content[0]!.text).moments.length === 3 && JSON.parse(got.content[0]!.text).title && bad.isError);
  const unknown = (await (await mcp({ jsonrpc: "2.0", id: 4, method: "resources/list" })).json()) as { error: { code: number } };
  assert.equal(unknown.error.code, -32601);
  assert.equal((await fetch(`${BASE}/api/mcp`, { headers: { authorization: `Bearer ${readTok}` } })).status, 405);
  console.log(`✓ public API: meetings/meeting+transcript/action items/search/ask with a read token (ingest-only → 401); MCP: initialize (version negotiated), 5 read-only tools, tool errors in-band, unknown method -32601, 401 + WWW-Authenticate`);
  // Download my data.
  const exp = await fetch(`${BASE}/api/me/export`, { headers: { cookie: `parley_uid=${sess(MAYA)}` } });
  const dump = await exp.text();
  assert.ok(exp.status === 200 && /attachment; filename="parley-export-/.test(exp.headers.get("content-disposition") ?? "") && JSON.parse(dump).meetings.length > 10 && !dump.includes("ciphertext"));
  console.log(`✓ export: ${Math.round(dump.length / 1024)} KB JSON attachment with meetings, scratchpads and activity; no secret values`);

  // Deepgram token rate limit (20 per user per 10 min): burst until refused.
  const grant = () => fetch(`${BASE}/api/deepgram/token`, { method: "POST", headers: { cookie: `parley_uid=${sess(RAJ)}` } });
  let allowed = 0, refused: Response | null = null;
  for (let i = 0; i < 25 && !refused; i++) {
    const r = await grant();
    if (r.status === 429) refused = r;
    else allowed++;
  }
  assert.ok(refused && allowed <= 20 && Number(refused.headers.get("retry-after")) >= 1, `refused after ${allowed}`);
  console.log(`✓ rate limit: Deepgram tokens refused after ${allowed} requests in the window (429, Retry-After ${refused!.headers.get("retry-after")}s)`);

  const cron = (auth?: string) => fetch(`${BASE}/api/cron/sweep`, { headers: auth ? { authorization: auth } : {} });
  assert.equal((await cron()).status, 401);
  assert.equal((await cron("Bearer wrong-secret-of-some-length")).status, 401);
  const swept = await cron(`Bearer ${process.env.CRON_SECRET}`);
  const report = (await swept.json()) as Record<string, number>;
  assert.equal(swept.status, 200, JSON.stringify(report));
  assert.ok("reclaimedJobs" in report && "abandonedCalls" in report);
  console.log(`✓ cron sweep: secret required (401 without/wrong), run → ${JSON.stringify(report)}`);
}

async function main() {
  pureChecks();
  const token = (uid: string | null) => fetch(`${BASE}/api/deepgram/token`, { method: "POST", headers: uid ? { cookie: `parley_uid=${sess(uid)}` } : {} });
  assert.equal((await token(null)).status, 401);
  const tr = await token(MAYA);
  const tb = (await tr.json()) as { accessToken?: string };
  assert.ok(tr.status === 503 || (tr.status === 200 && tb.accessToken), `token route → ${tr.status}`);
  console.log(`✓ deepgram token route: no session → 401; ${tr.status === 200 ? "key set → short-lived token granted" : "no key → 503 (mic room falls back to typing)"}`);

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
    state = await (await fetch(`${BASE}/api/ingest?meetingId=${meetingId}`, { headers: { cookie: `parley_uid=${sess(MAYA)}` } })).json();
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
  assert.equal(await watch(micId, null).done, 401, "streams need a session");
  assert.equal(await watch(micId, stableId("user:nobody")).done, 404, "other workspaces can't watch");
  const watcher = watch(micId);
  await sleep(300);
  const sentAt: number[] = [];
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
    sentAt.push(Date.now());
    seq++;
  }
  assert.equal((await post({ op: "append", meetingId: micId, clockMs: 10 * 60_000, speed: 1, fromSeq: seq, lines: [{ speakerIdx: 0, startMs: 1, endMs: 2, text: "x" }] })).status, 429, "1x clock is enforced for mic calls too");
  assert.equal((await post({ op: "end", meetingId: micId, clockMs: Date.now() - m0 })).status, 200);
  let micState = { status: "" };
  for (let i = 0; i < 40 && micState.status !== "ready"; i++) (await sleep(250)), (micState = await (await fetch(`${BASE}/api/ingest?meetingId=${micId}`, { headers: { cookie: `parley_uid=${sess(MAYA)}` } })).json());
  assert.equal(micState.status, "ready");
  assert.equal(await watcher.done, 200);
  const streamed = watcher.events.filter((e) => e.event === "lines").flatMap((e) => (e.data as { seq: number; text: string }[]).map((l) => ({ ...l, at: e.at })));
  assert.deepEqual(streamed.map((l) => l.seq), [0, 1, 2, 3], "every line streamed once, in order");
  assert.deepEqual(streamed.map((l) => l.text), said.map(([, t]) => t));
  const lag = Math.max(...streamed.map((l, i) => l.at - sentAt[i]!));
  assert.ok(lag < 1_000, `same-instance lines are pushed on write, not on the 2s poll (lag ${lag}ms)`);
  const statuses = watcher.events.filter((e) => e.event === "status").map((e) => (e.data as { status: string }).status);
  assert.deepEqual([statuses[0], statuses.at(-1)], ["live", "ready"], statuses.join());
  console.log(`✓ SSE: watcher got 4/4 lines in order (worst lag ${lag}ms after the ingest response), statuses ${statuses.join(" → ")}, stream closed; 401/404 for outsiders`);
  const micSummary = await summary(micId);
  const micSections = micSummary.events.filter((e) => e.type === "section").map((e) => e.section as { id: string; items: { text: string }[] });
  assert.equal(micSummary.events[1]?.source, "simulated");
  const nextSteps = micSections.find((x) => x.id === "next_steps")!.items.map((i) => i.text);
  assert.ok(nextSteps.some((t) => /send the update to leadership/.test(t)) && nextSteps.some((t) => /rerun the latency test/.test(t)), JSON.stringify(nextSteps));
  assert.ok(micSections.find((x) => x.id === "decisions")!.items.some((i) => /ship the beta on schedule/.test(i.text)));
  console.log(`✓ mic call: 4 lines at 1x, linked to calendar event, rule-based notes → ${nextSteps.length} next steps, decision captured`);

  await openCore(micId);
  console.log("\nRoutes verified.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
