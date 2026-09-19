"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Loader2, PhoneOff, X } from "lucide-react";
import { LeaveCallDialog } from "@/components/live/leave-dialog";
import { OverlayLoading } from "@/components/loading-dots";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { clock } from "@/lib/format";
import { ParticipantGrid, type Participant } from "./participant-grid";
import type { Seg } from "./player";
import { Transcript } from "./transcript";

/** Read-only view of a call in progress, fed by /api/streams/meetings (SSE). Hands over to the full view once notes are ready. */
export function LiveWatch({ id, title, participants, initial, initialStatus, isOwner = false, lastActivity }: {
  id: string; title: string; participants: Participant[]; initial: Seg[]; initialStatus: string; isOwner?: boolean; lastActivity: string;
}) {
  const router = useRouter();
  const [segs, setSegs] = useState(initial);
  const [status, setStatus] = useState(initialStatus);
  const [connected, setConnected] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const [leaving, setLeaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [heardAt, setHeardAt] = useState(() => Date.parse(lastActivity));
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const idleMin = Math.floor((now - heardAt) / 60_000);

  /** The owner can close a call from here too, e.g. when the recording tab was closed. */
  async function finish(op: "end" | "discard") {
    setLeaving(false), setError(null), setBusy(op === "end" ? "Ending the call and writing notes…" : "Discarding…");
    const r = await fetch("/api/ingest", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(op === "end" ? { op, meetingId: id, clockMs: segs.at(-1)?.endMs ?? 0 } : { op, meetingId: id }) });
    if (!r.ok) return setBusy(null), setError((await r.json().catch(() => ({}))).error ?? `HTTP ${r.status}`);
    if (op === "discard") router.push("/home");
    else setBusy(null); // the stream reports processing → ready and the page swaps to the notes
  }

  useEffect(() => {
    const es = new EventSource(`/api/streams/meetings?meetingId=${id}&after=${initial.at(-1)?.seq ?? -1}`);
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.addEventListener("lines", (e) => {
      const batch = JSON.parse(e.data) as Seg[];
      setSegs((cur) => [...cur, ...batch.filter((x) => x.seq > (cur.at(-1)?.seq ?? -1))]);
      setHeardAt(Date.now());
    });
    es.addEventListener("status", (e) => {
      const st = (JSON.parse(e.data) as { status: string }).status;
      setStatus(st);
      if (st === "deleted") return es.close(), router.push("/home");
      if (st === "ready" || st === "failed" || st === "abandoned") es.close(), router.refresh();
    });
    return () => es.close();
    // The initial seq only matters for the first connection; EventSource resumes with Last-Event-ID.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, router]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [segs.length]);

  const last = segs.at(-1);
  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center gap-3 border-b px-4 py-3">
        <Button variant="ghost" size="icon" asChild><Link href="/home" aria-label="Back"><ArrowLeft /></Link></Button>
        <h1 className="min-w-0 flex-1 truncate font-semibold">{title}</h1>
        {status === "live" ? (
          <Badge className="gap-1.5 bg-red-600 text-white"><span className="size-1.5 animate-pulse rounded-full bg-white" />LIVE{last && ` ${clock(last.endMs)}`}</Badge>
        ) : (
          <Badge variant="secondary"><Loader2 className="animate-spin" />Writing notes…</Badge>
        )}
        <span className={`size-2 rounded-full ${connected ? "bg-emerald-500" : "bg-zinc-400"}`} title={connected ? "Streaming" : "Reconnecting"} />
        {isOwner && status === "live" && (
          <>
            <Button size="sm" variant="destructive" disabled={!segs.length} onClick={() => finish("end")}><PhoneOff />End & get notes</Button>
            <Button size="icon" variant="ghost" aria-label="Close this recording" onClick={() => setLeaving(true)}><X /></Button>
          </>
        )}
      </header>
      {isOwner && status === "live" && idleMin >= 2 && (
        <p className="flex items-center gap-2 border-b bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          <AlertTriangle className="size-4 shrink-0" />No new lines for {idleMin} min. If the recording tab was closed, end or discard the call here.
        </p>
      )}
      {error && <p className="border-b bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</p>}
      <LeaveCallDialog open={leaving} onOpenChange={setLeaving} onEnd={() => finish("end")} onDiscard={() => finish("discard")} hasContent={segs.length > 0} />
      {busy && <OverlayLoading label={busy} />}
      <div className="border-b bg-zinc-950 p-3">
        <ParticipantGrid participants={participants} activeId={status === "live" ? last?.participantId : null} className="mx-auto max-w-3xl [&>div]:max-h-[16dvh]" />
      </div>
      {status === "processing" && <OverlayLoading label="The call ended. Writing notes…" />}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Transcript segments={segs} colors={Object.fromEntries(participants.map((p) => [p.id, p.color]))} activeIdx={segs.length - 1} onLine={() => {}} />
        {!segs.length && <p className="p-10 text-center text-sm text-muted-foreground">Waiting for the first words…</p>}
        <div ref={bottom} />
      </div>
    </div>
  );
}
