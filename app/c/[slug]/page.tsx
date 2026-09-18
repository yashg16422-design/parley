import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { Waves } from "lucide-react";
import { ClipPlayer } from "@/components/clip-player";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { clock, fmtDay } from "@/lib/format";
import { clipBySlug } from "@/queries";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await clipBySlug((await params).slug);
  return { title: data ? `${data.clip.title} · Parley clip` : "Clip not found" };
}

/** Public, no-login clip page. */
export default async function ClipPage({ params }: Props) {
  const data = await clipBySlug((await params).slug);
  if (!data) notFound();
  const { clip, segments } = data;
  await getDb().update(s.clips).set({ viewCount: sql`${s.clips.viewCount} + 1` }).where(eq(s.clips.id, clip.id));
  return (
    <div className="min-h-dvh bg-muted/30">
      <header className="flex items-center gap-2 border-b bg-background px-6 py-3 text-sm font-semibold">
        <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground"><Waves className="size-3.5" /></span>Parley
        <Link href="/" className="ml-auto text-xs font-normal text-primary hover:underline">Record your own meetings</Link>
      </header>
      <main className="mx-auto max-w-3xl space-y-4 p-6">
        <div>
          <h1 className="text-xl font-semibold">{clip.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">From “{clip.meeting.title}”{clip.meeting.startedAt && ` · ${fmtDay(clip.meeting.startedAt)}`} · {clock(clip.endMs - clip.startMs)} · shared by {clip.author?.name ?? "a teammate"}</p>
        </div>
        <ClipPlayer participants={clip.meeting.participants} segments={segments} startMs={clip.startMs} endMs={clip.endMs} />
      </main>
    </div>
  );
}
