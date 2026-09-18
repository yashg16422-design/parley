"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, Search } from "lucide-react";
import { searchAction, type SearchResult } from "@app/actions/search";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { clock, fmtDay } from "@/lib/format";

const SUGGESTIONS = ["single sign-on", "pricing", "outage", "Globex", "action items for Priya", "Jira"];

export function SearchView({ initial }: { initial: string }) {
  const [q, setQ] = useState(initial);
  const [res, setRes] = useState<SearchResult | null>(null);
  const [pending, start] = useTransition();
  const run = (query: string) => {
    setQ(query);
    if (query.trim()) start(async () => setRes(await searchAction({ query, limit: 50 })));
  };
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <form onSubmit={(e) => (e.preventDefault(), run(q))} className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input autoFocus className="h-11 pl-9 text-base" placeholder="Search every call… try “SSO” or “single sign-on”" value={q} onChange={(e) => setQ(e.target.value)} />
        {pending && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </form>
      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => <button key={s} onClick={() => run(s)} className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary">{s}</button>)}
      </div>
      {res && !res.ok && <p className="text-sm text-destructive">{res.error}</p>}
      {res?.ok && (
        <>
          <p className="text-xs text-muted-foreground">{res.hits.length} moments in {res.meetings} meetings{res.expanded.includes("|") && <> · also matching synonyms (<code className="text-[11px]">{res.expanded}</code>)</>}</p>
          <div className="space-y-2">
            {res.hits.map((h) => (
              <Link key={`${h.meetingId}-${h.seq}`} href={h.href}>
                <Card className="gap-1.5 p-4 transition-colors hover:border-primary/50 hover:bg-muted/30">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{h.title}</span>
                    {h.startedAt && <span>· {fmtDay(new Date(h.startedAt))}</span>}
                    <span className="ml-auto font-mono text-primary">{clock(h.startMs)}</span>
                  </div>
                  <p className="text-sm"><span className="font-medium">{h.speakerName}: </span>{h.parts.map((p, i) => (p.hit ? <mark key={i} className="rounded bg-primary/15 px-0.5 text-foreground">{p.text}</mark> : <span key={i}>{p.text}</span>))}</p>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
