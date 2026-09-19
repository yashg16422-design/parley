import Link from "next/link";
import { after } from "next/server";
import { and, eq } from "drizzle-orm";
import { syncIcs } from "@/calendar/ics";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { FeedForm } from "@/components/settings-forms";
import { vaultReady } from "@/vault";
import { CalendarPlus, CheckCircle2 } from "lucide-react";
import { connectCalendar } from "@app/actions/workspace";
import { Agenda, Attachments, PLATFORM } from "@/components/event-details";
import { JoinRecord } from "@/components/join-record";
import { PageHeader } from "@/components/page-header";
import { AvatarStack } from "@/components/person";
import { RecordToggle } from "@/components/record-toggle";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/submit-button";
import { Card } from "@/components/ui/card";
import { fmtTime, relativeDay } from "@/lib/format";
import { calendar, currentUser } from "@/queries";

export default async function CalendarPage() {
  const me = await currentUser();
  const db = getDb();
  const [events, feed] = await Promise.all([
    calendar(me.id),
    db.query.calendarConnections.findFirst({ where: and(eq(s.calendarConnections.userId, me.id), eq(s.calendarConnections.provider, "ics")) }),
  ]);
  const conn = events.find((e) => e.connection)?.connection;
  // A real feed older than 15 minutes refreshes in the background; the next view shows it.
  if (feed?.feedUrlSecret && (!feed.lastSyncedAt || Date.now() - feed.lastSyncedAt.getTime() > 15 * 60_000)) {
    after(() => syncIcs(getDb(), me.id).catch(() => {}));
  }
  const now = new Date();
  const days = Map.groupBy(events, (e) => relativeDay(e.startsAt));
  return (
    <>
      <PageHeader title="Calendar" subtitle="Meetings on your calendar are recorded unless you turn them off.">
        {conn && <Badge variant="secondary" className="gap-1.5"><CheckCircle2 className="text-green-600" />{{ google: "Google Calendar", outlook: "Outlook", ics: "iCal feed" }[conn.provider]} · {conn.accountEmail}</Badge>}
      </PageHeader>
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        {feed ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
            <CalendarPlus className="size-4 text-primary" />
            <span className="font-medium">Your calendar (iCal)</span>
            <span className={feed.lastSyncError ? "text-destructive" : "text-muted-foreground"}>{feed.lastSyncError ?? (feed.lastSyncedAt ? `synced ${fmtTime(feed.lastSyncedAt)}` : "syncing…")}</span>
            <div className="ml-auto"><FeedForm connected /></div>
          </div>
        ) : (
          <Card className="gap-4 p-6">
            <div className="flex items-start gap-3">
              <CalendarPlus className="mt-0.5 size-6 shrink-0 text-primary" />
              <div>
                <h2 className="font-semibold">Connect your real calendar</h2>
                <p className="mt-1 max-w-prose text-sm text-muted-foreground">No Google sign-in needed. Paste your calendar&apos;s private iCal address and your Zoom, Meet and Teams calls for the next 30 days show up here, ready to record in one click.</p>
              </div>
            </div>
            <ol className="ml-9 list-decimal space-y-1 text-sm text-muted-foreground">
              <li><b className="text-foreground">Google Calendar:</b> Settings → your calendar → Integrate calendar → <i>Secret address in iCal format</i></li>
              <li><b className="text-foreground">Outlook:</b> Settings → Calendar → Shared calendars → Publish a calendar → <i>ICS link</i></li>
              <li><b className="text-foreground">Apple iCloud:</b> Calendar → Share Calendar → Public Calendar → copy link</li>
            </ol>
            <div className="ml-9">{vaultReady() ? <FeedForm connected={false} /> : <p className="text-sm text-amber-700">This server needs PARLEY_SECRET_KEY set before it can store calendar addresses.</p>}</div>
            {!events.length && (
              <form action={connectCalendar} className="ml-9 flex items-center gap-2 border-t pt-4 text-sm text-muted-foreground">
                Just exploring? <SubmitButton size="sm" variant="outline">Load a sample calendar</SubmitButton>
              </form>
            )}
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
