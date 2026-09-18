/**
 * npm run db:seed [-- --dry-run] [-- --dir <fixtures dir>]
 *
 * Validates every fixture under seed/fixtures/, then wipes and reloads the
 * database in a single transaction. --dry-run validates without touching the db.
 */
import { config } from "dotenv";
import path from "node:path";
import { parseArgs } from "node:util";

config({ path: [".env.local", ".env"], quiet: true });

const { values } = parseArgs({
  options: {
    "dry-run": { type: "boolean", default: false },
    dir: { type: "string", default: "seed/fixtures" },
  },
});

async function main() {
  const { loadFixtures } = await import("./fixtures");
  const { seed, buildRows, countRows } = await import("./seed");

  const dir = path.resolve(values.dir!);
  const { dataset, files } = await loadFixtures(dir);
  if (files.length === 0) {
    console.error(`No fixture files found in ${path.relative(process.cwd(), dir)}/ - nothing to seed.`);
    process.exit(1);
  }
  console.log(`Loaded ${files.length} fixture file(s): ${dataset.meetings.length} meetings, ${dataset.calendarEvents.length} calendar events`);

  if (values["dry-run"]) {
    console.table(countRows(buildRows(dataset)));
    console.log("Dry run: fixtures are valid; rows above would be inserted. Database untouched.");
    return;
  }

  const { getDb, closeDb } = await import("../index");
  const started = performance.now();
  try {
    const counts = await seed(getDb(), dataset);
    console.table(counts);
    console.log(`Seeded in ${((performance.now() - started) / 1000).toFixed(1)}s`);
  } finally {
    await closeDb();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
