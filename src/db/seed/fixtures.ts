/**
 * Fixture format for `npm run db:seed`.
 *
 * Every *.json under seed/fixtures/ (recursively) is a partial dataset; files
 * are merged by concatenating arrays. Convention: seed/fixtures/workspace.json
 * holds users/calendar/templates, and each meeting lives in its own file under
 * seed/fixtures/meetings/ (the 8-person hour-long call alone is ~1,500 lines).
 *
 * Fixtures reference each other by human keys (emails, event keys, speaker
 * index), never by database ids - ids are derived deterministically at seed time.
 *
 * Times are *relative to the day the seed runs* ("D-3@14:30" = three days ago at
 * 14:30 UTC) so "upcoming" events stay upcoming no matter when we deploy.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  attendeeSchema,
  chunkNotesSchema,
  meetingKnowledgeSchema,
  summaryContentSchema,
  templateSectionSchema,
} from "../json-types";

const RELATIVE_TIME = /^D([+-]\d+)@([01]\d|2[0-3]):([0-5]\d)$/;

export const relativeTime = z.string().regex(RELATIVE_TIME, 'expected "D<+/-days>@HH:MM", e.g. "D-3@14:30"');

const RELATIVE_DAY = /^D([+-]\d+)$/;
/** A calendar date: absolute ISO ("2026-10-02") or relative to the seed day ("D+3"). */
export const dateOrRelative = z.union([z.iso.date(), z.string().regex(RELATIVE_DAY, 'expected "D<+/-days>"')]);

export function resolveDate(value: string, now: Date): string {
  const m = RELATIVE_DAY.exec(value);
  if (!m) return value;
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + Number(m[1])));
  return d.toISOString().slice(0, 10);
}

/** Resolve "D-3@14:30" against the seed run's current UTC date. */
export function resolveRelativeTime(value: string, now: Date): Date {
  const m = RELATIVE_TIME.exec(value);
  if (!m) throw new Error(`Bad relative time: ${value}`);
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + Number(m[1]));
  d.setUTCHours(Number(m[2]), Number(m[3]), 0, 0);
  return d;
}

const platform = z.enum(["zoom", "google_meet", "teams"]);

const userFixture = z.object({
  email: z.email(),
  name: z.string(),
  title: z.string().optional(),
  avatarUrl: z.string().optional(),
  timezone: z.string().optional(),
});

const connectionFixture = z.object({
  userEmail: z.email(),
  provider: z.enum(["google", "outlook"]).default("google"),
  accountEmail: z.email(),
  autoRecord: z.enum(["all", "external", "none"]).default("all"),
});

const calendarEventFixture = z.object({
  key: z.string(),
  userEmail: z.email(),
  title: z.string(),
  description: z.string().optional(),
  startsAt: relativeTime,
  durationMin: z.number().int().positive(),
  platform,
  attendees: z.array(attendeeSchema).default([]),
  recordEnabled: z.boolean().default(true),
});

const templateFixture = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  instructions: z.string(),
  sections: z.array(templateSectionSchema).min(1),
  isDefault: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});

/** Participants are listed in speaker order: array index == speaker_idx. */
const participantFixture = z.object({
  name: z.string(),
  email: z.email().optional(),
  userEmail: z.email().optional(),
  title: z.string().optional(),
  company: z.string().optional(),
  isExternal: z.boolean().default(false),
  color: z.string().optional(),
});

/** Compact segment tuple keeps the hour-long fixture small: [speakerIdx, startMs, endMs, text]. */
const segmentTuple = z.tuple([z.number().int().min(0), z.number().int().min(0), z.number().int().min(0), z.string().min(1)]);

const meetingFixture = z.object({
  key: z.string(),
  ownerEmail: z.email(),
  calendarEventKey: z.string().optional(),
  title: z.string(),
  meetingType: z.string().default("general"),
  platform,
  status: z.enum(["scheduled", "live", "processing", "ready", "failed"]).default("ready"),
  defaultTemplateId: z.string().default("general"),
  /** Defaults to the linked calendar event's start. */
  startedAt: relativeTime.optional(),
  participants: z.array(participantFixture).min(1),
  segments: z.array(segmentTuple).default([]),
  highlights: z
    .array(z.object({ atMs: z.number().int().min(0), label: z.string().optional(), byEmail: z.email().optional() }))
    .default([]),
  actionItems: z
    .array(
      z.object({
        text: z.string(),
        /** Speaker index of the owner, or null when unassigned. */
        assignee: z.number().int().min(0).nullable().default(null),
        assigneeName: z.string().optional(),
        dueDate: dateOrRelative.optional(),
        dueText: z.string().optional(),
        status: z.enum(["open", "done"]).default("open"),
        origin: z.enum(["ai", "manual"]).default("ai"),
        sourceSeqs: z.array(z.number().int().min(0)).default([]),
        evidenceQuote: z.string().optional(),
      }),
    )
    .default([]),
  clips: z
    .array(
      z.object({
        slug: z.string().regex(/^[a-z0-9-]{4,64}$/),
        title: z.string(),
        startMs: z.number().int().min(0),
        endMs: z.number().int().positive(),
        byEmail: z.email().optional(),
        viewCount: z.number().int().min(0).default(0),
      }),
    )
    .default([]),
  /** Pre-generated AI artefacts so the app is complete without an API key. */
  ai: z
    .object({
      promptVersion: z.string(),
      model: z.string(),
      chunkNotes: z
        .array(
          z.object({
            firstSeq: z.number().int(),
            lastSeq: z.number().int(),
            startMs: z.number().int(),
            endMs: z.number().int(),
            notes: chunkNotesSchema,
          }),
        )
        .default([]),
      knowledge: meetingKnowledgeSchema.optional(),
      summaries: z.array(z.object({ templateId: z.string(), content: summaryContentSchema })).default([]),
    })
    .optional(),
});

export const datasetSchema = z.object({
  users: z.array(userFixture).default([]),
  calendarConnections: z.array(connectionFixture).default([]),
  calendarEvents: z.array(calendarEventFixture).default([]),
  templates: z.array(templateFixture).default([]),
  meetings: z.array(meetingFixture).default([]),
});

export type Dataset = z.infer<typeof datasetSchema>;
export type DatasetInput = z.input<typeof datasetSchema>;
export type MeetingFixture = Dataset["meetings"][number];

async function listJson(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith(".json"))
    .map((e) => path.join(e.parentPath, e.name))
    .sort();
}

/** Load, validate and merge every fixture file. Fails loudly with the file name. */
export async function loadFixtures(dir: string): Promise<{ dataset: Dataset; files: string[] }> {
  const files = await listJson(dir);
  const merged: Dataset = datasetSchema.parse({});
  for (const file of files) {
    const parsed = datasetSchema.safeParse(JSON.parse(await readFile(file, "utf8")));
    if (!parsed.success) {
      throw new Error(`Invalid fixture ${path.relative(process.cwd(), file)}:\n${z.prettifyError(parsed.error)}`);
    }
    for (const k of Object.keys(merged) as (keyof Dataset)[]) {
      (merged[k] as unknown[]).push(...parsed.data[k]);
    }
  }
  return { dataset: merged, files };
}
