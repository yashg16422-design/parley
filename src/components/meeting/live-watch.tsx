"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { clock } from "@/lib/format";
import { ParticipantGrid, type Participant } from "./participant-grid";
import type { Seg } from "./player";
import { Transcript } from "./transcript";

/** Read-only view of a call in progress, fed by /api/streams/meetings (SSE). Hands over to the full view once notes are ready. */
export function LiveWatch({ id, title, participants, initial, initialStatus }: { id: string; title: string; participants: Participant[]; initial: Seg[]; initialStatus: string }) {
  const router = useRouter();
  const [segs, setSegs] = useState(initial);
  const [status, setStatus] = useState(initialStatus);
  const [connected, setConnected] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const es = new EventSource(`/api/streams/meetings?meetingId=${id}&after=${initial.at(-1)?.seq ?? -1}`);
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.addEventListener("lines", (e) => {
      const batch = JSON.parse(e.data) as Seg[];
      setSegs((cur) => [...cur, ...batch.filter((x) => x.seq > (cur.at(-1)?.seq ?? -1))]);
    });
    es.addEventListener("status", (e) => {
      const st = (JSON.parse(e.data) as { status: string }).status;
      setStatus(st);
      if (st === "ready" || st === "failed") es.close(), router.refresh();
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
      </header>
      <div className="border-b bg-zinc-950 p-3">
        <ParticipantGrid participants={participants} activeId={status === "live" ? last?.participantId : null} className="mx-auto max-w-3xl [&>div]:max-h-[16dvh]" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Transcript segments={segs} colors={Object.fromEntries(participants.map((p) => [p.id, p.color]))} activeIdx={segs.length - 1} onLine={() => {}} />
        {!segs.length && <p className="p-10 text-center text-sm text-muted-foreground">Waiting for the first words…</p>}
        <div ref={bottom} />
      </div>
    </div>
  );
}
