"use client";

import { memo } from "react";
import { Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { clock } from "@/lib/format";
import type { Seg } from "./player";

type Props = {
  segments: readonly Seg[];
  colors: Record<string, string>;
  activeIdx: number;
  highlightSeqs?: ReadonlySet<number>;
  selected?: [number, number] | null;
  onLine: (s: Seg) => void;
};

/** Speaker-grouped transcript with a timestamp marker on every turn. Lines are memoized; only the active one re-renders. */
export function Transcript({ segments, colors, activeIdx, highlightSeqs, selected, onLine }: Props) {
  return (
    <div className="px-4 py-3">
      {segments.map((s, i) => (
        <Line
          key={s.seq}
          seg={s}
          color={colors[s.participantId] ?? "#888"}
          newTurn={i === 0 || segments[i - 1]!.participantId !== s.participantId}
          active={i === activeIdx}
          highlighted={highlightSeqs?.has(s.seq) ?? false}
          inSelection={!!selected && s.seq >= selected[0] && s.seq <= selected[1]}
          onLine={onLine}
        />
      ))}
    </div>
  );
}

const Line = memo(function Line({ seg, color, newTurn, active, highlighted, inSelection, onLine }: {
  seg: Seg; color: string; newTurn: boolean; active: boolean; highlighted: boolean; inSelection: boolean; onLine: (s: Seg) => void;
}) {
  return (
    <div id={`line-${seg.seq}`} className={cn("transcript-line group grid grid-cols-[56px_1fr] gap-x-3 rounded-md px-2", newTurn && "mt-3")}>
      <button onClick={() => onLine(seg)} className="self-start pt-1 text-right font-mono text-[11px] tabular-nums text-muted-foreground hover:text-primary">
        {newTurn ? clock(seg.startMs) : <span className="opacity-0 group-hover:opacity-100">{clock(seg.startMs)}</span>}
      </button>
      <div className={cn("-mx-2 rounded-md px-2 py-0.5 transition-colors", active && "bg-primary/10", inSelection && "bg-amber-100 dark:bg-amber-500/20")}>
        {newTurn && <div className="text-xs font-semibold" style={{ color }}>{seg.speakerName}</div>}
        <p onClick={() => onLine(seg)} className="cursor-pointer text-sm leading-relaxed text-foreground/90">
          {highlighted && <Bookmark className="mr-1 inline size-3.5 fill-amber-400 text-amber-500" />}
          {seg.text}
        </p>
      </div>
    </div>
  );
});
