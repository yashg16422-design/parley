import { notFound } from "next/navigation";
import { LiveCall } from "@/components/live/live-call";
import { meetingDetail } from "@/queries";

export default async function LivePage({ params, searchParams }: { params: Promise<{ sourceId: string }>; searchParams: Promise<{ speed?: string }> }) {
  const [{ sourceId }, { speed }] = await Promise.all([params, searchParams]);
  const m = /^[0-9a-f-]{36}$/.test(sourceId) ? await meetingDetail(sourceId) : null;
  if (!m) notFound();
  return <LiveCall source={{ id: m.id, title: m.title }} participants={m.participants} segments={m.segments} initialSpeed={Math.min(60, Math.max(1, Number(speed) || 15))} />;
}
