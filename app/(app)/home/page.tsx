import Link from "next/link";
import { AlertTriangle, CalendarPlus, CheckCircle2, Mic, Radio, Sparkles } from "lucide-react";
import { CommandBar } from "@/components/command-bar";
import { PLATFORM } from "@/components/event-details";
import { JoinByLink } from "@/components/join-by-link";
import { JoinRecord } from "@/components/join-record";
import { AvatarStack } from "@/components/person";
import { Button } from "@/components/ui/button";
import { duration, fmtTime, relativeDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import { currentUser, listMeetings, upcomingEvents } from "@/queries";

type M = Awaited<ReturnType<typeof listMeetings>>[number];

/** What the AI has done with a call, at a glance. */
function AiStatus({ m }: { m: M }) {
  const base = "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium";
  if (m.status === "live") return <span className={cn(base, "bg-red-600 text-white")}><span className="size-1.5 animate-pulse rounded-full bg-white" />Live</span>;
  if (m.status === "processing") return <span className={cn(base, "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200")}>Writing notes…</span>;
  if (m.status === "failed") return <span className={cn(base, "bg-destructive/10 text-destructive")}><AlertTriangle className="size-3" />Notes failed</span>;
  return <span className={cn(base, "bg-primary/10 text-primary")}><Sparkles className="size-3" />Notes ready</span>;
}

export default async function Home() {
  const me = await currentUser();
  const [meetings, upcoming] = await Promise.all([listMeetings(me.id), upcomingEvents(me.id, 7)]);
  const groups = Map.groupBy(meetings, (m) => relativeDay(m.startedAt ?? new Date()));
  const open = meetings.flatMap((m) => m.actionItems).filter((a) => a.status === "open").length;
  const hours = meetings.reduce((a, m) => a + m.durationMs, 0) / 3_600_000;

  return (
    <div className="mx-auto max-w-[1400px] px-6 pb-12">
      <header className="flex flex-wrap items-end justify-between gap-4 pb-5 pt-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">Good to see you, {me.name.split(" ")[0]}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="tabular-nums text-foreground">{meetings.length}</span> calls · <span className="tabular-nums text-foreground">{hours.toFixed(1)}h</span> recorded · <span className="tabular-nums text-foreground">{open}</span> open action items
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="ghost"><Link href="/live"><Radio />Replay a sample</Link></Button>
          <Button asChild><Link href="/live/mic"><Mic />Record</Link></Button>
        </div>
      </header>

      <div className="space-y-2">
        <CommandBar variant="hero" />
        <JoinByLink signedIn compact />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[272px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Upcoming</h2>
            <Link href="/calendar" className="text-xs text-muted-foreground hover:text-foreground">Calendar →</Link>
          </div>
          {!upcoming.length && (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              <CalendarPlus className="mb-2 size-4" />Nothing in the next 7 days. <Link href="/calendar" className="text-primary hover:underline">Connect your calendar</Link>
            </div>
          )}
          <ol className="relative space-y-4 border-l pl-4">
            {upcoming.map((e) => (
              <li key={e.id} className="relative">
                <span className={cn("absolute -left-[21px] top-1.5 size-2 rounded-full ring-4 ring-background", e.recordEnabled ? "bg-primary" : "bg-muted-foreground/40")} />
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{relativeDay(e.startsAt)} · {fmtTime(e.startsAt)}</p>
                <p className="mt-0.5 text-sm font-medium leading-snug">{e.title}</p>
                <p className="mb-2 text-xs text-muted-foreground">{PLATFORM[e.platform]}{e.recordEnabled ? "" : " · won't record"}</p>
                <JoinRecord eventId={e.id} meetingUrl={e.meetingUrl} platform={e.platform} />
              </li>
            ))}
          </ol>
        </aside>

        <section className="min-w-0 space-y-8">
          {!meetings.length && (
            <div className="rounded-xl border border-dashed p-10 text-center">
              <Mic className="mx-auto size-6 text-primary" />
              <h2 className="mt-3 font-semibold">No meetings yet</h2>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Paste a Zoom, Meet or Teams link above, record from your microphone, or replay a sample call to see notes build live.</p>
            </div>
          )}
          {[...groups].map(([day, items]) => (
            <section key={day}>
              <h2 className="mb-3 text-sm font-semibold">{day}</h2>
              <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                {items.map((m) => {
                  const done = m.actionItems.filter((a) => a.status === "done").length;
                  return (
                    <Link key={m.id} href={`/meetings/${m.id}`} className="group flex flex-col rounded-xl border bg-background p-4 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-px hover:border-foreground/15 hover:shadow-[0_8px_24px_-12px_rgb(0_0_0/0.18)]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs tabular-nums text-muted-foreground">{m.startedAt && fmtTime(m.startedAt)} · {duration(m.durationMs)} · {PLATFORM[m.platform]}</span>
                        <AiStatus m={m} />
                      </div>
                      <h3 className="mt-2 font-medium leading-snug group-hover:text-primary">{m.title}</h3>
                      <p className="mt-1.5 line-clamp-3 flex-1 text-sm text-muted-foreground">{m.knowledge?.overview ?? (m.status === "live" ? "Recording now. Open to watch the transcript and live notes." : "Notes will appear here when processing finishes.")}</p>
                      <div className="mt-4 flex items-center justify-between">
                        <AvatarStack people={m.participants} />
                        {m.actionItems.length > 0 && <span className="flex items-center gap-1 text-xs tabular-nums text-muted-foreground"><CheckCircle2 className="size-3.5" />{done}/{m.actionItems.length}</span>}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </section>
      </div>
    </div>
  );
}
