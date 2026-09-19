"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Bookmark, Crosshair, Scissors, Search, X } from "lucide-react";
import { addHighlight, createClip } from "@app/actions/meetings";
import type { Attachment } from "@/db/json-types";
import { Agenda, Attachments } from "@/components/event-details";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { clock, duration, fmtDay, fmtTime } from "@/lib/format";
import { ParticipantGrid, type Participant } from "./participant-grid";
import { createPlayer, jumpTo, lineAt, type Seg, usePlayer } from "./player";
import { Scrubber } from "./scrubber";
import { ActionItems, type ActionItemView, Moments, TalkTime } from "./side-lists";
import { Scratchpad } from "./scratchpad";
import { SoundToggle } from "./sound-toggle";
import { SummaryPanel } from "./summary-panel";
import { useMeetingSound } from "./use-sound";
import { Transcript } from "./transcript";

export type MeetingViewProps = {
  id: string; title: string; startedAt: Date | null; durationMs: number; defaultTemplateId: string;
  participants: (Participant & { talkMs: number })[];
  segments: Seg[];
  highlights: { id: string; atMs: number; label: string | null }[];
  actionItems: ActionItemView[];
  clips: { slug: string; title: string; startMs: number; endMs: number; viewCount: number }[];
  chapters: { title: string; startMs: number; endMs: number }[];
  templates: { id: string; name: string }[];
  initialMs: number;
  event?: { id: string; agenda: string | null; attachments: Attachment[] } | null;
  recording: { startMs: number } | null;
};

export function MeetingView(m: MeetingViewProps) {
  const player = useMemo(() => createPlayer(m.durationMs, m.initialMs), [m.durationMs, m.initialMs]);
  const activeIdx = usePlayer(player, (s) => lineAt(m.segments, s.ms));
  const [follow, setFollow] = useState(true);
  const [query, setQuery] = useState("");
  const [highlights, setHighlights] = useState(m.highlights);
  const [clipSel, setClipSel] = useState<number[] | null>(null);
  const [clipTitle, setClipTitle] = useState("");
  const [newClip, setNewClip] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const bySeq = useMemo(() => new Map(m.segments.map((s) => [s.seq, s])), [m.segments]);
  const colors = useMemo(() => Object.fromEntries(m.participants.map((p) => [p.id, p.color])), [m.participants]);
  const shown = useMemo(() => (query.trim() ? m.segments.filter((s) => `${s.speakerName} ${s.text}`.toLowerCase().includes(query.toLowerCase())) : m.segments), [query, m.segments]);
  const highlightSeqs = useMemo(() => new Set(highlights.map((h) => m.segments[lineAt(m.segments, h.atMs)]?.seq).filter((x) => x !== undefined)), [highlights, m.segments]);
  const jump = useCallback((ms: number, seq?: number) => (setFollow(false), jumpTo(player, ms, seq ?? m.segments[lineAt(m.segments, ms)]?.seq)), [player, m.segments]);
  const cite = useCallback((seq: number) => { const s = bySeq.get(seq); if (s) jump(s.startMs, seq); }, [bySeq, jump]);

  useEffect(() => {
    const seq = Number(location.hash.match(/^#line-(\d+)$/)?.[1]);
    if (!Number.isNaN(seq)) cite(seq);
  }, [cite]);

  // Follow the active line while playing, unless the user scrolled away.
  useEffect(() => {
    if (!follow || query || activeIdx < 0) return;
    document.getElementById(`line-${m.segments[activeIdx]!.seq}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeIdx, follow, query, m.segments]);

  const onLine = useCallback((s: Seg) => {
    if (clipSel) return setClipSel((cur) => (cur!.length >= 2 ? [s.seq] : [...cur!, s.seq].sort((a, b) => a - b)));
    player.seek(s.startMs);
  }, [clipSel, player]);

  const saveClip = () => start(async () => {
    const [a, b = a] = clipSel!;
    const { slug } = await createClip({ meetingId: m.id, startMs: bySeq.get(a!)!.startMs, endMs: bySeq.get(b!)!.endMs, title: clipTitle || `${m.title} clip` });
    setNewClip(slug), setClipSel(null), setClipTitle("");
  });

  const speakerOrder = useMemo(() => m.participants.map((p) => p.id), [m.participants]);
  const sound = useMeetingSound(player, { meetingId: m.id, recording: m.recording, segments: m.segments, speakerOrder });
  const speaker = m.segments[activeIdx]?.participantId;
  return (
    <div className="grid lg:h-dvh lg:grid-cols-[minmax(0,1fr)_400px]">
      <div className="flex min-h-0 flex-col">
        <header className="flex items-center gap-3 border-b px-4 py-3">
          <Button variant="ghost" size="icon" asChild><Link href="/home" aria-label="Back"><ArrowLeft /></Link></Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-semibold">{m.title}</h1>
            <p className="text-xs text-muted-foreground">{m.startedAt && `${fmtDay(m.startedAt)}, ${fmtTime(m.startedAt)} · `}{duration(m.durationMs)} · {m.participants.length} participants</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => start(async () => { const h = await addHighlight(m.id, player.get().ms); setHighlights((x) => [...x, { id: h.id, atMs: h.atMs, label: h.label }]); })}>
            <Bookmark />Highlight
          </Button>
          <Button variant={clipSel ? "default" : "outline"} size="sm" onClick={() => (setClipSel(clipSel ? null : []), setNewClip(null))}><Scissors />Clip</Button>
        </header>

        <div className="space-y-3 border-b bg-zinc-950 p-3">
          <ParticipantGrid participants={m.participants} activeId={speaker} className="mx-auto max-h-[34dvh] max-w-3xl [&>div]:max-h-[16dvh]" />
          <div className="space-y-1 rounded-lg bg-background px-3 pt-2 pb-1"><Scrubber player={player} chapters={m.chapters} markers={highlights} /><SoundToggle {...sound} /></div>
        </div>

        {(clipSel || newClip) && (
          <div className="flex flex-wrap items-center gap-2 border-b bg-amber-50 px-4 py-2 text-sm dark:bg-amber-500/10">
            {newClip ? (
              <>Clip created: <Link className="font-medium text-primary underline" href={`/c/${newClip}`} target="_blank">/c/{newClip}</Link><X className="ml-auto size-4 cursor-pointer" onClick={() => setNewClip(null)} /></>
            ) : clipSel!.length === 0 ? "Click the first line of your clip…" : (
              <>
                <span className="font-mono text-xs">{clock(bySeq.get(clipSel![0]!)!.startMs)}–{clock(bySeq.get(clipSel!.at(-1)!)!.endMs)}</span>
                <Input className="h-8 max-w-xs bg-background" placeholder="Clip title" value={clipTitle} onChange={(e) => setClipTitle(e.target.value)} />
                <Button size="sm" disabled={pending} onClick={saveClip}>Create a Shareable Clip</Button>
                <span className="text-xs text-muted-foreground">{clipSel!.length === 1 ? "or click the last line" : ""}</span>
              </>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 border-b px-4 py-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-8 pl-8" placeholder="Search this transcript" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <Button variant={follow ? "secondary" : "ghost"} size="sm" onClick={() => setFollow(!follow)}><Crosshair />Follow</Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto max-lg:h-[55dvh] max-lg:flex-none" onWheel={() => follow && setFollow(false)}>
          <Transcript segments={shown} colors={colors} activeIdx={query ? -1 : activeIdx} highlightSeqs={highlightSeqs} selected={clipSel?.length ? [clipSel[0]!, clipSel.at(-1)!] : null} onLine={onLine} />
          {!shown.length && <p className="p-8 text-center text-sm text-muted-foreground">No lines match “{query}”.</p>}
        </div>
      </div>

      <aside className="flex min-h-0 flex-col border-l bg-muted/20 max-lg:border-t">
        <Tabs defaultValue="summary" className="flex min-h-0 flex-1 flex-col gap-0">
          <TabsList className="m-3 grid grid-cols-4">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="actions">Action items{m.actionItems.length ? ` · ${m.actionItems.length}` : ""}</TabsTrigger>
            <TabsTrigger value="moments">Clips</TabsTrigger>
            <TabsTrigger value="pad">Scratchpad</TabsTrigger>
          </TabsList>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
            <TabsContent value="summary" className="space-y-6">
              {m.event && (m.event.agenda || m.event.attachments.length > 0) && (
                <details className="rounded-lg border bg-background p-3">
                  <summary className="cursor-pointer text-sm font-semibold">Agenda & files</summary>
                  <div className="mt-2 space-y-2"><Agenda text={m.event.agenda} /><Attachments eventId={m.event.id} items={m.event.attachments} /></div>
                </details>
              )}
              <SummaryPanel meetingId={m.id} templates={m.templates} initial={m.defaultTemplateId} startOf={(q) => bySeq.get(q)?.startMs} onCite={cite} />
              <div className="border-t pt-4">
                <h3 className="mb-2 text-sm font-semibold">Talk time</h3>
                <TalkTime participants={m.participants} total={m.participants.reduce((a, p) => a + p.talkMs, 0)} />
              </div>
            </TabsContent>
            <TabsContent value="actions"><ActionItems items={m.actionItems} onJump={jump} /></TabsContent>
            <TabsContent value="moments"><Moments highlights={highlights} clips={m.clips} onJump={jump} /></TabsContent>
            <TabsContent value="pad"><Scratchpad meetingId={m.id} now={() => player.get().ms} onJump={(ms) => (jump(ms), player.play())} /></TabsContent>
          </div>
        </Tabs>
      </aside>
    </div>
  );
}
