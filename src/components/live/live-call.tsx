"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Bookmark, PhoneOff, Radio, Sparkles, X } from "lucide-react";
import { OverlayLoading } from "@/components/loading-dots";
import { LeaveCallDialog, useLeaveGuard } from "./leave-dialog";
import { addHighlight } from "@app/actions/meetings";
import { ParticipantGrid, type Participant } from "@/components/meeting/participant-grid";
import { lineAt, type Seg } from "@/components/meeting/player";
import { Transcript } from "@/components/meeting/transcript";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { clock } from "@/lib/format";

const SPEEDS = [1, 5, 15, 30, 60];
type Phase = "ready" | "live" | "ending" | "error";

async function ingest(body: object) {
  const r = await fetch("/api/ingest", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await r.json();
  if (!r.ok) throw new Error(json.error ?? `HTTP ${r.status}`);
  return json;
}

/** Replays a seeded meeting as a live call: the browser owns the clock and streams line batches to /api/ingest. */
export function LiveCall({ source, participants, segments, initialSpeed }: { source: { id: string; title: string }; participants: Participant[]; segments: Seg[]; initialSpeed: number }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("ready");
  const [speed, setSpeed] = useState(initialSpeed);
  const [clockMs, setClockMs] = useState(0);
  const [windows, setWindows] = useState(0);
  const [marks, setMarks] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [endingLabel, setEndingLabel] = useState("Writing your notes…");
  useLeaveGuard(phase === "live");
  const live = useRef({ meetingId: "", sent: 0, clock: 0, speed: initialSpeed, busy: false });
  const bottom = useRef<HTMLDivElement>(null);
  const endMs = segments.at(-1)?.endMs ?? 0;
  const idx = { ...Object.fromEntries(participants.map((p, i) => [p.id, i])) } as Record<string, number>;

  const flush = async (force = false) => {
    const L = live.current;
    if (L.busy && !force) return;
    const batch = segments.slice(L.sent).filter((s) => s.endMs <= L.clock).slice(0, 200);
    if (!batch.length) return;
    L.busy = true;
    try {
      const r = await ingest({ op: "append", meetingId: L.meetingId, clockMs: Math.round(L.clock), speed: L.speed, fromSeq: L.sent, lines: batch.map((s) => ({ speakerIdx: idx[s.participantId], startMs: s.startMs, endMs: s.endMs, text: s.text })) });
      L.sent = r.nextSeq;
      setWindows(r.closedWindows);
    } finally {
      L.busy = false;
    }
  };

  const discard = async () => {
    setLeaving(false), setEndingLabel("Discarding…"), setPhase("ending");
    if (live.current.meetingId) await ingest({ op: "discard", meetingId: live.current.meetingId }).catch(() => {});
    router.push("/live");
  };

  const end = async () => {
    setLeaving(false);
    const L = live.current;
    if (!segments.some((s) => s.endMs <= L.clock)) return discard();
    setEndingLabel("Writing your notes…"), setPhase("ending");
    try {
      while (L.sent < segments.filter((s) => s.endMs <= L.clock).length) await flush(true);
      await ingest({ op: "end", meetingId: L.meetingId, clockMs: Math.round(L.clock) });
      for (let i = 0; i < 240; i++) {
        const st = await (await fetch(`/api/ingest?meetingId=${L.meetingId}`)).json();
        if (st.status === "ready" || st.status === "failed") break;
        await new Promise((r) => setTimeout(r, 500));
      }
      router.push(`/meetings/${L.meetingId}`);
    } catch (e) {
      setError(String(e)), setPhase("error");
    }
  };

  const start = async () => {
    try {
      const r = await ingest({ op: "start", sourceMeetingId: source.id, speed });
      live.current = { ...live.current, meetingId: r.meetingId, speed };
      setPhase("live");
    } catch (e) {
      setError(String(e)), setPhase("error");
    }
  };

  // Clock: advance by wall time x speed every frame; ship a batch about once a second.
  useEffect(() => {
    if (phase !== "live") return;
    let raf = 0, last = performance.now(), lastFlush = 0;
    const loop = (t: number) => {
      const L = live.current;
      L.clock = Math.min(endMs, L.clock + (t - last) * L.speed);
      last = t;
      setClockMs(L.clock);
      if (t - lastFlush > 1000) (lastFlush = t), flush().catch((e) => (setError(String(e)), setPhase("error")));
      if (L.clock >= endMs) return void end();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const heard = segments.filter((s) => s.startMs <= clockMs);
  const active = lineAt(segments, clockMs);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [heard.length]);

  return (
    <div className="grid h-dvh grid-rows-[auto_auto_1fr]">
      <header className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
        {(phase === "ready" || phase === "error") && <Button variant="ghost" size="icon" asChild><Link href="/live" aria-label="Back"><ArrowLeft /></Link></Button>}
        {phase === "live" ? <Badge className="gap-1.5 bg-red-600 text-white"><span className="size-1.5 animate-pulse rounded-full bg-white" />REC {clock(clockMs)}</Badge> : <Badge variant="secondary"><Radio />Simulated call</Badge>}
        <h1 className="min-w-0 flex-1 truncate font-semibold">{source.title}</h1>
        <div className="flex items-center gap-1 rounded-lg border p-0.5">
          {SPEEDS.map((s) => (
            <button key={s} onClick={() => ((live.current.speed = s), setSpeed(s))} className={`rounded-md px-2 py-1 text-xs font-medium ${s === speed ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>{s}x</button>
          ))}
        </div>
        {phase === "ready" && <Button onClick={start}><Radio />Start recording</Button>}
        {phase === "live" && (
          <>
            <Button variant="outline" onClick={() => addHighlight(live.current.meetingId, live.current.clock).then(() => setMarks((m) => [...m, live.current.clock]))}><Bookmark />Highlight</Button>
            <Button variant="destructive" onClick={end}><PhoneOff />End call</Button>
            <Button variant="ghost" size="icon" aria-label="Leave call" onClick={() => setLeaving(true)}><X /></Button>
          </>
        )}
      </header>
      <div className="space-y-2 border-b bg-zinc-950 p-3">
        <ParticipantGrid participants={participants} activeId={phase === "live" ? segments[active]?.participantId : null} className="mx-auto max-w-4xl [&>div]:max-h-[18dvh]" />
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-3 text-xs text-zinc-400">
          <Sparkles className="size-3.5 text-primary" />{windows} ten-minute window{windows === 1 ? "" : "s"} sent for AI notes
          {marks.length > 0 && <span>· {marks.length} highlight{marks.length === 1 ? "" : "s"} ({marks.map(clock).join(", ")})</span>}
          <span className="ml-auto">{clock(clockMs)} / {clock(endMs)}</span>
        </div>
      </div>
      <div className="min-h-0 overflow-y-auto">
        {error && <p className="m-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        {phase === "ready" ? (
          <p className="p-10 text-center text-sm text-muted-foreground">Press <b>Start recording</b> to replay this call at {speed}x. Lines stream to the server as they're spoken.</p>
        ) : (
          <Transcript segments={heard} colors={Object.fromEntries(participants.map((p) => [p.id, p.color]))} activeIdx={heard.length - 1} onLine={() => {}} />
        )}
        <div ref={bottom} />
      </div>
      <LeaveCallDialog open={leaving} onOpenChange={setLeaving} onEnd={end} onDiscard={discard} hasContent={segments.some((x) => x.endMs <= clockMs)} />
      {phase === "ending" && <OverlayLoading label={endingLabel} />}
    </div>
  );
}
