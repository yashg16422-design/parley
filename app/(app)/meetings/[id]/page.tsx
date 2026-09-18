import { notFound } from "next/navigation";
import { MeetingView } from "@/components/meeting/meeting-view";
import { currentUser, meetingDetail } from "@/queries";

export default async function MeetingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string }> }) {
  const [{ id }, { t }] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const me = await currentUser();
  const m = await meetingDetail(id, me.id);
  if (!m) notFound();
  return (
    <MeetingView
      id={m.id} title={m.title} startedAt={m.startedAt} durationMs={m.durationMs} defaultTemplateId={m.defaultTemplateId}
      participants={m.participants} segments={m.segments} highlights={m.highlights} clips={m.clips} templates={m.templates}
      actionItems={m.actionItems}
      event={m.calendarEvent}
      chapters={m.knowledge?.knowledge.topics.map(({ title, startMs, endMs }) => ({ title, startMs, endMs })) ?? []}
      initialMs={Math.max(0, Number(t) || 0)}
    />
  );
}
