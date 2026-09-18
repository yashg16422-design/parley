"use client";

import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { clock } from "@/lib/format";
import { type Player, usePlayer } from "./player";

type Marker = { atMs: number; label: string | null };
type Chapter = { title: string; startMs: number; endMs: number };

/** Play controls + timeline with topic chapters and highlight markers. */
export function Scrubber({ player, chapters, markers }: { player: Player; chapters: Chapter[]; markers: Marker[] }) {
  const ms = usePlayer(player, (s) => Math.floor(s.ms / 250) * 250);
  const playing = usePlayer(player, (s) => s.playing);
  const rate = usePlayer(player, (s) => s.rate);
  const d = player.durationMs || 1;
  const pct = (x: number) => `${(x / d) * 100}%`;
  return (
    <div className="flex items-center gap-3">
      <Button size="icon" variant="secondary" onClick={player.toggle} aria-label={playing ? "Pause" : "Play"}>{playing ? <Pause /> : <Play />}</Button>
      <span className="w-24 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{clock(ms)} / {clock(d)}</span>
      <div
        className="relative h-7 flex-1 cursor-pointer"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          player.seek(((e.clientX - r.left) / r.width) * d);
        }}
      >
        <div className="absolute inset-x-0 top-1/2 flex h-1.5 -translate-y-1/2 gap-0.5 overflow-hidden rounded-full">
          {(chapters.length ? chapters : [{ title: "", startMs: 0, endMs: d }]).map((c, i) => (
            <Tooltip key={i}>
              <TooltipTrigger asChild><span className="h-full bg-muted-foreground/20 hover:bg-muted-foreground/40" style={{ width: pct(c.endMs - c.startMs) }} /></TooltipTrigger>
              {c.title && <TooltipContent>{c.title}</TooltipContent>}
            </Tooltip>
          ))}
        </div>
        <div className="pointer-events-none absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-primary" style={{ width: pct(ms) }} />
        {markers.map((m, i) => (
          <Tooltip key={i}>
            <TooltipTrigger asChild>
              <span className="absolute top-0 h-2.5 w-1 -translate-x-1/2 rounded-sm bg-amber-400" style={{ left: pct(m.atMs) }} onClick={(e) => (e.stopPropagation(), player.seek(m.atMs))} />
            </TooltipTrigger>
            <TooltipContent>{m.label ?? "Highlight"} · {clock(m.atMs)}</TooltipContent>
          </Tooltip>
        ))}
        <span className="pointer-events-none absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary shadow" style={{ left: pct(ms) }} />
      </div>
      <button onClick={() => player.setRate(rate >= 2 ? 1 : rate + 0.5)} className="w-10 rounded-md border px-1.5 py-1 text-xs font-medium tabular-nums hover:bg-muted">{rate}x</button>
    </div>
  );
}
