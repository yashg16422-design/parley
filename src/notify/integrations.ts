import { audit } from "../audit";
import type { Database } from "../db";
import { resolveKey } from "../keys";
import { type Briefing, loadBriefing, sendMeetingBriefing } from "./slack";

/**
 * Post-meeting delivery to the owner's own tools, with their own tokens:
 * Slack (briefing), Notion (a page per meeting), HubSpot (a note on each
 * matched contact). Runs once when notes are ready; each target is independent
 * and never throws, and every attempt is recorded in the owner's audit log.
 */
type Fetch = typeof fetch;
const NOTION = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";
const HUBSPOT = "https://api.hubapi.com";
const clip = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);
const link = (id: string) => (process.env.APP_URL ? `${process.env.APP_URL.replace(/\/$/, "")}/meetings/${id}` : null);
const mins = (ms: number) => `${Math.max(1, Math.round(ms / 60_000))} min`;

// ---------------------------------------------------------------- Notion

export type NotionConfig = { token: string; databaseId: string };

/**
 * A database URL or id → the id Notion's API expects. URLs look like
 * notion.so/ws/Title-<id>?v=<viewId>: the id is the last one in the path, never the ?v view.
 */
export function notionDatabaseId(input: string) {
  const path = input.trim().split("?")[0]!;
  const ids = [...path.matchAll(/([0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12})(?![0-9a-f])/gi)];
  return ids.at(-1)?.[1]!.replace(/-/g, "").toLowerCase() ?? null;
}

const notionHeaders = (token: string) => ({ authorization: `Bearer ${token}`, "notion-version": NOTION_VERSION, "content-type": "application/json" });
const text = (content: string) => [{ type: "text", text: { content: clip(content, 1900) } }];

/** Page payload for one meeting. Pure: Notion caps rich text at 2,000 chars and a request at 100 blocks. */
export function notionPage(b: Briefing, databaseId: string, titleProp: string) {
  const total = b.talk.reduce((a, p) => a + p.talkMs, 0) || 1;
  const url = link(b.id);
  const children = [
    { object: "block", type: "callout", callout: { icon: { emoji: "📝" }, rich_text: text(`${b.startedAt ? b.startedAt.toISOString().slice(0, 10) + " · " : ""}${mins(b.durationMs)} · ${b.talk.length} participants`) } },
    ...(b.overview ? [{ object: "block", type: "heading_2", heading_2: { rich_text: text("Summary") } }, { object: "block", type: "paragraph", paragraph: { rich_text: text(b.overview) } }] : []),
    ...(b.agenda ? [{ object: "block", type: "heading_3", heading_3: { rich_text: text("Agenda") } }, { object: "block", type: "paragraph", paragraph: { rich_text: text(b.agenda) } }] : []),
    { object: "block", type: "heading_2", heading_2: { rich_text: text(`Action items (${b.actions.length})`) } },
    ...b.actions.slice(0, 60).map((a) => ({ object: "block", type: "to_do", to_do: { checked: false, rich_text: text(`${a.text}${a.owner ? ` — ${a.owner}` : ""}${a.due ? ` (due ${a.due})` : ""}`) } })),
    ...(b.talk.length ? [{ object: "block", type: "heading_3", heading_3: { rich_text: text("Talk time") } }] : []),
    ...[...b.talk].sort((x, y) => y.talkMs - x.talkMs).slice(0, 10).map((p) => ({ object: "block", type: "bulleted_list_item", bulleted_list_item: { rich_text: text(`${p.name}: ${Math.round((p.talkMs / total) * 100)}% (${mins(p.talkMs)})`) } })),
    ...(url ? [{ object: "block", type: "bookmark", bookmark: { url } }] : []),
  ].slice(0, 100);
  return { parent: { database_id: databaseId }, properties: { [titleProp]: { title: text(b.title) } }, children };
}

/** The database's title property name (every Notion database has exactly one). */
export async function notionTitleProp(cfg: NotionConfig, f: Fetch = fetch) {
  const r = await f(`${NOTION}/databases/${cfg.databaseId}`, { headers: notionHeaders(cfg.token), signal: AbortSignal.timeout(8_000) });
  if (r.status === 401) throw new Error("Notion rejected the token");
  if (r.status === 404) throw new Error("Notion can't see that database: open it in Notion → ⋯ → Connections → add your integration");
  if (!r.ok) throw new Error(`Notion returned ${r.status}`);
  const db = (await r.json()) as { properties: Record<string, { type: string }> };
  const title = Object.entries(db.properties).find(([, p]) => p.type === "title")?.[0];
  if (!title) throw new Error("that Notion page isn't a database");
  return title;
}

async function toNotion(cfg: NotionConfig, b: Briefing, f: Fetch) {
  const page = notionPage(b, cfg.databaseId, await notionTitleProp(cfg, f));
  const r = await f(`${NOTION}/pages`, { method: "POST", headers: notionHeaders(cfg.token), body: JSON.stringify(page), signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error(`Notion ${r.status}: ${(await r.text()).slice(0, 160)}`);
  return (await r.json()) as { id: string; url?: string };
}

// ---------------------------------------------------------------- HubSpot

const hubHeaders = (token: string) => ({ authorization: `Bearer ${token}`, "content-type": "application/json" });
const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Note body (HubSpot renders basic HTML). Pure. */
export function hubspotNoteHtml(b: Briefing) {
  const url = link(b.id);
  return [
    `<p><strong>${esc(b.title)}</strong> · ${mins(b.durationMs)}</p>`,
    b.overview ? `<p>${esc(clip(b.overview, 2000))}</p>` : "",
    b.actions.length ? `<p><strong>Action items</strong></p><ul>${b.actions.slice(0, 25).map((a) => `<li>${esc(a.text)}${a.owner ? ` — ${esc(a.owner)}` : ""}${a.due ? ` (due ${esc(a.due)})` : ""}</li>`).join("")}</ul>` : "",
    url ? `<p><a href="${esc(url)}">Open the full notes in Parley</a></p>` : "",
  ].join("");
}

export async function hubspotCheck(token: string, f: Fetch = fetch) {
  const r = await f(`${HUBSPOT}/crm/v3/objects/contacts?limit=1`, { headers: hubHeaders(token), signal: AbortSignal.timeout(8_000) });
  if (r.status === 401) throw new Error("HubSpot rejected the token");
  if (r.status === 403) throw new Error("the HubSpot app needs the crm.objects.contacts.read and write scopes");
  if (!r.ok) throw new Error(`HubSpot returned ${r.status}`);
}

async function toHubspot(token: string, b: Briefing, f: Fetch) {
  if (!b.emails.length) return { contacts: 0 };
  const search = await f(`${HUBSPOT}/crm/v3/objects/contacts/search`, {
    method: "POST", headers: hubHeaders(token), signal: AbortSignal.timeout(10_000),
    body: JSON.stringify({ filterGroups: [{ filters: [{ propertyName: "email", operator: "IN", values: b.emails.slice(0, 50) }] }], properties: ["email"], limit: 50 }),
  });
  if (!search.ok) throw new Error(`HubSpot search ${search.status}`);
  const ids = ((await search.json()) as { results: { id: string }[] }).results.map((c) => c.id);
  if (!ids.length) return { contacts: 0 };
  const note = await f(`${HUBSPOT}/crm/v3/objects/notes`, {
    method: "POST", headers: hubHeaders(token), signal: AbortSignal.timeout(10_000),
    body: JSON.stringify({
      properties: { hs_timestamp: (b.startedAt ?? new Date()).toISOString(), hs_note_body: hubspotNoteHtml(b) },
      // 202 = HubSpot-defined note → contact association.
      associations: ids.map((id) => ({ to: { id }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 202 }] })),
    }),
  });
  if (!note.ok) throw new Error(`HubSpot note ${note.status}: ${(await note.text()).slice(0, 160)}`);
  return { contacts: ids.length };
}

// ---------------------------------------------------------------- fan-out

export async function deliverMeeting(db: Database, meetingId: string, f: Fetch = fetch) {
  const b = await loadBriefing(db, meetingId);
  if (!b) return {};
  const [notionKey, hubKey] = await Promise.all([resolveKey(db, b.ownerId, "notion"), resolveKey(db, b.ownerId, "hubspot")]);
  const attempt = async (name: string, run: () => Promise<unknown>) => {
    try {
      const out = await run();
      await audit(db, b.ownerId, `delivered.${name}`, meetingId, out as Record<string, unknown>);
      return { ok: true as const, out };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      console.error(`deliver ${name} ${meetingId}: ${error}`);
      await audit(db, b.ownerId, `delivery_failed.${name}`, meetingId, { error });
      return { ok: false as const, error };
    }
  };
  const [slack, notion, hubspot] = await Promise.all([
    sendMeetingBriefing(db, meetingId, f, b),
    notionKey ? attempt("notion", () => toNotion(JSON.parse(notionKey.key) as NotionConfig, b, f)) : null,
    hubKey ? attempt("hubspot", () => toHubspot(hubKey.key, b, f)) : null,
  ]);
  return { slack, notion, hubspot };
}
