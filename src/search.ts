import { sql } from "drizzle-orm";
import type { Database } from "./db";

/** Terms people use interchangeably. Each group expands to all of its members. */
export const SYNONYMS: string[][] = [
  ["sso", "single sign-on", "saml"],
  ["mfa", "2fa", "two-factor", "multi-factor"],
  ["scim", "provisioning", "deprovisioning"],
  ["pii", "phi", "personal information", "patient information"],
  ["ai", "artificial intelligence", "llm", "machine learning"],
  ["outage", "incident", "downtime"],
  ["jira", "issue tracker"],
  ["k8s", "kubernetes"],
  ["db", "database", "postgres"],
  ["pr", "pull request"],
  ["ci", "continuous integration"],
  ["ux", "user experience"],
  ["acv", "annual contract value"],
  ["nrr", "net revenue retention"],
  ["churn", "cancel", "cancellation"],
  ["eta", "timeline", "deadline"],
];

/** Driver-agnostic access to rows (Neon and PGlite both return `{ rows }`). */
const rows = <T>(r: unknown) => (r as { rows: T[] }).rows;

const lit = (v: string) => `'${v.replace(/'/g, "''")}'`;

/**
 * Rewrite rules for Postgres' ts_rewrite: each term (parsed exactly as a user's
 * query would be) is replaced by an OR of its whole group. Built once from the
 * constants above - no user input ever reaches this SQL text.
 */
const RULES = `SELECT websearch_to_tsquery('english', t), websearch_to_tsquery('english', s) FROM (VALUES ${SYNONYMS.flatMap((g) => {
  const any = g.map((t) => `"${t}"`).join(" or ");
  return g.map((t) => `(${lit(t)}, ${lit(any)})`);
}).join(", ")}) AS r(t, s)`;

export type SearchHit = {
  meetingId: string;
  title: string;
  startedAt: Date | null;
  seq: number;
  startMs: number;
  speakerName: string;
  /** Snippet as plain-text parts; `hit` marks matched terms. Render as text, never as HTML. */
  parts: { text: string; hit: boolean }[];
  rank: number;
};

// Control characters can't occur in transcript text, so they're safe match markers.
const [ON, OFF] = ["\u0002", "\u0003"];
const HEADLINE = `StartSel=${ON},StopSel=${OFF},MaxFragments=1,MinWords=6,MaxWords=20`;

const toParts = (snippet: string) =>
  snippet.split(ON).flatMap((chunk, i) => {
    const [hit, rest = ""] = i === 0 ? ["", chunk] : chunk.split(OFF);
    return [...(hit ? [{ text: hit, hit: true }] : []), ...(rest ? [{ text: rest, hit: false }] : [])];
  });

/** The tsquery a search actually runs, after synonym expansion (handy for debugging). */
export async function expandQuery(db: Database, q: string): Promise<string> {
  const r = await db.execute(sql`SELECT ts_rewrite(websearch_to_tsquery('english', ${q}), ${RULES})::text AS q`);
  return rows<{ q: string }>(r)[0]?.q ?? "";
}

/** Meetings a user recorded or attended. */
const visibleTo = (userId: string) =>
  sql`(m.owner_id = ${userId} OR EXISTS (SELECT 1 FROM meeting_participants p WHERE p.meeting_id = m.id AND p.user_id = ${userId}))`;

/** Ranked, highlighted transcript search across meetings, with synonym expansion. */
export async function searchTranscripts(db: Database, q: string, { userId, limit = 25 }: { userId?: string; limit?: number } = {}) {
  const r = await db.execute(sql`
    WITH q AS (SELECT ts_rewrite(websearch_to_tsquery('english', ${q}), ${RULES}) AS tsq)
    SELECT s.meeting_id AS "meetingId", m.title, m.started_at AS "startedAt", s.seq, s.start_ms AS "startMs",
           s.speaker_name AS "speakerName",
           ts_headline('english', s.text, q.tsq, ${HEADLINE}) AS snippet,
           ts_rank(s.search, q.tsq) AS rank
    FROM q, transcript_segments s JOIN meetings m ON m.id = s.meeting_id
    WHERE s.search @@ q.tsq ${userId ? sql`AND ${visibleTo(userId)}` : sql``}
    ORDER BY rank DESC, m.started_at DESC NULLS LAST
    LIMIT ${limit}`);
  return rows<Omit<SearchHit, "parts"> & { snippet: string }>(r).map(({ snippet, ...h }) => ({ ...h, parts: toParts(snippet) }));
}

export type EventHit = {
  id: string;
  title: string;
  startsAt: Date;
  meetingUrl: string;
  meetingId: string | null;
  attachments: { title: string }[];
  parts: SearchHit["parts"];
};

/** Calendar search over titles, agendas and attachment titles (same synonym expansion). */
export async function searchEvents(db: Database, q: string, userId: string, limit = 10) {
  const r = await db.execute(sql`
    WITH q AS (SELECT ts_rewrite(websearch_to_tsquery('english', ${q}), ${RULES}) AS tsq)
    SELECT e.id, e.title, e.starts_at AS "startsAt", e.meeting_url AS "meetingUrl", m.id AS "meetingId", e.attachments,
           ts_headline('english', concat_ws(' · ', e.agenda, (SELECT string_agg(a->>'title', ' · ') FROM jsonb_array_elements(e.attachments) a)), q.tsq, ${HEADLINE}) AS snippet
    FROM q, calendar_events e LEFT JOIN meetings m ON m.calendar_event_id = e.id
    WHERE e.user_id = ${userId} AND e.search @@ q.tsq
    ORDER BY ts_rank(e.search, q.tsq) DESC, e.starts_at DESC
    LIMIT ${limit}`);
  return rows<Omit<EventHit, "parts"> & { snippet: string }>(r).map(({ snippet, ...e }) => ({ ...e, parts: toParts(snippet) }));
}

/** Everything the search page shows for one query, scoped to a user. */
export async function searchFor(db: Database, userId: string, query: string, limit = 25) {
  const [hits, events, expanded] = await Promise.all([searchTranscripts(db, query, { userId, limit }), searchEvents(db, query, userId), expandQuery(db, query)]);
  return {
    query,
    expanded,
    events,
    meetings: new Set(hits.map((h) => h.meetingId)).size,
    hits: hits.map((h) => ({ ...h, href: `/meetings/${h.meetingId}?t=${h.startMs}#line-${h.seq}` })),
  };
}
