import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

if (url.startsWith("pglite:")) {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const pg = new PGlite(url.slice("pglite:".length));
  await migrate(drizzle({ client: pg }), { migrationsFolder: "drizzle" });
  await pg.close();
} else {
  const { Pool } = await import("@neondatabase/serverless");
  const { drizzle } = await import("drizzle-orm/neon-serverless");
  const { migrate } = await import("drizzle-orm/neon-serverless/migrator");
  const pool = new Pool({ connectionString: url });
  await migrate(drizzle({ client: pool }), { migrationsFolder: "drizzle" });
  await pool.end();
}
console.log("migrations applied");
