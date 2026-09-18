"use server";

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { stableId } from "@/lib/stable-id";
import { currentUser, setSession, UID_COOKIE } from "@/session";

const DEMO_EMAIL = process.env.DEMO_USER_EMAIL ?? "maya@driftwood.example";

export async function enterDemo() {
  const maya = await getDb().query.users.findFirst({ where: eq(s.users.email, DEMO_EMAIL) });
  if (!maya) throw new Error("Demo data missing: run npm run db:seed");
  await setSession(maya.id);
  redirect("/home");
}

/** A brand-new, empty workspace user for testing from scratch. */
export async function startFresh(form: FormData) {
  const name = String(form.get("name") ?? "").trim().slice(0, 60) || "You";
  const id = crypto.randomUUID();
  await getDb().insert(s.users).values({ id, name, email: `guest-${id.slice(0, 8)}@guest.parley.example`, title: "Guest workspace" });
  await setSession(id);
  redirect("/home");
}

export async function leaveWorkspace() {
  (await cookies()).delete(UID_COOKIE);
  redirect("/");
}

/** Simulated Google Calendar connection: a connection row plus a few upcoming meetings to record. */
export async function connectCalendar() {
  const me = await currentUser();
  const db = getDb();
  const day = (d: number, h: number) => new Date(new Date().setHours(h, 0, 0, 0) + d * 86_400_000);
  const [conn] = await db
    .insert(s.calendarConnections)
    .values({ userId: me.id, provider: "google", accountEmail: me.email, lastSyncedAt: new Date() })
    .onConflictDoNothing()
    .returning({ id: s.calendarConnections.id });
  if (!conn) return;
  const events = [
    { title: "Weekly team sync", d: 0, h: 16, agenda: "1. Wins from last week\n2. Blockers\n3. Priorities for this week", url: "https://meet.google.com/", platform: "google_meet" as const },
    { title: "Customer call: onboarding feedback", d: 1, h: 11, agenda: "Walk through their first month, what's working, what's confusing, next steps.", url: "https://zoom.us/", platform: "zoom" as const },
    { title: "1:1 with your manager", d: 2, h: 15, agenda: "Progress on goals, feedback both ways, growth.", url: "https://teams.microsoft.com/", platform: "teams" as const },
  ];
  await db.insert(s.calendarEvents).values(
    events.map((e, i) => ({
      userId: me.id, connectionId: conn.id, externalId: `gcal_${stableId(`${me.id}:${i}`).slice(0, 12)}`,
      title: e.title, startsAt: day(e.d, e.h), endsAt: day(e.d, e.h + 1), platform: e.platform, meetingUrl: e.url, agenda: e.agenda,
      attendees: [{ name: me.name, email: me.email, responseStatus: "accepted" as const, isOrganizer: true }],
      attachments: [{ title: `${e.title}: notes template`, kind: "doc" as const, url: "", body: `${e.agenda}\n\nNotes:\n- ` }],
    })),
  );
  revalidatePath("/", "layout");
}
