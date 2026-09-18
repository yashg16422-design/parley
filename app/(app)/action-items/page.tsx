import Link from "next/link";
import { ActionItems } from "@/components/meeting/side-lists";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { relativeDay } from "@/lib/format";
import { currentUser, openActionItems } from "@/queries";

export default async function ActionItemsPage() {
  const me = await currentUser();
  const items = await openActionItems(me.id);
  const byMeeting = Map.groupBy(items, (a) => a.meeting.id);
  const open = items.filter((a) => a.status === "open").length;
  return (
    <>
      <PageHeader title="Action items" subtitle={`${open} open across ${byMeeting.size} meetings. Every item links back to the moment it was said.`} />
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        {[...byMeeting.values()].map((list) => {
          const m = list[0]!.meeting;
          return (
            <Card key={m.id} className="gap-2 p-4">
              <Link href={`/meetings/${m.id}`} className="flex items-baseline justify-between gap-2 hover:text-primary">
                <span className="font-medium">{m.title}</span>
                <span className="text-xs text-muted-foreground">{m.startedAt && relativeDay(m.startedAt)}</span>
              </Link>
              <ActionItems items={list} meetingId={m.id} />
            </Card>
          );
        })}
      </div>
    </>
  );
}
