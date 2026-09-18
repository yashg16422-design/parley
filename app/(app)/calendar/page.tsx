import Link from "next/link";
import { CalendarPlus, CheckCircle2 } from "lucide-react";
import { connectCalendar } from "@app/actions/workspace";
import { Agenda, Attachments, PLATFORM } from "@/components/event-details";
import { JoinRecord } from "@/components/join-record";
import { PageHeader } from "@/components/page-header";
import { AvatarStack } from "@/components/person";
import { RecordToggle } from "@/components/record-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fmtTime, relativeDay } from "@/lib/format";
import { calendar, currentUser } from "@/queries";

export default async function CalendarPage() {
  const me = await currentUser();
  const events = await calendar(me.id);
  const conn = events.find((e) => e.connection)?.connection;
  const now = new Date();
  const days = Map.groupBy(events, (e) => relativeDay(e.startsAt));
  return (
    <>
      <PageHeader title="Calendar" subtitle="Meetings on your calendar are recorded unless you turn them off.">
        {conn && <Badge variant="secondary" className="gap-1.5"><CheckCircle2 className="text-green-600" />{conn.provider === "google" ? "Google Calendar" : "Outlook"} · {conn.accountEmail}</Badge>}
      </PageHeader>
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        {!events.length && (
          <Card className="items-center gap-3 p-10 text-center">
            <CalendarPlus className="size-8 text-primary" />
            <h2 className="font-semibold">Connect your calendar</h2>
            <p className="max-w-sm text-sm text-muted-foreground">See upcoming meetings with their agendas, files and join links, and record them in one click. (Simulated Google connection with sample events.)</p>
            <form action={connectCalendar}><Button>Connect Google Calendar</Button></form>
          </Card>
        )}
        {[...days].map(([day, list]) => (
          <div key={day}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{day}</h2>
            <Card className="gap-0 divide-y p-0">
              {list.map((e) => {
                const past = e.endsAt < now;
                return (
                  <div key={e.id} className="flex gap-4 p-4 max-sm:flex-col">
                    <div className="w-20 shrink-0 text-xs text-muted-foreground">{fmtTime(e.startsAt)}<br />{fmtTime(e.endsAt)}</div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium">{e.title}</div>
                          <div className="text-xs text-muted-foreground">{PLATFORM[e.platform]} · {e.attendees.length} attendee{e.attendees.length === 1 ? "" : "s"}</div>
                        </div>
                        {e.meeting ? <Link href={`/meetings/${e.meeting.id}`} className="shrink-0 text-xs font-medium text-primary hover:underline">View notes</Link>
                          : past ? <span className="shrink-0 text-xs text-muted-foreground">Not recorded</span>
                          : <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">Auto-record<RecordToggle eventId={e.id} enabled={e.recordEnabled} /></div>}
                      </div>
                      <Agenda text={e.agenda} clamp />
                      <Attachments eventId={e.id} items={e.attachments} />
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <AvatarStack people={e.attendees.map((a) => ({ name: a.name }))} max={6} />
                        {!past && !e.meeting && <JoinRecord eventId={e.id} meetingUrl={e.meetingUrl} platform={e.platform} />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </Card>
          </div>
        ))}
      </div>
    </>
  );
}
