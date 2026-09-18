import Link from "next/link";
import { Mic, Radio } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { duration } from "@/lib/format";
import { sampleMeetings } from "@/queries";

export default async function LivePicker() {
  const samples = await sampleMeetings();
  return (
    <>
      <PageHeader title="Record a meeting" subtitle="Record a real conversation from your microphone, or replay a sample call as if it were happening now." />
      <div className="space-y-6 p-6">
        <Card className="flex-row flex-wrap items-center gap-4 border-primary/30 bg-primary/5 p-5">
          <span className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground"><Mic className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <div className="font-medium">Record live microphone</div>
            <p className="text-sm text-muted-foreground">Live transcription in your browser; notes, action items and search when you hang up.</p>
          </div>
          <Button asChild><Link href="/live/mic"><Mic />Start recording</Link></Button>
        </Card>
        <div>
          <h2 className="mb-2 text-sm font-semibold">Sample calls to replay</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {samples.map((m) => (
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
        </div>
      </div>
    </>
  );
}
