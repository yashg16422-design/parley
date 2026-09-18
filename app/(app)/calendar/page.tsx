import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { AvatarStack } from "@/components/person";
import { RecordToggle } from "@/components/record-toggle";
import { Badge } from "@/components/ui/badge";
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
      <PageHeader title="Calendar" subtitle="Meetings on your calendar are recorded automatically unless you turn them off.">
        {conn && <Badge variant="secondary" className="gap-1.5"><CheckCircle2 className="text-green-600" />{conn.provider === "google" ? "Google Calendar" : "Outlook"} · {conn.accountEmail}</Badge>}
      </PageHeader>
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        {[...days].map(([day, list]) => (
          <div key={day}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{day}</h2>
            <Card className="gap-0 divide-y p-0">
              {list.map((e) => {
                const past = e.startsAt < now;
                return (
                  <div key={e.id} className="flex items-center gap-4 p-4">
                    <div className="w-20 shrink-0 text-xs text-muted-foreground">{fmtTime(e.startsAt)}<br />{fmtTime(e.endsAt)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{e.title}</div>
                      <div className="mt-1.5"><AvatarStack people={e.attendees.map((a) => ({ name: a.name }))} max={6} /></div>
                    </div>
                    {e.meeting ? (
                      <Link href={`/meetings/${e.meeting.id}`} className="text-xs font-medium text-primary hover:underline">View notes</Link>
                    ) : past ? (
                      <span className="text-xs text-muted-foreground">Not recorded</span>
                    ) : (
                      <RecordToggle eventId={e.id} enabled={e.recordEnabled} />
                    )}
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
