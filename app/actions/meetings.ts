"use server";

import { and, eq, or, exists } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { checkClipRange, muxClipAssetRequest, muxClipPlaybackUrl } from "@/media";
import { currentUser } from "@/queries";

export async function toggleActionItem(id: string, done: boolean) {
  await getDb().update(s.actionItems).set({ status: done ? "done" : "open", completedAt: done ? new Date() : null }).where(eq(s.actionItems.id, z.uuid().parse(id)));
  revalidatePath("/", "layout");
}

export async function addHighlight(meetingId: string, atMs: number, label?: string) {
  const me = await currentUser();
  const [h] = await getDb()
    .insert(s.highlights)
    .values({ meetingId: z.uuid().parse(meetingId), atMs: z.int().min(0).parse(Math.round(atMs)), label: label?.slice(0, 120) || null, createdBy: me.id })
    .returning();
  return h!;
}

const clipInput = z.object({ meetingId: z.uuid(), startMs: z.int().min(0), endMs: z.int().positive(), title: z.string().trim().min(1).max(120) }).refine((c) => c.endMs > c.startMs);

/** Stores the exact ms range (the whole clip, as far as Mux is concerned) and returns the provider contract for it. */
export async function createClip(raw: z.input<typeof clipInput>) {
  const c = clipInput.parse(raw);
  const me = await currentUser();
  const db = getDb();
  const m = await db.query.meetings.findFirst({
    where: and(eq(s.meetings.id, c.meetingId), or(eq(s.meetings.ownerId, me.id), exists(db.select().from(s.meetingParticipants).where(and(eq(s.meetingParticipants.meetingId, s.meetings.id), eq(s.meetingParticipants.userId, me.id)))))),
    columns: { durationMs: true, mediaProvider: true, mediaAssetId: true, mediaPlaybackId: true },
  });
  if (!m) throw new Error("meeting not found");
  const bad = checkClipRange(c, m.durationMs);
  if (bad) throw new Error(bad);
  const slug = `${c.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "clip"}-${crypto.randomUUID().slice(0, 6)}`;
  await db.insert(s.clips).values({ ...c, slug, createdBy: me.id });
  revalidatePath(`/meetings/${c.meetingId}`);
  return { slug, startMs: c.startMs, endMs: c.endMs, muxAsset: muxClipAssetRequest(m, c), playbackUrl: muxClipPlaybackUrl(m, c) };
}

export async function setRecording(eventId: string, enabled: boolean) {
  await getDb().update(s.calendarEvents).set({ recordEnabled: enabled }).where(eq(s.calendarEvents.id, z.uuid().parse(eventId)));
  revalidatePath("/", "layout");
}
