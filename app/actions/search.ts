"use server";

import { z } from "zod";
import { getDb } from "@/db";
import { expandQuery, type SearchHit, searchTranscripts } from "@/search";

const input = z.object({
  query: z.string().trim().min(1).max(200),
  ownerId: z.uuid().optional(),
  limit: z.int().min(1).max(100).default(25),
});

export type SearchCitation = SearchHit & { href: string };
export type SearchResult =
  | { ok: true; query: string; expanded: string; meetings: number; hits: SearchCitation[] }
  | { ok: false; error: string };

/** Synonym-aware transcript search; every hit is a citation to a transcript line. */
export async function searchAction(raw: z.input<typeof input>): Promise<SearchResult> {
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid query" };
  const { query, ownerId, limit } = parsed.data;
  const db = getDb();
  const [hits, expanded] = await Promise.all([searchTranscripts(db, query, { ownerId, limit }), expandQuery(db, query)]);
  return {
    ok: true,
    query,
    expanded,
    meetings: new Set(hits.map((h) => h.meetingId)).size,
    hits: hits.map((h) => ({ ...h, href: `/meetings/${h.meetingId}?t=${h.startMs}#line-${h.seq}` })),
  };
}
