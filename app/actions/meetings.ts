"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import * as s from "@/db/schema";
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

export async function createClip(raw: z.input<typeof clipInput>) {
  const c = clipInput.parse(raw);
  const me = await currentUser();
  const slug = `${c.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "clip"}-${crypto.randomUUID().slice(0, 6)}`;
  await getDb().insert(s.clips).values({ ...c, slug, createdBy: me.id });
  revalidatePath(`/meetings/${c.meetingId}`);
  return slug;
}

export async function setRecording(eventId: string, enabled: boolean) {
  await getDb().update(s.calendarEvents).set({ recordEnabled: enabled }).where(eq(s.calendarEvents.id, z.uuid().parse(eventId)));
  revalidatePath("/", "layout");
}
