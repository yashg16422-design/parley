/**
 * Browser → Deepgram live speech-to-text. The page fetches a short-lived token
 * from /api/deepgram/token, then streams mic audio (MediaRecorder, webm/opus)
 * straight to Deepgram's edge. nova-3 with diarization labels each word with
 * a speaker number.
 */
export type DgWord = { word: string; punctuated_word?: string; start: number; end: number; speaker?: number };
export type DgLine = { speaker: number; startMs: number; endMs: number; text: string };
type DgMessage =
  | { type: "Results"; is_final: boolean; speech_final: boolean; channel: { alternatives: { transcript: string; words: DgWord[] }[] } }
  | { type: "UtteranceEnd" | "Metadata" | "SpeechStarted" };

export const DEEPGRAM_URL = `wss://api.deepgram.com/v1/listen?${new URLSearchParams({
  model: "nova-3", language: "en", diarize: "true", smart_format: "true", punctuate: "true",
  interim_results: "true", endpointing: "300", utterance_end_ms: "1000", vad_events: "true",
})}`;

/** Final words → one line per speaker turn. Word times are seconds from stream start. */
export function wordsToLines(words: readonly DgWord[], offsetMs = 0): DgLine[] {
  const out: DgLine[] = [];
  for (const w of words) {
    const speaker = w.speaker ?? 0, text = w.punctuated_word ?? w.word;
    const [startMs, endMs] = [offsetMs + Math.round(w.start * 1000), offsetMs + Math.round(w.end * 1000)];
    const last = out.at(-1);
    if (last?.speaker === speaker) (last.text += ` ${text}`), (last.endMs = endMs);
    else out.push({ speaker, startMs, endMs, text });
  }
  return out;
}

export class TranscriptionUnavailable extends Error {}

type Handlers = {
  onLines(lines: DgLine[]): void;
  onInterim(text: string, speaker: number | null): void;
  /** Unexpected disconnect (not after stop()); the caller may reconnect. */
  onDrop(reason: string): void;
};

/** Opens one Deepgram session on `stream`. `offsetMs` is the call clock when audio starts. */
export async function openDeepgram(stream: MediaStream, offsetMs: () => number, h: Handlers) {
  const r = await fetch("/api/deepgram/token", { method: "POST" });
  const body = (await r.json().catch(() => ({}))) as { accessToken?: string; error?: string };
  if (!r.ok || !body.accessToken) throw new TranscriptionUnavailable(body.error ?? `token request failed (HTTP ${r.status})`);

  const ws = new WebSocket(DEEPGRAM_URL, ["bearer", body.accessToken]);
  const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"].find((t) => MediaRecorder.isTypeSupported(t));
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  let buf: DgWord[] = [], base = 0, stopping = false, keepAlive = 0;
  const emit = () => {
    if (buf.length) h.onLines(wordsToLines(buf, base));
    buf = [];
    h.onInterim("", null);
  };

  await new Promise<void>((resolve, reject) => {
    ws.onopen = () => resolve();
    ws.onerror = () => reject(new TranscriptionUnavailable("couldn't reach Deepgram (check the network or the API key's permissions)"));
  });
  base = offsetMs();
  rec.ondataavailable = (e) => e.data.size && ws.readyState === WebSocket.OPEN && ws.send(e.data);
  rec.start(250);
  keepAlive = window.setInterval(() => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ type: "KeepAlive" })), 8_000);

  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data as string) as DgMessage;
    if (msg.type === "UtteranceEnd") return emit();
    if (msg.type !== "Results") return;
    const alt = msg.channel.alternatives[0];
    if (!alt) return;
    if (msg.is_final) {
      buf.push(...alt.words);
      if (msg.speech_final || buf.length > 80) emit();
      else h.onInterim(buf.map((w) => w.punctuated_word ?? w.word).join(" "), buf.at(-1)?.speaker ?? null);
    } else if (alt.transcript) {
      h.onInterim([...buf.map((w) => w.punctuated_word ?? w.word), alt.transcript].join(" "), alt.words.at(-1)?.speaker ?? buf.at(-1)?.speaker ?? null);
    }
  };
  const closed = new Promise<void>((resolve) => {
    ws.onclose = (e) => {
      clearInterval(keepAlive);
      if (rec.state !== "inactive") rec.stop();
      emit();
      if (!stopping) h.onDrop(e.reason || `connection closed (${e.code})`);
      resolve();
    };
  });

  return {
    /** Stop sending audio, let Deepgram flush its last finals, then close. */
    async stop() {
      stopping = true;
      const closeStream = () => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ type: "CloseStream" }));
      // The recorder's last chunk arrives after stop(); close the stream only once it has been sent.
      if (rec.state !== "inactive") (rec.onstop = closeStream), rec.stop();
      else closeStream();
      await Promise.race([closed, new Promise((r) => setTimeout(r, 3_000))]);
      if (ws.readyState !== WebSocket.CLOSED) ws.close();
    },
  };
}
