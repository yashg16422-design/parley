"use client";

import { useEffect, useRef, useState } from "react";
import { CircleHelp, GitCommitHorizontal, ListChecks, Sparkles } from "lucide-react";
import type { Insight, LiveInsights } from "@/live-insights";
import { LoadingDots } from "@/components/loading-dots";
import { Scratchpad } from "@/components/meeting/scratchpad";
import { clock } from "@/lib/format";

const THROTTLE_MS = 6_000;

/** Running notes during a call: refreshed as new lines arrive (at most every 6 s). */
export function LiveInsightsPanel({ meetingId, lineCount }: { meetingId: string | null; lineCount: number }) {
  const [data, setData] = useState<LiveInsights | null>(null);
  const last = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!meetingId || !lineCount) return;
    const load = async () => {
      last.current = Date.now();
      const r = await fetch(`/api/meetings/${meetingId}/insights`).catch(() => null);
      if (r?.ok) setData(await r.json());
    };
    const wait = THROTTLE_MS - (Date.now() - last.current);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(load, Math.max(0, wait));
    return () => void (timer.current && clearTimeout(timer.current));
  }, [meetingId, lineCount]);

  const empty = data && !data.decisions.length && !data.actions.length && !data.questions.length && !data.topics.length;
  return (
    <section className="space-y-5">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-primary" />
        <h2 className="text-sm font-semibold">Live notes</h2>
        {data && (
          <span className="ml-auto text-[11px] text-muted-foreground">
            {data.source === "rules" ? "Rule-based · add a model for AI" : `AI through ${clock(data.aiUntilMs)}${data.source === "mixed" ? " + live" : ""}`}
          </span>
        )}
      </div>
      {!data && <LoadingDots label={lineCount ? "Building notes…" : "Notes appear as people talk."} className="py-8" />}
      {empty && <p className="text-sm text-muted-foreground">Listening for decisions, commitments and open questions…</p>}
      {data && (
        <>
          <Group icon={GitCommitHorizontal} title="Decisions" items={data.decisions} />
          <Group icon={ListChecks} title="Action items" items={data.actions} owner />
          <Group icon={CircleHelp} title="Open questions" items={data.questions} />
          {data.topics.length > 0 && (
            <div>
              <h3 className="mb-1.5 text-xs font-medium text-muted-foreground">Topics so far</h3>
              <ul className="space-y-2">
                {data.topics.map((t) => (
                  <li key={`${t.seq}-${t.title}`} className="text-sm"><span className="font-medium">{t.title}</span> <span className="font-mono text-[11px] text-muted-foreground">{clock(t.startMs)}</span><p className="text-muted-foreground">{t.text}</p></li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Group({ icon: Icon, title, items, owner }: { icon: typeof Sparkles; title: string; items: Insight[]; owner?: boolean }) {
  if (!items.length) return null;
  return (
    <div>
      <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Icon className="size-3.5" />{title} · {items.length}</h3>
      <ul className="space-y-1.5">
        {items.map((x) => (
          <li key={`${x.seq}-${x.text.slice(0, 24)}`} className="animate-in fade-in slide-in-from-bottom-1 grid grid-cols-[40px_1fr] gap-2 text-sm duration-300">
            <span className="pt-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">{clock(x.startMs)}</span>
            <span>{x.text}{owner && x.owner && <span className="text-muted-foreground"> · {x.owner}</span>}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Side panel for a call in progress: the AI's running notes, and your own scratchpad. */
export function LiveSide({ meetingId, lineCount, now }: { meetingId: string | null; lineCount: number; now: () => number }) {
  const [tab, setTab] = useState<"notes" | "pad">("notes");
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 rounded-lg bg-muted p-0.5 text-xs font-medium">
        {(["notes", "pad"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-md py-1.5 transition-colors ${tab === t ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{t === "notes" ? "Live notes" : "Scratchpad"}</button>
        ))}
      </div>
      {tab === "notes" ? <LiveInsightsPanel meetingId={meetingId} lineCount={lineCount} /> : meetingId ? <Scratchpad meetingId={meetingId} now={now} /> : null}
    </div>
  );
}
