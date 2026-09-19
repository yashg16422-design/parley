"use server";

import { and, eq, exists, inArray, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { checkClipRange, muxClipAssetRequest, muxClipPlaybackUrl } from "@/media";
import { currentUser } from "@/queries";

const visible = (userId: string) =>
  or(eq(s.meetings.ownerId, userId), exists(getDb().select().from(s.meetingParticipants).where(and(eq(s.meetingParticipants.meetingId, s.meetings.id), eq(s.meetingParticipants.userId, userId)))));

export async function toggleActionItem(id: string, done: boolean) {
  const me = await currentUser();
  const mine = getDb().select({ id: s.meetings.id }).from(s.meetings).where(visible(me.id));
  await getDb().update(s.actionItems).set({ status: done ? "done" : "open", completedAt: done ? new Date() : null }).where(and(eq(s.actionItems.id, z.uuid().parse(id)), inArray(s.actionItems.meetingId, mine)));
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
    where: and(eq(s.meetings.id, c.meetingId), visible(me.id)),
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
  const me = await currentUser();
  await getDb().update(s.calendarEvents).set({ recordEnabled: enabled }).where(and(eq(s.calendarEvents.id, z.uuid().parse(eventId)), eq(s.calendarEvents.userId, me.id)));
  revalidatePath("/", "layout");
}
