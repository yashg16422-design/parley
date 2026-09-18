"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { clock } from "@/lib/format";

type Section = { id: string; heading: string; items: { text: string; seqs: number[] }[] };
type Meta = { source: "cache" | "live" | "simulated"; model: string | null; note?: string };
const SOURCE = { cache: "Saved", live: "AI · just now", simulated: "Simulated" } as const;

/** Streams /api/summary (NDJSON) for the chosen template; citations jump to the transcript line. */
export function SummaryPanel({ meetingId, templates, initial, startOf, onCite }: {
  meetingId: string;
  templates: { id: string; name: string }[];
  initial: string;
  startOf: (seq: number) => number | undefined;
  onCite: (seq: number) => void;
}) {
  const [templateId, setTemplateId] = useState(initial);
  const [sections, setSections] = useState<Section[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctl = new AbortController();
    setSections([]), setMeta(null), setError(null);
    (async () => {
      const res = await fetch(`/api/summary?meetingId=${meetingId}&templateId=${templateId}`, { signal: ctl.signal });
      if (!res.body) return setError("No response");
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += value;
        const lines = buf.split("\n");
        buf = lines.pop()!;
        for (const l of lines.filter(Boolean)) {
          const e = JSON.parse(l);
          if (e.type === "meta") setMeta(e);
          else if (e.type === "section") setSections((s) => [...s, e.section]);
          else if (e.type === "error") setError(e.message);
        }
      }
    })().catch((e) => e.name !== "AbortError" && setError(String(e)));
    return () => ctl.abort();
  }, [meetingId, templateId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Select value={templateId} onValueChange={setTemplateId}>
          <SelectTrigger className="flex-1"><Sparkles className="text-primary" /><SelectValue /></SelectTrigger>
          <SelectContent>{templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
        </Select>
        {meta && <Badge variant={meta.source === "simulated" ? "outline" : "secondary"} title={meta.note ?? meta.model ?? ""}>{SOURCE[meta.source]}</Badge>}
      </div>
      {error && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {!error && !sections.length && <div className="space-y-2">{[80, 95, 60, 90].map((w) => <Skeleton key={w} className="h-4" style={{ width: `${w}%` }} />)}</div>}
      {sections.map((sec) => (
        <section key={sec.id} className="animate-in fade-in slide-in-from-bottom-1">
          <h3 className="mb-1.5 text-sm font-semibold">{sec.heading}</h3>
          {sec.items.length ? (
            <ul className="space-y-1.5">
              {sec.items.map((it, i) => (
                <li key={i} className="flex gap-2 text-sm leading-relaxed text-foreground/90">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary/60" />
                  <span>
                    {it.text}
                    {it.seqs.slice(0, 2).map((q) => {
                      const at = startOf(q);
                      return at === undefined ? null : (
                        <button key={q} onClick={() => onCite(q)} className="ml-1.5 rounded bg-primary/10 px-1 font-mono text-[10px] text-primary hover:bg-primary/20">{clock(at)}</button>
                      );
                    })}
                  </span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted-foreground">Nothing noted.</p>}
        </section>
      ))}
    </div>
  );
}
