"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Bookmark, Keyboard, Loader2, Mic, PhoneOff, Plus } from "lucide-react";
import { addHighlight } from "@app/actions/meetings";
import type { Attachment } from "@/db/json-types";
import { Agenda, Attachments } from "@/components/event-details";
import { ParticipantGrid } from "@/components/meeting/participant-grid";
import type { Seg } from "@/components/meeting/player";
import { Transcript } from "@/components/meeting/transcript";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SPEAKER_COLORS } from "@/lib/colors";
import { clock } from "@/lib/format";

// Minimal Web Speech API surface (not in TypeScript's DOM lib yet).
type SpeechResult = { isFinal: boolean; 0: { transcript: string } };
type SpeechEvent = { resultIndex: number; results: ArrayLike<SpeechResult> };
type Recognizer = {
  continuous: boolean; interimResults: boolean; lang: string;
  onresult: ((e: SpeechEvent) => void) | null; onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null;
  start(): void; stop(): void;
};
const speechApi = () => (typeof window === "undefined" ? undefined : ((window as never as Record<string, new () => Recognizer>).SpeechRecognition ?? (window as never as Record<string, new () => Recognizer>).webkitSpeechRecognition));

type Line = { speakerIdx: number; startMs: number; endMs: number; text: string };
type Event = { id: string; title: string; agenda: string | null; attachments: Attachment[] } | null;
const ERRORS: Record<string, string> = {
  "not-allowed": "Microphone access is blocked. Allow the mic for this site (address bar → site settings), then try again.",
  "service-not-allowed": "Speech recognition is disabled in this browser. You can type what's said instead.",
  "audio-capture": "No microphone was found. Plug one in, or type what's said instead.",
  network: "The browser's speech service is unreachable (it needs an internet connection). You can type what's said instead.",
};

async function ingest(body: object) {
  const r = await fetch("/api/ingest", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await r.json();
  if (!r.ok) throw new Error(json.error ?? `HTTP ${r.status}`);
  return json;
}

/** Records a real conversation: Web Speech API → timestamped lines → /api/ingest in small batches. */
export function MicCall({ me, event, defaultSpeakers }: { me: string; event: Event; defaultSpeakers: string[] }) {
  const router = useRouter();
  const [title, setTitle] = useState(event?.title ?? `Meeting with ${me}`);
  const [speakers, setSpeakers] = useState(defaultSpeakers);
  const [newName, setNewName] = useState("");
  const [phase, setPhase] = useState<"setup" | "live" | "ending">("setup");
  const [supported, setSupported] = useState(true);
  const [mode, setMode] = useState<"mic" | "typed">("mic");
  const [warn, setWarn] = useState<string | null>(null);
  const [speaker, setSpeaker] = useState(0);
  const [ids, setIds] = useState<string[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [interim, setInterim] = useState("");
  const [typed, setTyped] = useState("");
  const [now, setNow] = useState(0);
  const s = useRef({ meetingId: "", t0: 0, sent: 0, pending: [] as Line[], busy: false, live: false, speaker: 0, lastStart: 0, heardAt: new Map<number, number>(), rec: null as Recognizer | null });

  useEffect(() => {
    const ok = !!speechApi();
    setSupported(ok);
    if (!ok) setMode("typed");
  }, []);
  useEffect(() => {
    s.current.speaker = speaker;
  }, [speaker]);
  useEffect(() => {
    if (phase !== "live") return;
    const tick = setInterval(() => (setNow(Date.now() - s.current.t0), flush()), 2000);
    const keys = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (!(e.target instanceof HTMLInputElement) && n >= 1 && n <= speakers.length) setSpeaker(n - 1);
    };
    window.addEventListener("keydown", keys);
    return () => (clearInterval(tick), window.removeEventListener("keydown", keys));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, speakers.length]);

  const addLine = (text: string, heardAt: number) => {
    const S = s.current;
    const endMs = Date.now() - S.t0;
    const startMs = Math.min(endMs, Math.max(S.lastStart, heardAt - S.t0));
    S.lastStart = startMs;
    const line = { speakerIdx: S.speaker, startMs, endMs, text: text.trim() };
    if (!line.text) return;
    S.pending.push(line);
    setLines((l) => [...l, line]);
  };

  async function flush(all = false) {
    const S = s.current;
    if (S.busy || !S.pending.length) return;
    S.busy = true;
    try {
      do {
        const batch = S.pending.slice(0, 200);
        const r = await ingest({ op: "append", meetingId: S.meetingId, clockMs: Date.now() - S.t0, speed: 1, fromSeq: S.sent, lines: batch });
        S.pending.splice(0, batch.length);
        S.sent = r.nextSeq;
      } while (all && S.pending.length);
      setWarn((w) => (w?.startsWith("Couldn't send") ? null : w));
    } catch (e) {
      setWarn(`Couldn't send the latest lines (${e instanceof Error ? e.message : e}). Retrying…`);
    } finally {
      S.busy = false;
    }
  }

  function listen() {
    const Api = speechApi()!;
    const rec = new Api();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || "en-US";
    rec.onresult = (e) => {
      let partial = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]!;
        if (!s.current.heardAt.has(i)) s.current.heardAt.set(i, Date.now());
        if (r.isFinal) {
          addLine(r[0].transcript, s.current.heardAt.get(i)!);
          s.current.heardAt.delete(i);
        } else partial += r[0].transcript;
      }
      setInterim(partial);
    };
    rec.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      setWarn(ERRORS[e.error] ?? `Speech recognition error: ${e.error}`);
      if (e.error in ERRORS) (s.current.live = false), setMode("typed");
    };
    // Browsers end recognition after silence or ~60s; keep it running while the call is live.
    rec.onend = () => {
      s.current.heardAt.clear();
      if (s.current.live) try { rec.start(); } catch { /* already restarting */ }
    };
    rec.start();
    s.current.rec = rec;
  }

  async function start() {
    setWarn(null);
    let useMic = supported && mode === "mic";
    if (useMic) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
      } catch (e) {
        const name = e instanceof DOMException ? e.name : "";
        setWarn(name === "NotFoundError" ? ERRORS["audio-capture"]! : ERRORS["not-allowed"]!);
        useMic = false;
        setMode("typed");
      }
    }
    try {
      const r = await ingest({ op: "start_mic", title, participants: speakers, calendarEventId: event?.id });
      Object.assign(s.current, { meetingId: r.meetingId, t0: Date.now(), live: useMic });
      setIds(r.participants.map((p: { id?: string; speakerIdx: number }) => p.id ?? String(p.speakerIdx)));
      setPhase("live");
      if (useMic) listen();
    } catch (e) {
      setWarn(`Couldn't start the meeting: ${e instanceof Error ? e.message : e}`);
    }
  }

  async function end() {
    setPhase("ending");
    const S = s.current;
    S.live = false;
    S.rec?.stop();
    if (interim) addLine(interim, Date.now());
    try {
      while (S.busy) await new Promise((r) => setTimeout(r, 100));
      await flush(true);
      if (S.sent === 0) throw new Error("nothing was said yet");
      await ingest({ op: "end", meetingId: S.meetingId, clockMs: Date.now() - S.t0 });
      for (let i = 0; i < 240; i++) {
        const st = await (await fetch(`/api/ingest?meetingId=${S.meetingId}`)).json();
        if (st.status === "ready" || st.status === "failed") break;
        await new Promise((r) => setTimeout(r, 500));
      }
      router.push(`/meetings/${S.meetingId}`);
    } catch (e) {
      setWarn(`Couldn't finish: ${e instanceof Error ? e.message : e}`);
      setPhase("live");
    }
  }

  const participants = speakers.map((name, i) => ({ id: ids[i] ?? `s${i}`, name, color: SPEAKER_COLORS[i % SPEAKER_COLORS.length]! }));
  const segs: Seg[] = lines.map((l, i) => ({ seq: i, participantId: participants[l.speakerIdx]!.id, speakerName: speakers[l.speakerIdx]!, startMs: l.startMs, endMs: l.endMs, text: l.text }));
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [lines.length, interim]);

  return (
    <div className="grid h-dvh grid-rows-[auto_auto_1fr] lg:grid-cols-[1fr_320px] lg:grid-rows-[auto_1fr]">
      <header className="flex flex-wrap items-center gap-3 border-b px-4 py-3 lg:col-span-2">
        {phase === "setup" ? <Badge variant="secondary"><Mic />New recording</Badge> : <Badge className="gap-1.5 bg-red-600 text-white"><span className="size-1.5 animate-pulse rounded-full bg-white" />REC {clock(now)}</Badge>}
        {phase === "setup" ? <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-8 max-w-sm flex-1 font-semibold" /> : <h1 className="min-w-0 flex-1 truncate font-semibold">{title}</h1>}
        {phase === "setup" && <Button onClick={start} disabled={!title.trim()}>{supported && mode === "mic" ? <><Mic />Record live microphone</> : <><Keyboard />Start (type lines)</>}</Button>}
        {phase === "live" && (
          <>
            <Button variant="outline" onClick={() => addHighlight(s.current.meetingId, Date.now() - s.current.t0)}><Bookmark />Highlight</Button>
            <Button variant="destructive" onClick={end}><PhoneOff />End & get notes</Button>
          </>
        )}
        {phase === "ending" && <Button disabled><Loader2 className="animate-spin" />Writing notes…</Button>}
      </header>

      <div className="flex min-h-0 flex-col">
        {(warn || !supported) && (
          <p className="flex items-start gap-2 border-b bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            {warn ?? "This browser doesn't support live speech recognition (try Chrome, Edge or Safari). You can still type what's said, and notes work the same."}
          </p>
        )}
        <div className="space-y-3 border-b bg-zinc-950 p-3">
          <ParticipantGrid participants={participants} activeId={phase === "live" ? participants[speaker]?.id : null} className="mx-auto max-w-3xl [&>div]:max-h-[16dvh]" />
          <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-1.5 text-xs text-zinc-400">
            Speaking now:
            {speakers.map((n, i) => (
              <button key={i} onClick={() => setSpeaker(i)} className={`rounded-full px-2.5 py-1 ${i === speaker ? "bg-primary text-primary-foreground" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}>
                {i + 1}. {n}
              </button>
            ))}
            {phase === "setup" && speakers.length < 8 && (
              <form onSubmit={(e) => (e.preventDefault(), newName.trim() && (setSpeakers([...speakers, newName.trim()]), setNewName("")))} className="flex items-center gap-1">
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Add a person" className="h-7 w-32 border-zinc-700 bg-zinc-900 text-xs text-zinc-100" />
                <Button size="icon" variant="secondary" className="size-7"><Plus /></Button>
              </form>
            )}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {phase === "setup" ? (
            <div className="mx-auto max-w-lg space-y-2 p-8 text-center text-sm text-muted-foreground">
              <p>Join your call in its usual app, then press <b>Record live microphone</b>. Speech is transcribed live and sent to Parley in small batches; notes build as you talk.</p>
              <p>Your browser can't tell voices apart, so tap who's speaking (or press 1–{speakers.length}).</p>
              <p className="text-xs">Chrome sends audio to Google's speech service for recognition; Parley stores only the text.</p>
              {supported && <button onClick={() => setMode(mode === "mic" ? "typed" : "mic")} className="text-xs text-primary hover:underline">{mode === "mic" ? "No mic? Type lines instead" : "Use the microphone instead"}</button>}
            </div>
          ) : (
            <>
              <Transcript segments={segs} colors={Object.fromEntries(participants.map((p) => [p.id, p.color]))} activeIdx={segs.length - 1} onLine={() => {}} />
              {interim && <p className="px-[88px] pb-2 text-sm italic text-muted-foreground">{speakers[speaker]}: {interim}…</p>}
              {!segs.length && !interim && <p className="p-10 text-center text-sm text-muted-foreground">{mode === "mic" ? "Listening… start talking." : "Type what's said below."}</p>}
            </>
          )}
          <div ref={bottom} />
        </div>
        {phase === "live" && mode === "typed" && (
          <form onSubmit={(e) => (e.preventDefault(), typed.trim() && (addLine(typed, Date.now() - Math.min(8000, typed.split(/\s+/).length * 400)), setTyped("")))} className="flex gap-2 border-t p-3">
            <Input autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={`${speakers[speaker]} says…`} />
            <Button>Add</Button>
          </form>
        )}
      </div>

      <aside className="hidden border-l bg-muted/20 p-4 lg:block">
        <h2 className="mb-2 text-sm font-semibold">Agenda</h2>
        {event ? <div className="space-y-3"><Agenda text={event.agenda} /><Attachments eventId={event.id} items={event.attachments} /></div> : <p className="text-sm text-muted-foreground">Ad-hoc meeting. Start from a calendar event to see its agenda and files here.</p>}
      </aside>
    </div>
  );
}
