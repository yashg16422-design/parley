import Link from "next/link";
import { Radio } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { duration } from "@/lib/format";
import { seededMeetings } from "@/queries";

export default async function LivePicker() {
  const meetings = (await seededMeetings()).filter((m) => !m.simulatedFromId);
  return (
    <>
      <PageHeader title="Start a live call" subtitle="Replay a recorded meeting as if it were happening now. The transcript streams in, AI notes are built window by window." />
      <div className="grid gap-3 p-6 sm:grid-cols-2 xl:grid-cols-3">
        {meetings.map((m) => (
          <Card key={m.id} className="gap-3 p-4">
            <div className="font-medium">{m.title}</div>
            <div className="text-xs text-muted-foreground">{duration(m.durationMs)}</div>
            <div className="mt-auto flex gap-2">
              {[15, 60].map((sp) => (
                <Link key={sp} href={`/live/${m.id}?speed=${sp}`} className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:border-primary hover:text-primary">
                  <Radio className="size-3.5" />Replay at {sp}x
                </Link>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
