/**
 * Two-stream meeting capture, shared by the mic room and the companion
 * extension. Each source gets its own Deepgram session:
 *  - mic: the local user (no diarization needed), speaker = MIC
 *  - tab: the meeting tab's audio, i.e. everyone else, diarized (speaker 0..n)
 * Their lines arrive independently and slightly late, so a merger re-orders
 * them onto one call clock before they're numbered and sent to /api/ingest.
 */
import { type DeepgramOpts, type DgLine, openDeepgram } from "@/lib/deepgram";

export const MIC = -1;
export type Source = "mic" | "tab";
export type CapturedLine = DgLine & { source: Source };

/**
 * Releases lines in start order once no earlier line can still arrive: both
 * sources have heard past it, or it is older than `holdMs` (a silent source
 * can't hold the other back). A late straggler is clamped forward, so the
 * committed stream stays ordered, which /api/ingest requires.
 */
export class LineMerger {
  private q: CapturedLine[] = [];
  private heard: Record<Source, number> = { mic: 0, tab: 0 };
  private lastStart = 0;
  constructor(private holdMs = 3_000) {}

  push(lines: CapturedLine[]) {
    for (const l of lines) this.q.push(l), (this.heard[l.source] = Math.max(this.heard[l.source], l.endMs));
  }

  release(nowMs: number, all = false): CapturedLine[] {
    const mark = all ? Infinity : Math.max(Math.min(this.heard.mic, this.heard.tab), nowMs - this.holdMs);
    this.q.sort((a, b) => a.startMs - b.startMs);
    const n = this.q.findIndex((l) => l.startMs > mark);
    const out = this.q.splice(0, n < 0 ? this.q.length : n);
    return out.map((l) => {
      const startMs = Math.max(l.startMs, this.lastStart);
      this.lastStart = startMs;
      return { ...l, startMs, endMs: Math.max(l.endMs, startMs) };
    });
  }
}

type Handlers = {
  onLines(lines: CapturedLine[]): void;
  onInterim(source: Source, text: string, speaker: number | null): void;
  onWarn(message: string | null): void;
};

/** Start both sessions. Sessions that drop reconnect with a fresh token until stop(). */
export async function startDualCapture(streams: { mic: MediaStream; tab: MediaStream }, clock: () => number, h: Handlers, opts: DeepgramOpts = {}) {
  const merger = new LineMerger();
  const live: Partial<Record<Source, Awaited<ReturnType<typeof openDeepgram>>>> = {};
  let stopped = false;

  const open = async (source: Source): Promise<void> => {
    live[source] = await openDeepgram(streams[source], clock, {
      onLines: (lines) => merger.push(lines.map((l) => ({ ...l, source, speaker: source === "mic" ? MIC : l.speaker }))),
      onInterim: (text, speaker) => h.onInterim(source, text, source === "mic" ? MIC : speaker),
      onDrop: (reason) => {
        if (stopped) return;
        h.onWarn(`${source === "mic" ? "Microphone" : "Meeting audio"} transcription reconnecting (${reason})…`);
        setTimeout(() => !stopped && open(source).then(() => h.onWarn(null), (e) => h.onWarn(`${source} transcription stopped: ${e.message}`)), 1_000);
      },
    }, { ...opts, params: { ...opts.params, diarize: source === "tab" ? "true" : "false" } });
  };

  await Promise.all([open("mic"), open("tab")]);
  const tick = setInterval(() => {
    const out = merger.release(clock());
    if (out.length) h.onLines(out);
  }, 500);

  return {
    async stop() {
      stopped = true;
      clearInterval(tick);
      await Promise.all(Object.values(live).map((s) => s?.stop()));
      const rest = merger.release(clock(), true);
      if (rest.length) h.onLines(rest);
    },
  };
}

/** Ask the user to share the meeting tab (tick "Also share tab audio"). Returns an audio-only stream, or null if no audio was shared. */
export async function pickMeetingTab() {
  const s = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true, selfBrowserSurface: "exclude", systemAudio: "include" } as DisplayMediaStreamOptions);
  s.getVideoTracks().forEach((t) => t.stop());
  return s.getAudioTracks().length ? new MediaStream(s.getAudioTracks()) : null;
}

/**
 * Client for /api/ingest from anywhere: this app (cookie session) or an
 * extension / script on another origin (`token` = a Parley access token with
 * the ingest scope). Lines are numbered here; batches carry `fromSeq`, so a
 * retry after a network error is harmless.
 */
export function createIngestClient({ baseUrl = "", token }: { baseUrl?: string; token?: string } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) };
  const call = async (body: object) => {
    const r = await fetch(`${baseUrl}/api/ingest`, { method: "POST", headers, body: JSON.stringify(body), credentials: token ? "omit" : "same-origin" });
    const json = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(json.error ?? `HTTP ${r.status}`);
    return json;
  };
  let meetingId = "", t0 = 0, sent = 0, busy: Promise<void> | null = null;
  const pending: { speakerIdx: number; startMs: number; endMs: number; text: string }[] = [];
  const clock = () => Date.now() - t0;

  async function flush() {
    while (busy) await busy;
    if (!pending.length) return;
    busy = (async () => {
      const batch = pending.slice(0, 200);
      const r = await call({ op: "append", meetingId, clockMs: clock(), speed: 1, fromSeq: sent, lines: batch });
      pending.splice(0, batch.length);
      sent = r.nextSeq;
    })();
    try {
      await busy;
    } finally {
      busy = null;
    }
  }

  return {
    clock,
    get meetingId() { return meetingId; },
    deepgram: { tokenUrl: `${baseUrl}/api/deepgram/token`, headers } satisfies DeepgramOpts,
    async start(title: string, participants: string[], calendarEventId?: string) {
      const r = await call({ op: "start_mic", title, participants, calendarEventId });
      (meetingId = r.meetingId), (t0 = Date.now()), (sent = 0);
      return r as { meetingId: string; participants: { id: string; speakerIdx: number; name: string }[] };
    },
    /** Queue ordered lines (e.g. from startDualCapture) with the participant each maps to. */
    add(lines: { speakerIdx: number; startMs: number; endMs: number; text: string }[]) {
      pending.push(...lines.filter((l) => l.text.trim()));
    },
    flush,
    async end() {
      while (pending.length) await flush();
      return call({ op: "end", meetingId, clockMs: clock() });
    },
  };
}
