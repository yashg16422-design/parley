"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CalendarDays, Search } from "lucide-react";
import { LoadingDots } from "@/components/loading-dots";
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
      </form>
      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => <button key={s} onClick={() => run(s)} className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary">{s}</button>)}
      </div>
      {pending && <LoadingDots label="Searching your calls…" className="py-16" />}
      {!pending && res && !res.ok && <p className="text-sm text-destructive">{res.error}</p>}
      {!pending && res?.ok && (
        <>
          <p className="text-xs text-muted-foreground">{res.hits.length} moments in {res.meetings} meetings{res.events.length ? `, ${res.events.length} calendar events` : ""}{res.expanded.includes("|") && <> · also matching synonyms (<code className="text-[11px]">{res.expanded}</code>)</>}</p>
          {res.events.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Calendar, agendas & files</h2>
              {res.events.map((e) => (
                <Link key={e.id} href={e.meetingId ? `/meetings/${e.meetingId}` : "/calendar"}>
                  <Card className="gap-1 p-3 transition-colors hover:border-primary/50 hover:bg-muted/30">
                    <div className="flex items-center gap-2 text-sm font-medium"><CalendarDays className="size-4 text-primary" />{e.title}<span className="ml-auto text-xs font-normal text-muted-foreground">{fmtDay(new Date(e.startsAt))}</span></div>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{e.parts.map((p, i) => (p.hit ? <mark key={i} className="rounded bg-primary/15 px-0.5 text-foreground">{p.text}</mark> : <span key={i}>{p.text}</span>))}</p>
                  </Card>
                </Link>
              ))}
              <h2 className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Transcripts</h2>
            </div>
          )}
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
