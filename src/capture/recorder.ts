/**
 * Browser-side audio plumbing for a live call.
 *
 * captureGraph routes the mic (and optional meeting-tab audio) through one
 * WebAudio graph. Transcription gets each source separately, the archive
 * recorder gets the mix, and pausing mutes the graph rather than stopping
 * recorders: silence keeps flowing, so the audio file, Deepgram's timestamps
 * and the call clock never drift apart.
 *
 * startArchive records the mix as webm/opus and uploads ~5 s chunks in order
 * to /api/recordings/:id while the call runs (retrying with backoff), so a
 * closed tab loses at most the last few seconds.
 */
export function captureGraph(mic: MediaStream, tab: MediaStream | null) {
  const ctx = new AudioContext();
  void ctx.resume();
  const mix = ctx.createMediaStreamDestination();
  const route = (s: MediaStream) => {
    const gain = ctx.createGain();
    const out = ctx.createMediaStreamDestination();
    ctx.createMediaStreamSource(s).connect(gain);
    gain.connect(out), gain.connect(mix);
    return { gain, stream: out.stream };
  };
  const m = route(mic), t = tab ? route(tab) : null;
  return {
    mic: m.stream,
    tab: t?.stream ?? null,
    mixed: mix.stream,
    setMuted(muted: boolean) {
      for (const x of [m, t]) x?.gain.gain.setValueAtTime(muted ? 0 : 1, ctx.currentTime);
    },
    close: () => void ctx.close(),
  };
}

const MIME = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function startArchive(stream: MediaStream, meetingId: string, clock: () => number, opts: { baseUrl?: string; headers?: Record<string, string> } = {}) {
  const mime = MIME.find((t) => MediaRecorder.isTypeSupported(t));
  const rec = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 32_000 });
  const startMs = clock();
  const queue: { idx: number; blob: Blob }[] = [];
  let next = 0, pumping: Promise<void> | null = null, lastError: string | null = null;

  const upload = async ({ idx, blob }: { idx: number; blob: Blob }) => {
    const { "content-type": _, ...auth } = opts.headers ?? {};
    const r = await fetch(`${opts.baseUrl ?? ""}/api/recordings/${meetingId}?idx=${idx}&startMs=${startMs}`, {
      method: "POST", body: blob, headers: { ...auth, "content-type": blob.type || rec.mimeType || "audio/webm" },
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? `HTTP ${r.status}`);
  };
  const pump = () =>
    (pumping ??= (async () => {
      for (let failures = 0; queue.length; ) {
        try {
          await upload(queue[0]!);
          queue.shift(), (failures = 0), (lastError = null);
        } catch (e) {
          lastError = e instanceof Error ? e.message : String(e);
          await sleep(Math.min(10_000, 500 * 2 ** ++failures));
        }
      }
    })().finally(() => (pumping = null)));

  rec.ondataavailable = (e) => {
    if (e.data.size) queue.push({ idx: next++, blob: e.data }), void pump();
  };
  rec.start(5_000);

  return {
    get pendingChunks() { return queue.length; },
    get error() { return lastError; },
    /** Finish the file and wait (up to `timeoutMs`) for every chunk to reach the server. */
    async stop(timeoutMs = 20_000) {
      if (rec.state !== "inactive") await new Promise<void>((r) => ((rec.onstop = () => r()), rec.stop()));
      const deadline = Date.now() + timeoutMs;
      while (queue.length && Date.now() < deadline) await Promise.race([pumping ?? pump(), sleep(250)]);
      return { uploaded: next - queue.length, lost: queue.length };
    },
    /** Drop everything (discarding the call). */
    abort() {
      queue.length = 0;
      if (rec.state !== "inactive") (rec.ondataavailable = null), rec.stop();
    },
  };
}
export type Archive = ReturnType<typeof startArchive>;
