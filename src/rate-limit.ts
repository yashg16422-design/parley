import { sql } from "drizzle-orm";
import type { Database } from "./db";

const rows = <T>(r: unknown) => (r as { rows: T[] }).rows;

/**
 * Sliding-window limit in one atomic statement: the upsert only fires while
 * fewer than `limit` hits fall inside the window, pruning older ones as it
 * goes. Concurrent callers serialise on the row lock, so the count can't be
 * raced past the limit.
 */
export async function takeToken(db: Database, key: string, limit: number, windowMs: number) {
  const win = sql`make_interval(secs => ${windowMs / 1000})`;
  const ok = rows<{ n: number }>(await db.execute(sql`
    INSERT INTO rate_limits AS r (key, hits) VALUES (${key}, ARRAY[now()])
    ON CONFLICT (key) DO UPDATE
      SET hits = ARRAY(SELECT h FROM unnest(r.hits) h WHERE h > now() - ${win}) || now()
      WHERE (SELECT count(*) FROM unnest(r.hits) h WHERE h > now() - ${win}) < ${limit}
    RETURNING cardinality(hits) AS n`));
  if (ok.length) return { ok: true as const, remaining: limit - Number(ok[0]!.n) };
  const [w] = rows<{ s: number }>(await db.execute(sql`
    SELECT ceil(extract(epoch FROM min(h) + ${win} - now()))::int AS s FROM rate_limits, unnest(hits) h
    WHERE key = ${key} AND h > now() - ${win}`));
  return { ok: false as const, retryAfterSec: Math.max(1, Number(w?.s ?? 1)) };
}

/** Client address for per-IP buckets (Vercel sets x-forwarded-for; the first entry is the client). */
export const clientIp = (h: Headers) => h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
