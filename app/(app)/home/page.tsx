import Link from "next/link";
import { CalendarPlus, CheckCircle2, Clock, Mic, Radio, Sparkles, Video } from "lucide-react";
import { Attachments, PLATFORM } from "@/components/event-details";
import { JoinRecord } from "@/components/join-record";
import { PageHeader } from "@/components/page-header";
import { AvatarStack } from "@/components/person";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { duration, fmtTime, relativeDay } from "@/lib/format";
import { currentUser, listMeetings, upcomingEvents } from "@/queries";


export default async function Home() {
  const me = await currentUser();
  const [meetings, upcoming] = await Promise.all([listMeetings(me.id), upcomingEvents(me.id, 3)]);
  const groups = Map.groupBy(meetings, (m) => relativeDay(m.startedAt ?? new Date()));
  const open = meetings.flatMap((m) => m.actionItems).filter((a) => a.status === "open").length;
  const hours = meetings.reduce((a, m) => a + m.durationMs, 0) / 3_600_000;

  return (
    <>
      <PageHeader title={`Good to see you, ${me.name.split(" ")[0]}`} subtitle="Your recorded calls, summarized and searchable.">
        <Button asChild variant="outline"><Link href="/live"><Radio />Replay a sample</Link></Button>
        <Button asChild><Link href="/live/mic"><Mic />Record a meeting</Link></Button>
      </PageHeader>
      <div className="grid gap-6 p-6 xl:grid-cols-[1fr_320px]">
        <section className="min-w-0 space-y-6">
          <div className="grid grid-cols-3 gap-3">
            {[
              [Video, meetings.length, "calls recorded"],
              [Clock, `${hours.toFixed(1)}h`, "of conversation"],
              [CheckCircle2, open, "open action items"],
            ].map(([Icon, n, label]) => {
              const I = Icon as typeof Video;
              return (
                <Card key={String(label)} className="flex-row items-center gap-3 p-4 max-sm:p-3">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary max-sm:hidden"><I className="size-4" /></span>
                  <div><div className="text-lg font-semibold leading-none">{String(n)}</div><div className="mt-1 text-xs text-muted-foreground">{String(label)}</div></div>
                </Card>
              );
            })}
          </div>
          {!meetings.length && (
            <Card className="items-center gap-3 p-10 text-center">
              <Mic className="size-8 text-primary" />
              <h2 className="font-semibold">No meetings yet</h2>
              <p className="max-w-sm text-sm text-muted-foreground">Record a real conversation from your microphone, or replay a sample call to see notes build live.</p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild><Link href="/live/mic"><Mic />Record a meeting</Link></Button>
                <Button asChild variant="outline"><Link href="/live"><Radio />Replay a sample call</Link></Button>
                {!upcoming.length && <Button asChild variant="ghost"><Link href="/calendar"><CalendarPlus />Connect calendar</Link></Button>}
              </div>
            </Card>
          )}
          {[...groups].map(([day, items]) => (
            <div key={day}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{day}</h2>
              <Card className="gap-0 divide-y p-0">
                {items.map((m) => {
                  const done = m.actionItems.filter((a) => a.status === "done").length;
                  return (
                    <Link key={m.id} href={`/meetings/${m.id}`} className="group flex gap-4 p-4 transition-colors hover:bg-muted/40">
                      <div className="w-16 shrink-0 pt-0.5 text-xs text-muted-foreground max-sm:hidden">{m.startedAt && fmtTime(m.startedAt)}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium group-hover:text-primary">{m.title}</span>
                          {m.status === "live" ? <Badge className="gap-1.5 bg-red-600 text-white"><span className="size-1.5 animate-pulse rounded-full bg-white" />Live · watch</Badge> : m.status !== "ready" && <Badge variant="secondary" className="capitalize">{m.status}</Badge>}
                        </div>
                        {m.knowledge && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground"><Sparkles className="mr-1 inline size-3.5 text-primary" />{m.knowledge.knowledge.overview}</p>}
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span className="sm:hidden">{m.startedAt && fmtTime(m.startedAt)} ·</span><span>{duration(m.durationMs)}</span><span>·</span><span>{PLATFORM[m.platform]}</span>
                          {m.actionItems.length > 0 && <><span>·</span><span>{done}/{m.actionItems.length} action items done</span></>}
                        </div>
                      </div>
                      <div className="max-sm:hidden"><AvatarStack people={m.participants} /></div>
                    </Link>
                  );
                })}
              </Card>
            </div>
          ))}
        </section>
        <aside className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Coming up</h2>
            <Link href="/calendar" className="text-xs text-primary hover:underline">Calendar</Link>
          </div>
          {!upcoming.length && <p className="text-sm text-muted-foreground">Nothing scheduled. <Link href="/calendar" className="text-primary hover:underline">Connect your calendar</Link></p>}
          {upcoming.map((e) => (
            <Card key={e.id} className="gap-2 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-medium leading-snug">{e.title}</div>
                <Badge variant={e.recordEnabled ? "default" : "outline"} className="shrink-0">{e.recordEnabled ? "Will record" : "Off"}</Badge>
              </div>
              <div className="text-xs text-muted-foreground">{relativeDay(e.startsAt)} · {fmtTime(e.startsAt)} · {PLATFORM[e.platform]}</div>
              <Attachments eventId={e.id} items={e.attachments.slice(0, 2)} />
              <JoinRecord eventId={e.id} meetingUrl={e.meetingUrl} platform={e.platform} />
            </Card>
          ))}
        </aside>
      </div>
    </>
  );
}
