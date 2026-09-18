"use server";

import { z } from "zod";
import { getDb } from "@/db";
import { searchFor } from "@/search";
import { currentUser } from "@/session";

const input = z.object({ query: z.string().trim().min(1).max(200), limit: z.int().min(1).max(100).default(25) });

export type SearchResult = ({ ok: true } & Awaited<ReturnType<typeof searchFor>>) | { ok: false; error: string };

/** Synonym-aware search over the current workspace's transcripts, agendas and attachments. */
export async function searchAction(raw: z.input<typeof input>): Promise<SearchResult> {
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid query" };
  const me = await currentUser();
  return { ok: true, ...(await searchFor(getDb(), me.id, parsed.data.query, parsed.data.limit)) };
}
