"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Bookmark, ExternalLink, Keyboard, Mic, Pause, PhoneOff, Play, Plus, Radio, X } from "lucide-react";
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
import { MIC, pickMeetingTab, startDualCapture } from "@/capture/dual-stream";
import { type Archive, captureGraph, startArchive } from "@/capture/recorder";
import { OverlayLoading } from "@/components/loading-dots";
import { InlineDots } from "@/components/submit-button";
import { LeaveCallDialog, useLeaveGuard } from "./leave-dialog";
import { openDeepgram, TranscriptionUnavailable, type DgLine } from "@/lib/deepgram";
import { clock } from "@/lib/format";
import { findMeetingLink, PLATFORM_NAME, type Platform, zoomWebUrl } from "@/lib/meeting-links";
import { JOIN_KEY } from "@/components/join-by-link";

type Line = { speakerIdx: number; startMs: number; endMs: number; text: string };
type Event = { id: string; title: string; agenda: string | null; attachments: Attachment[] } | null;
const ERRORS = {
  blocked: "Microphone access is blocked. Allow the mic for this site (address bar → site settings), then try again.",
  missing: "No microphone was found. Plug one in, or type what's said instead.",
};
const canStream = () => typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined" && typeof WebSocket !== "undefined";
type Session = { stop(): Promise<void> };

async function ingest(body: object) {
  const r = await fetch("/api/ingest", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await r.json();
  if (!r.ok) throw new Error(json.error ?? `HTTP ${r.status}`);
  return json;
}

/** Records a real conversation: mic → Deepgram (nova-3, diarized) → timestamped lines → /api/ingest in small batches. */
export function MicCall({ me, event, defaultSpeakers, fromLink = false, eventLink = null }: { me: string; event: Event; defaultSpeakers: string[]; fromLink?: boolean; eventLink?: { platform: Platform; url: string } | null }) {
  const router = useRouter();
  const [title, setTitle] = useState(event?.title ?? `Meeting with ${me}`);
  const [speakers, setSpeakers] = useState(defaultSpeakers);
  const [newName, setNewName] = useState("");
  const [phase, setPhase] = useState<"setup" | "live" | "ending">("setup");
  const [paused, setPaused] = useState(false);
  const [starting, setStarting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [endingLabel, setEndingLabel] = useState("Saving the recording and writing your notes…");
  useLeaveGuard(phase === "live");
  const [supported, setSupported] = useState(true);
  const [mode, setMode] = useState<"mic" | "typed">("mic");
  const [tabAudio, setTabAudio] = useState(false);
  const [canTab, setCanTab] = useState(false);
  const [join, setJoin] = useState<{ platform: Platform; url: string } | null>(null);
  const [joinInput, setJoinInput] = useState("");
  const [warn, setWarn] = useState<string | null>(null);
  const [speaker, setSpeaker] = useState(0);
  const [ids, setIds] = useState<string[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [interim, setInterim] = useState("");
  const [typed, setTyped] = useState("");
  const [now, setNow] = useState(0);
  const s = useRef({
    meetingId: "", t0: 0, sent: 0, pending: [] as Line[], busy: false, live: false, speaker: 0, lastStart: 0, n: 0,
    dg: null as Session | null, mic: null as MediaStream | null, tab: null as MediaStream | null,
    graph: null as ReturnType<typeof captureGraph> | null, archive: null as Archive | null,
    /** Deepgram speaker number → participant index; the user corrects it by tapping who's talking. */
    map: new Map<number, number>(), lastDg: null as number | null,
  });

  useEffect(() => {
    const ok = canStream();
    const tabOk = ok && typeof navigator.mediaDevices.getDisplayMedia === "function";
    setCanTab(tabOk);
    // Arrived from "Join by link": pick up the pasted link and set the room up for that call.
    if (eventLink) applyLink(eventLink, tabOk);
    else if (fromLink) {
      try {
        const saved = JSON.parse(sessionStorage.getItem(JOIN_KEY) ?? "null") as { platform: Platform; url: string } | null;
        if (saved) applyLink(saved, tabOk);
      } catch { /* no saved link: the room asks for it */ }
    }
    setSupported(ok);
    if (!ok) setMode("typed");
  }, []);
  useEffect(() => {
    s.current.speaker = speaker;
    s.current.n = speakers.length;
  }, [speaker, speakers.length]);
  function applyLink(l: { platform: Platform; url: string }, tabOk = canTab) {
    setJoin(l);
    setTitle((t) => (t.startsWith("Meeting with") ? `${PLATFORM_NAME[l.platform]} call` : t));
    if (tabOk) setTabAudio(true);
  }

  /** Voice → participant. Your mic is always you (0); with tab audio, diarized voices fill the other seats. */
  const who = (dg: number) => {
    const S = s.current;
    if (dg === MIC) return 0;
    return S.map.get(dg) ?? (S.tab && S.n > 1 ? 1 + (dg % (S.n - 1)) : dg % Math.max(1, S.n));
  };
  /** Tap a person: in typed mode it's who speaks next; with Deepgram it relabels the voice heard last. */
  const pick = (i: number) => {
    const S = s.current;
    if (mode === "mic" && S.lastDg !== null && S.lastDg !== MIC) S.map.set(S.lastDg, i);
    setSpeaker(i);
  };
  useEffect(() => {
    if (phase !== "live") return;
    const tick = setInterval(() => (setNow(Date.now() - s.current.t0), flush()), 2000);
    const keys = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (!(e.target instanceof HTMLInputElement) && n >= 1 && n <= speakers.length) pick(n - 1);
    };
    window.addEventListener("keydown", keys);
    return () => (clearInterval(tick), window.removeEventListener("keydown", keys));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, speakers.length, mode]);

  const push = (line: Line) => {
    if (!line.text.trim()) return;
    s.current.pending.push(line);
    setLines((l) => [...l, line]);
  };
  const addTyped = (text: string) => {
    const S = s.current;
    const endMs = Date.now() - S.t0;
    const startMs = Math.max(S.lastStart, endMs - Math.min(8000, text.split(/\s+/).length * 400));
    S.lastStart = startMs;
    push({ speakerIdx: S.speaker, startMs, endMs, text: text.trim() });
  };
  const addHeard = (dl: DgLine[]) => {
    const S = s.current;
    for (const l of dl) {
      const startMs = Math.max(S.lastStart, l.startMs);
      S.lastStart = startMs;
      S.lastDg = l.speaker;
      push({ speakerIdx: who(l.speaker), startMs, endMs: Math.max(startMs, l.endMs), text: l.text });
    }
    if (dl.length) setSpeaker(who(dl.at(-1)!.speaker));
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

  async function listen() {
    const S = s.current;
    if (S.graph?.tab) {
      S.dg = await startDualCapture({ mic: S.graph.mic, tab: S.graph.tab }, () => Date.now() - S.t0, {
        onLines: addHeard,
        onInterim: (_, text, dg) => (setInterim(text), dg !== null && ((S.lastDg = dg), setSpeaker(who(dg)))),
        onWarn: setWarn,
      });
      return;
    }
    S.dg = await openDeepgram(S.graph!.mic, () => Date.now() - S.t0, {
      onLines: addHeard,
      onInterim: (text, dg) => {
        setInterim(text);
        if (dg !== null) (S.lastDg = dg), setSpeaker(who(dg));
      },
      // Network blips or token expiry: reconnect with a fresh token while the call is live.
      onDrop: (reason) => {
        if (!S.live) return;
        setWarn(`Transcription reconnecting (${reason})…`);
        setTimeout(() => S.live && listen().then(() => setWarn(null), (e) => setWarn(`Transcription stopped: ${e.message}. Type lines instead.`)), 1_000);
      },
    });
  }

  const stopMic = () => {
    const S = s.current;
    for (const k of ["mic", "tab"] as const) S[k]?.getTracks().forEach((t) => t.stop()), (S[k] = null);
    S.graph?.close(), (S.graph = null);
  };

  /** Pausing mutes the audio graph: silence keeps the recording and timestamps aligned with the clock. */
  const togglePause = () => {
    s.current.graph?.setMuted(!paused);
    setPaused(!paused);
    setInterim("");
  };

  async function start() {
    setWarn(null);
    setStarting(true);
    try {
      await begin();
    } finally {
      setStarting(false);
    }
  }

  async function begin() {
    const S = s.current;
    let useMic = supported && mode === "mic";
    if (useMic) {
      try {
        S.mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      } catch (e) {
        setWarn(e instanceof DOMException && e.name === "NotFoundError" ? ERRORS.missing : ERRORS.blocked);
        useMic = false;
        setMode("typed");
      }
      // Remote participants: the meeting tab's audio, as a second stream (works even on headphones).
      if (useMic && tabAudio) {
        S.tab = await pickMeetingTab().catch(() => null);
        if (!S.tab) setWarn("No meeting tab audio was shared (pick the call's tab and tick \"Also share tab audio\"). Recording your microphone only.");
      }
    }
    try {
      const r = await ingest({ op: "start_mic", title, participants: speakers, calendarEventId: event?.id, platform: join?.platform });
      Object.assign(S, { meetingId: r.meetingId, t0: Date.now(), live: useMic });
      if (useMic && S.mic) {
        S.graph = captureGraph(S.mic, S.tab);
        S.archive = startArchive(S.graph.mixed, r.meetingId, () => Date.now() - S.t0);
      }
      setIds(r.participants.map((p: { id?: string; speakerIdx: number }) => p.id ?? String(p.speakerIdx)));
      setPhase("live");
      if (useMic) {
        await listen().catch((e) => {
          S.live = false;
          S.archive?.abort(), (S.archive = null);
          stopMic();
          setMode("typed");
          setWarn(`${e instanceof TranscriptionUnavailable ? `Live transcription is unavailable: ${e.message}` : `Couldn't start transcription: ${e}`}. You can type what's said instead.`);
        });
      }
    } catch (e) {
      stopMic();
      setWarn(`Couldn't start the meeting: ${e instanceof Error ? e.message : e}`);
    }
  }

  async function end() {
    setLeaving(false);
    const S = s.current;
    if (S.sent === 0 && !S.pending.length) return discard();
    setEndingLabel("Saving the recording and writing your notes…");
    setPhase("ending");
    S.live = false;
    await S.dg?.stop();
    const saved = await S.archive?.stop();
    stopMic();
    setInterim("");
    try {
      while (S.busy) await new Promise((r) => setTimeout(r, 100));
      await flush(true);
      await ingest({ op: "end", meetingId: S.meetingId, clockMs: Date.now() - S.t0 });
      for (let i = 0; i < 240; i++) {
        const st = await (await fetch(`/api/ingest?meetingId=${S.meetingId}`)).json();
        if (st.status === "ready" || st.status === "failed") break;
        await new Promise((r) => setTimeout(r, 500));
      }
      router.push(`/meetings/${S.meetingId}${saved?.lost ? "?audio=partial" : ""}`);
    } catch (e) {
      setWarn(`Couldn't finish: ${e instanceof Error ? e.message : e}`);
      setPhase("live");
    }
  }

  async function discard() {
    setLeaving(false);
    setEndingLabel("Discarding…");
    setPhase("ending");
    const S = s.current;
    S.live = false;
    S.archive?.abort();
    await S.dg?.stop().catch(() => {});
    stopMic();
    if (S.meetingId) await ingest({ op: "discard", meetingId: S.meetingId }).catch(() => {});
    router.push("/home");
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
        {phase === "setup" && <Button variant="ghost" size="icon" asChild><Link href="/home" aria-label="Back"><ArrowLeft /></Link></Button>}
        {phase === "setup" ? <Badge variant="secondary"><Mic />New recording</Badge> : paused ? <Badge className="bg-amber-500 text-white"><Pause />PAUSED {clock(now)}</Badge> : <Badge className="gap-1.5 bg-red-600 text-white"><span className="size-1.5 animate-pulse rounded-full bg-white" />REC {clock(now)}</Badge>}
        {phase === "setup" ? <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-8 max-w-sm flex-1 font-semibold" /> : <h1 className="min-w-0 flex-1 truncate font-semibold">{title}</h1>}
        {phase === "setup" && <Button onClick={start} disabled={!title.trim() || starting} aria-busy={starting}>{starting ? <InlineDots /> : supported && mode === "mic" ? <><Mic />Record live microphone</> : <><Keyboard />Start (type lines)</>}</Button>}
        {phase === "live" && (
          <>
            <Button variant="ghost" asChild><a href={`/meetings/${s.current.meetingId}`} target="_blank" rel="noreferrer"><Radio />Live view</a></Button>
            <Button variant="outline" onClick={() => addHighlight(s.current.meetingId, Date.now() - s.current.t0)}><Bookmark />Highlight</Button>
            <Button variant="outline" onClick={togglePause}>{paused ? <><Play />Resume</> : <><Pause />Pause</>}</Button>
            <Button variant="destructive" onClick={end}><PhoneOff />End & get notes</Button>
            <Button variant="ghost" size="icon" aria-label="Leave recording" onClick={() => setLeaving(true)}><X /></Button>
          </>
        )}
      </header>

      <div className="flex min-h-0 flex-col">
        {(warn || !supported) && (
          <p className="flex items-start gap-2 border-b bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            {warn ?? "This browser can't stream microphone audio (try Chrome, Edge or Firefox). You can still type what's said, and notes work the same."}
          </p>
        )}
        <div className="space-y-3 border-b bg-zinc-950 p-3">
          <ParticipantGrid participants={participants} activeId={phase === "live" ? participants[speaker]?.id : null} className="mx-auto max-w-3xl [&>div]:max-h-[16dvh]" />
          <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-1.5 text-xs text-zinc-400">
            Speaking now:
            {speakers.map((n, i) => (
              <button key={i} onClick={() => pick(i)} className={`rounded-full px-2.5 py-1 ${i === speaker ? "bg-primary text-primary-foreground" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}>
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
          {phase === "setup" && (fromLink || eventLink) && <JoinSteps join={join} canTab={canTab} input={joinInput} setInput={setJoinInput} onLink={(l) => applyLink(l)} />}
          {phase === "setup" ? (
            <div className="mx-auto max-w-lg space-y-2 p-8 text-center text-sm text-muted-foreground">
              {!join && <p>Join your call in its usual app, then press <b>Record live microphone</b>. Audio streams to Deepgram (nova-3) for live transcription; lines reach Parley in small batches and anyone watching the meeting sees them live.</p>}
              <p>Deepgram tells voices apart on its own. If it labels someone wrong, tap who&apos;s actually talking (or press 1–{speakers.length}) and that voice stays with them.</p>
              <p className="text-xs">Audio goes from your browser straight to Deepgram; Parley stores only the text.</p>
              {canTab && mode === "mic" && (
                <label className="flex cursor-pointer items-center justify-center gap-2 text-foreground">
                  <input type="checkbox" checked={tabAudio} onChange={(e) => setTabAudio(e.target.checked)} className="accent-primary" />
                  Also capture the meeting tab&apos;s audio (hears everyone, even on headphones)
                </label>
              )}
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
          <form onSubmit={(e) => (e.preventDefault(), typed.trim() && (addTyped(typed), setTyped("")))} className="flex gap-2 border-t p-3">
            <Input autoFocus disabled={paused} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={paused ? "Paused" : `${speakers[speaker]} says…`} />
            <Button disabled={paused}>Add</Button>
          </form>
        )}
      </div>

      <aside className="hidden border-l bg-muted/20 p-4 lg:block">
        <h2 className="mb-2 text-sm font-semibold">Agenda</h2>
        {event ? <div className="space-y-3"><Agenda text={event.agenda} /><Attachments eventId={event.id} items={event.attachments} /></div> : <p className="text-sm text-muted-foreground">Ad-hoc meeting. Start from a calendar event to see its agenda and files here.</p>}
      </aside>
      <LeaveCallDialog open={leaving} onOpenChange={setLeaving} onEnd={end} onDiscard={discard} hasContent={lines.length > 0} />
      {phase === "ending" && <OverlayLoading label={endingLabel} />}
    </div>
  );
}

/** Joining from a pasted link: open the call in a tab Parley can hear, then record. */
function JoinSteps({ join, canTab, input, setInput, onLink }: {
  join: { platform: Platform; url: string } | null; canTab: boolean; input: string; setInput: (v: string) => void; onLink: (l: { platform: Platform; url: string }) => void;
}) {
  if (!join) {
    const found = findMeetingLink(input.trim());
    return (
      <div className="mx-auto mt-6 flex max-w-lg gap-2 px-4">
        <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Paste the Zoom, Meet or Teams link" />
        <Button disabled={!found} onClick={() => found && onLink(found)}>Use link</Button>
      </div>
    );
  }
  const name = PLATFORM_NAME[join.platform];
  const web = join.platform === "zoom" ? zoomWebUrl(join.url) : join.url;
  return (
    <ol className="mx-auto mt-6 max-w-lg space-y-3 rounded-xl border bg-muted/30 p-4 text-sm">
      <li className="space-y-2">
        <b>1. Open the {name} call</b>{join.platform === "zoom" && " in your browser"}, in a new tab.
        <div className="flex flex-wrap gap-2">
          {web && <Button asChild size="sm"><a href={web} target="_blank" rel="noreferrer"><ExternalLink />Open {name}{join.platform === "zoom" ? " in browser" : ""}</a></Button>}
          {join.platform === "zoom" && <Button asChild size="sm" variant="outline"><a href={join.url} target="_blank" rel="noreferrer">Open Zoom app instead</a></Button>}
        </div>
      </li>
      <li><b>2. Come back here and press Record live microphone.</b> {canTab ? <>Chrome asks what to share: pick the <b>{name} tab</b> and turn on <b>Also share tab audio</b>. That&apos;s how Parley hears everyone else.</> : "This browser can't capture tab audio, so Parley hears your microphone only."}</li>
      {join.platform === "zoom" && <li className="text-xs text-muted-foreground">Using the Zoom desktop app? A web page can&apos;t hear another app, so Parley records only your mic. Use speakers rather than headphones, or use Zoom in the browser.</li>}
    </ol>
  );
}
