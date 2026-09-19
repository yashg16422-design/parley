"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, Sparkles } from "lucide-react";
import type { AskResult } from "@/ai/ask";
import { LoadingDots } from "@/components/loading-dots";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clock, fmtDay } from "@/lib/format";

type Turn = { q: string; a?: AskResult; error?: string };
const EXAMPLES = ["What did customers say about SSO?", "Which decisions did we make about the beta?", "What is Raj working on?", "What are the open risks for launch?", "What meetings do I have coming up this week?"];

/** Answer text with [n] markers turned into links to the exact moment in the call. */
function Answer({ a }: { a: AskResult }) {
  const byN = new Map(a.citations.map((c) => [c.n, c]));
  return (
    <p className="leading-relaxed">
      {a.answer.split(/(\[\d+\])/g).map((part, i) => {
        const c = byN.get(Number(part.match(/^\[(\d+)\]$/)?.[1]));
        if (!c) return <Fragment key={i}>{part}</Fragment>;
        return (
          <Link key={i} href={c.href} title={`${c.title} · ${c.kind === "event" ? "calendar" : clock(c.startMs)}`} className="mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded bg-primary/10 px-1 align-text-top font-mono text-[11px] font-medium text-primary transition-colors hover:bg-primary hover:text-primary-foreground">
            {c.n}
          </Link>
        );
      })}
    </p>
  );
}

export function AskView({ initial }: { initial?: string }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const asked = useRef(false);

  async function run(question: string) {
    if (question.trim().length < 3 || busy) return;
    setBusy(true), setQ("");
    setTurns((t) => [...t, { q: question }]);
    const settle = (patch: Partial<Turn>) => setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, ...patch } : x)));
    try {
      const r = await fetch("/api/ai/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question }) });
      const json = await r.json();
      settle(r.ok ? { a: json } : { error: json.error ?? `HTTP ${r.status}` });
    } catch {
      settle({ error: "Couldn't reach Parley. Check your connection." });
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (initial && !asked.current) (asked.current = true), void run(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [turns]);

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-5rem)] max-w-3xl flex-col px-6">
      <div className="flex-1 space-y-8 py-8">
        {!turns.length && (
          <div className="pt-10">
            <Sparkles className="size-6 text-primary" />
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.02em]">Ask anything about your meetings and calendar.</h2>
            <p className="mt-2 max-w-prose text-sm text-muted-foreground">Answers come only from your transcripts and calendar, and every sentence links to its source.</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {EXAMPLES.map((e) => <button key={e} onClick={() => run(e)} className="rounded-lg border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">{e}</button>)}
            </div>
          </div>
        )}
        {turns.map((t, i) => (
          <section key={i} className="space-y-3">
            <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-muted px-4 py-2 text-sm">{t.q}</p>
            {!t.a && !t.error && <LoadingDots label="Reading your meetings…" className="items-start py-2" />}
            {t.error && <p className="text-sm text-destructive">{t.error}</p>}
            {t.a && (
              <div className="space-y-3 text-sm">
                <Answer a={t.a} />
                {t.a.source === "quotes" && <p className="text-xs text-muted-foreground">Connect a model in Settings (Claude, ChatGPT or Hugging Face) for written answers.</p>}
                {t.a.citations.length > 0 && (
                  <details className="rounded-lg border">
                    <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-muted-foreground">Sources · {t.a.citations.length}{t.a.model ? ` · answered by ${t.a.model}` : ""}</summary>
                    <ol className="divide-y border-t">
                      {t.a.citations.map((c) => (
                        <li key={c.n}>
                          <Link href={c.href} className="flex gap-3 px-3 py-2 hover:bg-muted/50">
                            <span className="font-mono text-xs text-primary">{c.n}</span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-xs text-muted-foreground">{c.title}{c.startedAt ? ` · ${fmtDay(new Date(c.startedAt))}` : ""} · {c.kind === "event" ? "calendar" : clock(c.startMs)}</span>
                              <span className="block">{c.kind === "event" ? c.text : <><b className="font-medium">{c.speakerName}:</b> {c.text}</>}</span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ol>
                  </details>
                )}
              </div>
            )}
          </section>
        ))}
        <div ref={bottom} />
      </div>
      <form onSubmit={(e) => (e.preventDefault(), run(q))} className="sticky bottom-0 flex gap-2 border-t bg-background py-4">
        <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about any meeting or what’s coming up…" maxLength={500} className="h-11" />
        <Button size="icon" className="size-11" disabled={busy || q.trim().length < 3} aria-label="Ask"><ArrowUp /></Button>
      </form>
    </div>
  );
}
