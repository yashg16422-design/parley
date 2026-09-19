import { asc, eq } from "drizzle-orm";
import type { Database } from "../db";
import * as s from "../db/schema";
import { resolveKey } from "../keys";

/**
 * Post-meeting Slack briefing via an incoming webhook (SLACK_WEBHOOK_URL).
 * Sent once, when a meeting's notes are ready (the moment the after() processor
 * finishes the final job). Optional: without the env var nothing is sent.
 */
export function slackWebhook(raw = process.env.SLACK_WEBHOOK_URL) {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    // Only Slack's webhook hosts: a misconfigured URL must not turn into a data leak.
    return u.protocol === "https:" && /^hooks\.slack(-gov)?\.com$/.test(u.hostname) ? u.href : null;
  } catch {
    return null;
  }
}

export type Briefing = {
  id: string; title: string; startedAt: Date | null; durationMs: number; platform: string;
  overview: string | null; agenda: string | null;
  talk: { name: string; talkMs: number }[];
  actions: { text: string; owner: string | null; due: string | null; verified: boolean }[];
  ownerId: string;
  /** Only the shared demo workspace may use the server's SLACK_WEBHOOK_URL. */
  ownerKind?: "demo" | "guest" | "account";
  /** Other attendees' emails (participants + calendar invitees), for CRM matching. */
  emails: string[];
};

const PLATFORM: Record<string, string> = { zoom: "Zoom", google_meet: "Google Meet", teams: "Microsoft Teams" };
const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const clip = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t);
const mins = (ms: number) => (ms < 60_000 ? `${Math.max(1, Math.round(ms / 1000))}s` : `${Math.round(ms / 60_000)}m`);
const bar = (share: number) => "█".repeat(Math.round(share * 10)).padEnd(10, "░");

/** Block Kit payload. Pure, so it's testable and previewable in Slack's Block Kit Builder. */
export function briefingBlocks(b: Briefing, appUrl = process.env.APP_URL) {
  const total = b.talk.reduce((a, p) => a + p.talkMs, 0) || 1;
  const when = b.startedAt ? b.startedAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC" : "";
  const summary = [b.overview && esc(clip(b.overview, 1200)), b.agenda && `*Agenda:* ${esc(clip(b.agenda.replace(/\s*\n+\s*/g, " · "), 500))}`].filter(Boolean).join("\n\n");
  const talk = [...b.talk].sort((x, y) => y.talkMs - x.talkMs).slice(0, 8)
    .map((p) => `\`${bar(p.talkMs / total)}\` ${Math.round((p.talkMs / total) * 100)}%  ${esc(p.name)} · ${mins(p.talkMs)}`).join("\n");
  const shown = b.actions.slice(0, 15);
  const items = shown.map((a) => `• ${esc(clip(a.text, 220))}${a.owner ? ` — *${esc(a.owner)}*` : " — _unassigned_"}${a.due ? ` · due ${esc(a.due)}` : ""}${a.verified ? "" : " _(check source)_"}`);
  if (b.actions.length > shown.length) items.push(`_…and ${b.actions.length - shown.length} more in Parley_`);

  // Section text is capped at 3,000 chars: split the action list across sections.
  const itemSections: string[] = [];
  for (const line of items) {
    if (!itemSections.length || itemSections.at(-1)!.length + line.length > 2_800) itemSections.push(line);
    else itemSections[itemSections.length - 1] += `\n${line}`;
  }
  const link = appUrl ? `${appUrl.replace(/\/$/, "")}/meetings/${b.id}` : null;
  const blocks = [
    { type: "header", text: { type: "plain_text", text: clip(`📝 ${b.title}`, 150), emoji: true } },
    { type: "context", elements: [{ type: "mrkdwn", text: [when, mins(b.durationMs), PLATFORM[b.platform] ?? b.platform, `${b.talk.length} participant${b.talk.length === 1 ? "" : "s"}`].filter(Boolean).join("  ·  ") }] },
    ...(summary ? [{ type: "section", text: { type: "mrkdwn", text: summary } }] : []),
    ...(talk ? [{ type: "section", text: { type: "mrkdwn", text: `*Talk time*\n${talk}` } }] : []),
    { type: "divider" },
    { type: "section", text: { type: "mrkdwn", text: `*Action items (${b.actions.length})*${items.length ? "" : "\nNo commitments were captured."}` } },
    ...itemSections.map((text) => ({ type: "section", text: { type: "mrkdwn", text } })),
    ...(link ? [{ type: "actions", elements: [{ type: "button", style: "primary", text: { type: "plain_text", text: "Open notes in Parley" }, url: link }] }] : []),
  ];
  return { text: `Meeting notes: ${b.title} (${b.actions.length} action items)`, blocks };
}

export async function loadBriefing(db: Database, meetingId: string): Promise<Briefing | null> {
  const m = await db.query.meetings.findFirst({
    where: eq(s.meetings.id, meetingId),
    with: {
      participants: { columns: { name: true, talkMs: true, email: true }, orderBy: asc(s.meetingParticipants.speakerIdx) },
      owner: { columns: { email: true, kind: true } },
      actionItems: { orderBy: asc(s.actionItems.sortOrder), with: { assignee: { columns: { name: true } } } },
      knowledge: { columns: { knowledge: true } },
      calendarEvent: { columns: { agenda: true, attendees: true } },
    },
  });
  if (!m) return null;
  return {
    id: m.id, title: m.title, startedAt: m.startedAt, durationMs: m.durationMs, platform: m.platform,
    overview: m.knowledge?.knowledge.overview ?? null, agenda: m.calendarEvent?.agenda ?? null,
    talk: m.participants.filter((p) => p.talkMs > 0).map((p) => ({ name: p.name, talkMs: p.talkMs })),
    actions: m.actionItems.map((a) => ({ text: a.text, owner: a.assignee?.name ?? a.assigneeName, due: a.dueText, verified: a.verified })),
    ownerId: m.ownerId, ownerKind: m.owner?.kind,
    emails: [...new Set([...m.participants.map((p) => p.email), ...(m.calendarEvent?.attendees ?? []).map((a) => a.email)]
      .filter((e): e is string => !!e).map((e) => e.toLowerCase()).filter((e) => e !== m.owner?.email?.toLowerCase()))],
  };
}

/** Send the briefing if a webhook is configured. Never throws: a Slack outage mustn't fail note processing. */
export async function sendMeetingBriefing(db: Database, meetingId: string, fetcher: typeof fetch = fetch, preloaded?: Briefing | null) {
  try {
    const b = preloaded ?? (await loadBriefing(db, meetingId));
    if (!b) return { sent: false as const, reason: "meeting not found" };
    // The owner's own webhook (Settings) wins. The server's SLACK_WEBHOOK_URL is the operator's
    // channel, so only the shared demo posts there: a visitor's meeting must never land in it.
    const hook = await resolveKey(db, b.ownerId, "slack");
    const url = hook && (hook.source === "tenant" || b.ownerKind === "demo") ? slackWebhook(hook.key) : null;
    if (!url) return { sent: false as const, reason: "no Slack webhook" };
    const r = await fetcher(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(briefingBlocks(b)), signal: AbortSignal.timeout(8_000) });
    if (!r.ok) throw new Error(`Slack ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return { sent: true as const };
  } catch (e) {
    console.error(`slack briefing ${meetingId}:`, e instanceof Error ? e.message : e);
    return { sent: false as const, reason: "delivery failed" };
  }
}
