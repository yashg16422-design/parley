import { MicCall } from "@/components/live/mic-call";
import { findMeetingLink } from "@/lib/meeting-links";
import { calendarEvent, currentUser } from "@/queries";

export default async function MicPage({ searchParams }: { searchParams: Promise<{ eventId?: string; join?: string }> }) {
  const { eventId, join } = await searchParams;
  const me = await currentUser();
  const e = eventId && /^[0-9a-f-]{36}$/.test(eventId) ? await calendarEvent(eventId, me.id) : undefined;
  const others = e?.attendees.map((a) => a.name).filter((n) => n !== me.name) ?? [];
  return (
    <MicCall
      me={me.name}
      fromLink={join === "1" && !e}
      eventLink={e ? findMeetingLink(e.meetingUrl) : null}
      event={e ? { id: e.id, title: e.title, agenda: e.agenda, attachments: e.attachments } : null}
      defaultSpeakers={[me.name, ...(others.length ? others : ["Guest"])].slice(0, 8)}
    />
  );
}
