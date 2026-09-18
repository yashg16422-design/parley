import { PGlite } from "@electric-sql/pglite";
import { Pool } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import * as schema from "./schema";

/** Any Drizzle Postgres database carrying our schema (Neon in prod, PGlite locally and in checks). */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

type Client = { db: Database; close: () => Promise<void> };

/**
 * `postgres://...` -> Neon's WebSocket driver (interactive transactions, SKIP LOCKED).
 * `pglite:./.pglite` -> embedded file-backed Postgres, for local dev without Neon.
 */
function createDb(url: string): Client {
  if (url.startsWith("pglite:")) {
    const pg = new PGlite(url.slice("pglite:".length) || undefined);
    return { db: drizzlePglite({ client: pg, schema }), close: () => pg.close() };
  }
  const pool = new Pool({ connectionString: url });
  return { db: drizzleNeon({ client: pool, schema }), close: () => pool.end() };
}

// One client across hot reloads in dev and invocations on a warm serverless instance.
const globalForDb = globalThis as unknown as { __fathomDb?: Client };

/** Lazily connected so importing this module never throws at build time. */
export function getDb(): Database {
  if (!globalForDb.__fathomDb) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set (see .env.example)");
    globalForDb.__fathomDb = createDb(url);
  }
  return globalForDb.__fathomDb.db;
}

export async function closeDb() {
  await globalForDb.__fathomDb?.close();
  globalForDb.__fathomDb = undefined;
}

export { schema };
