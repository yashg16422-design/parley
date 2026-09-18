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

/** Ranked, highlighted transcript search across meetings, with synonym expansion. */
export async function searchTranscripts(db: Database, q: string, { ownerId, limit = 25 }: { ownerId?: string; limit?: number } = {}) {
  const r = await db.execute(sql`
    WITH q AS (SELECT ts_rewrite(websearch_to_tsquery('english', ${q}), ${RULES}) AS tsq)
    SELECT s.meeting_id AS "meetingId", m.title, m.started_at AS "startedAt", s.seq, s.start_ms AS "startMs",
           s.speaker_name AS "speakerName",
           ts_headline('english', s.text, q.tsq, ${HEADLINE}) AS snippet,
           ts_rank(s.search, q.tsq) AS rank
    FROM q, transcript_segments s JOIN meetings m ON m.id = s.meeting_id
    WHERE s.search @@ q.tsq ${ownerId ? sql`AND m.owner_id = ${ownerId}` : sql``}
    ORDER BY rank DESC, m.started_at DESC NULLS LAST
    LIMIT ${limit}`);
  return rows<Omit<SearchHit, "parts"> & { snippet: string }>(r).map(({ snippet, ...h }) => ({ ...h, parts: toParts(snippet) }));
}
