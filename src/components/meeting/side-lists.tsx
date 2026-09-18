"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, Bookmark, Check, Copy, Scissors } from "lucide-react";
import { toggleActionItem } from "@app/actions/meetings";
import { PersonAvatar } from "@/components/person";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { clock } from "@/lib/format";

export type ActionItemView = {
  id: string; text: string; status: "open" | "done"; dueText: string | null; assigneeName: string | null;
  assignee: { name: string; color: string } | null; sourceSeqs: number[]; sourceStartMs: number | null; verified: boolean; origin: "ai" | "manual";
};

/** In a meeting, timestamps seek the player (`onJump`); elsewhere they link into the meeting (`meetingId`). */
export function ActionItems({ items, onJump, meetingId }: { items: ActionItemView[]; onJump?: (ms: number, seq?: number) => void; meetingId?: string }) {
  const [optimistic, set] = useOptimistic(items, (cur, { id, done }: { id: string; done: boolean }) => cur.map((a) => (a.id === id ? { ...a, status: done ? ("done" as const) : ("open" as const) } : a)));
  const [, start] = useTransition();
  if (!items.length) return <p className="text-sm text-muted-foreground">No action items in this call.</p>;
  return (
    <ul className="space-y-1">
      {optimistic.map((a) => (
        <li key={a.id} className="flex gap-3 rounded-lg p-2 hover:bg-muted/50">
          <Checkbox className="mt-0.5" checked={a.status === "done"} onCheckedChange={(v) => start(async () => (set({ id: a.id, done: !!v }), toggleActionItem(a.id, !!v)))} />
          <div className="min-w-0 flex-1 text-sm">
            <p className={cn("leading-snug", a.status === "done" && "text-muted-foreground line-through")}>{a.text}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {(a.assignee || a.assigneeName) && <span className="flex items-center gap-1"><PersonAvatar name={a.assignee?.name ?? a.assigneeName!} color={a.assignee?.color} className="size-4 text-[8px] ring-0" />{a.assignee?.name ?? a.assigneeName}</span>}
              {a.dueText && <span>· {a.dueText}</span>}
              {a.sourceStartMs !== null && (onJump
                ? <button onClick={() => onJump(a.sourceStartMs!, a.sourceSeqs[0])} className="font-mono text-primary hover:underline">{clock(a.sourceStartMs)}</button>
                : <Link href={`/meetings/${meetingId}?t=${a.sourceStartMs}#line-${a.sourceSeqs[0]}`} className="font-mono text-primary hover:underline">{clock(a.sourceStartMs)}</Link>)}
              {a.origin === "ai" && !a.verified && <span className="flex items-center gap-1 text-amber-600"><AlertTriangle className="size-3" />Needs review</span>}
              {a.origin === "manual" && <span>· added manually</span>}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Moments({ highlights, clips, onJump }: {
  highlights: { id: string; atMs: number; label: string | null }[];
  clips: { slug: string; title: string; startMs: number; endMs: number; viewCount: number }[];
  onJump: (ms: number) => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (slug: string) => navigator.clipboard.writeText(`${location.origin}/c/${slug}`).then(() => setCopied(slug));
  return (
    <div className="space-y-5">
      <section>
        <h3 className="mb-2 text-sm font-semibold">Highlights</h3>
        {highlights.length ? highlights.map((h) => (
          <button key={h.id} onClick={() => onJump(h.atMs)} className="flex w-full items-start gap-2 rounded-lg p-2 text-left text-sm hover:bg-muted/50">
            <Bookmark className="mt-0.5 size-4 shrink-0 fill-amber-400 text-amber-500" />
            <span className="flex-1">{h.label ?? "Highlight"}</span>
            <span className="font-mono text-xs text-muted-foreground">{clock(h.atMs)}</span>
          </button>
        )) : <p className="text-sm text-muted-foreground">No highlights yet.</p>}
      </section>
      <section>
        <h3 className="mb-2 text-sm font-semibold">Clips</h3>
        {clips.length ? clips.map((c) => (
          <div key={c.slug} className="flex items-center gap-2 rounded-lg p-2 text-sm hover:bg-muted/50">
            <Scissors className="size-4 shrink-0 text-primary" />
            <button onClick={() => onJump(c.startMs)} className="min-w-0 flex-1 text-left">
              <div className="truncate">{c.title}</div>
              <div className="text-xs text-muted-foreground">{clock(c.startMs)}–{clock(c.endMs)} · {c.viewCount} views</div>
            </button>
            <button onClick={() => copy(c.slug)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Copy link">
              {copied === c.slug ? <Check className="size-4 text-green-600" /> : <Copy className="size-4" />}
            </button>
          </div>
        )) : <p className="text-sm text-muted-foreground">Select lines in the transcript to create a clip.</p>}
      </section>
    </div>
  );
}

export function TalkTime({ participants, total }: { participants: { id: string; name: string; color: string; talkMs: number }[]; total: number }) {
  return (
    <div className="space-y-1.5">
      {[...participants].sort((a, b) => b.talkMs - a.talkMs).map((p) => (
        <div key={p.id} className="flex items-center gap-2 text-xs">
          <span className="w-24 truncate">{p.name}</span>
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full" style={{ width: `${(p.talkMs / (total || 1)) * 100}%`, backgroundColor: p.color }} /></span>
          <span className="w-9 text-right tabular-nums text-muted-foreground">{Math.round((p.talkMs / (total || 1)) * 100)}%</span>
        </div>
      ))}
    </div>
  );
}
