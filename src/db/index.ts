import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

/**
 * Any Drizzle Postgres database carrying our schema. Neon in the app, PGlite in
 * the local schema check - code that takes a db (seed, jobs) accepts either.
 */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

/**
 * Neon's WebSocket driver (not neon-http) because we need interactive
 * transactions: the seed runs in one, and job claiming uses
 * SELECT ... FOR UPDATE SKIP LOCKED. Node >= 22 ships a global WebSocket, so no
 * `ws` polyfill is needed.
 */
function createDb(url: string) {
  const pool = new Pool({ connectionString: url });
  return { pool, db: drizzle({ client: pool, schema }) };
}

type Client = ReturnType<typeof createDb>;

// Reuse one pool across hot reloads in dev and across invocations on a warm
// serverless instance.
const globalForDb = globalThis as unknown as { __fathomDb?: Client };

/** Lazily connected so importing this module never throws at build time. */
export function getDb(): Client["db"] {
  if (!globalForDb.__fathomDb) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set (see .env.example)");
    globalForDb.__fathomDb = createDb(url);
  }
  return globalForDb.__fathomDb.db;
}

export async function closeDb() {
  await globalForDb.__fathomDb?.pool.end();
  globalForDb.__fathomDb = undefined;
}

export { schema };
