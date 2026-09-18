import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { fmtDay, fmtTime } from "@/lib/format";
import { currentUser, eventAttachment } from "@/queries";

export default async function AttachmentPage({ params }: { params: Promise<{ eventId: string; idx: string }> }) {
  const { eventId, idx } = await params;
  const me = await currentUser();
  const found = /^[0-9a-f-]{36}$/.test(eventId) ? await eventAttachment(eventId, Number(idx), me.id) : null;
  if (!found?.attachment.body) notFound();
  const { event, attachment } = found;
  return (
    <>
      <PageHeader title={attachment.title} subtitle={`Attached to “${event.title}” · ${fmtDay(event.startsAt)}, ${fmtTime(event.startsAt)}`}>
        <Link href="/calendar" className="text-sm text-primary hover:underline">Back to calendar</Link>
      </PageHeader>
      <div className="mx-auto max-w-2xl p-6">
        <Card className="gap-3 p-6">
          <FileText className="size-5 text-primary" />
          <div className="whitespace-pre-line text-sm leading-relaxed">{attachment.body}</div>
        </Card>
      </div>
    </>
  );
}
