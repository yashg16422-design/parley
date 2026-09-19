/**
 * Database schema. Everything hangs off `meetings`; `transcript_segments` is the
 * anchor that action items, highlights, clips and search results point into.
 *
 * Conventions
 * - Times inside a meeting are integer milliseconds from recording start
 *   (`*_ms`). Wall-clock times are `timestamptz`.
 * - `seq` is a segment's 0-based line number within its meeting. It is stable
 *   across re-seeds and is what the AI cites as [#seq], so references use
 *   (meeting_id, seq) rather than a surrogate id.
 * - Child rows of a meeting cascade on delete; references to users/participants
 *   that may disappear are SET NULL so history survives.
 */
import { relations, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type {
  Attachment,
  Attendee,
  ChunkNotes,
  MeetingKnowledge,
  MeetingStats,
  SummaryContent,
  TemplateSection,
} from "./json-types";

// ---------------------------------------------------------------------------
// Column helpers
// ---------------------------------------------------------------------------

/** Read-only full-text search vector, always a generated column. */
const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const calendarProvider = pgEnum("calendar_provider", ["google", "outlook", "ics"]);
export const connectionStatus = pgEnum("connection_status", ["connected", "syncing", "disconnected"]);
export const meetingPlatform = pgEnum("meeting_platform", ["zoom", "google_meet", "teams"]);
export const meetingStatus = pgEnum("meeting_status", [
  "scheduled", // on the calendar, not started
  "live", // playback engine is running, segments are streaming in
  "processing", // call ended, AI pipeline running
  "ready", // summaries + action items available
  "failed",
]);
export const summaryStatus = pgEnum("summary_status", ["pending", "streaming", "ready", "failed"]);
/** External video host. Media stays there; Parley stores ids and millisecond ranges only. */
export const mediaProvider = pgEnum("media_provider", ["mux"]);
export const actionItemStatus = pgEnum("action_item_status", ["open", "done"]);
export const itemOrigin = pgEnum("item_origin", ["ai", "manual"]);
export const jobKind = pgEnum("job_kind", ["chunk_notes", "merge_knowledge", "render_summary", "finalize_stats"]);
export const jobStatus = pgEnum("job_status", ["queued", "running", "succeeded", "failed"]);

// ---------------------------------------------------------------------------
// Users & calendar (Google connection is simulated - no OAuth tokens stored)
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  title: text("title"),
  avatarUrl: text("avatar_url"),
  timezone: text("timezone").notNull().default("America/New_York"),
  createdAt: createdAt(),
});

export const calendarConnections = pgTable(
  "calendar_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: calendarProvider("provider").notNull().default("google"),
    accountEmail: text("account_email").notNull(),
    status: connectionStatus("status").notNull().default("connected"),
    /** Record every call with external attendees / every call / none. */
    autoRecord: text("auto_record", { enum: ["all", "external", "none"] }).notNull().default("all"),
    connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    /** ics provider: the secret feed address, encrypted (it is a read credential). */
    feedUrlSecret: text("feed_url_secret"),
    lastSyncError: text("last_sync_error"),
  },
  (t) => [uniqueIndex("calendar_connections_user_provider_uq").on(t.userId, t.provider)],
);

export const calendarEvents = pgTable(
  "calendar_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    connectionId: uuid("connection_id").references(() => calendarConnections.id, { onDelete: "set null" }),
    /** Simulated provider event id, e.g. "gcal_7h2k...". */
    externalId: text("external_id").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    platform: meetingPlatform("platform").notNull(),
    meetingUrl: text("meeting_url").notNull(),
    attendees: jsonb("attendees").$type<Attendee[]>().notNull().default([]),
    agenda: text("agenda"),
    attachments: jsonb("attachments").$type<Attachment[]>().notNull().default([]),
    /** Per-event override of the connection's auto-record rule. */
    recordEnabled: boolean("record_enabled").notNull().default(true),
    /** Title, agenda and attachment titles (not URLs). */
    search: tsvector("search").generatedAlwaysAs(
      sql`setweight(to_tsvector('english', title), 'A') || setweight(to_tsvector('english', coalesce(agenda, '')), 'B') || setweight(jsonb_to_tsvector('english', jsonb_path_query_array(attachments, '$[*].title'), '["string"]'), 'B')`,
    ),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("calendar_events_connection_external_uq").on(t.connectionId, t.externalId),
    index("calendar_events_search_idx").using("gin", t.search),
    // Calendar views: "this user's events in a date window".
    index("calendar_events_user_starts_idx").on(t.userId, t.startsAt),
    check("calendar_events_time_order_ck", sql`${t.endsAt} > ${t.startsAt}`),
  ],
);

// ---------------------------------------------------------------------------
// Templates (data-driven: the section list drives both prompt and rendering)
// ---------------------------------------------------------------------------

export const templates = pgTable("templates", {
  /** Human-readable key, e.g. "general", "sales", "standup". */
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  instructions: text("instructions").notNull(),
  sections: jsonb("sections").$type<TemplateSection[]>().notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  sortOrder: smallint("sort_order").notNull().default(0),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------------------
// Meetings
// ---------------------------------------------------------------------------

export const meetings = pgTable(
  "meetings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** 1:1 with the calendar event it was recorded from (null for ad-hoc). */
    calendarEventId: uuid("calendar_event_id")
      .unique()
      .references(() => calendarEvents.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    /** Meeting category, used to pick a default template: sales, standup, 1on1... */
    meetingType: text("meeting_type").notNull().default("general"),
    platform: meetingPlatform("platform").notNull(),
    status: meetingStatus("status").notNull().default("scheduled"),
    defaultTemplateId: text("default_template_id")
      .notNull()
      .default("general")
      .references(() => templates.id),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    durationMs: integer("duration_ms").notNull().default(0),
    /** Denormalised counters/talk-time written once at finalize. */
    stats: jsonb("stats").$type<MeetingStats>(),
    /** sha256 of the finalized transcript; AI caches key off it. */
    transcriptHash: text("transcript_hash"),
    search: tsvector("search").generatedAlwaysAs(sql`to_tsvector('english', coalesce(title, ''))`),
    /** Live simulation: seeded meeting being replayed, and the replay clock. */
    simulatedFromId: uuid("simulated_from_id").references((): AnyPgColumn => meetings.id, { onDelete: "set null" }),
    liveClockMs: integer("live_clock_ms"),
    liveSpeed: smallint("live_speed"),
    liveUpdatedAt: timestamp("live_updated_at", { withTimezone: true }),
    /** Recording on an external provider (Mux asset + playback id); null until one is uploaded. */
    mediaProvider: mediaProvider("media_provider"),
    mediaAssetId: text("media_asset_id"),
    mediaPlaybackId: text("media_playback_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // Dashboard: "my meetings, newest first".
    index("meetings_owner_started_idx").on(t.ownerId, t.startedAt.desc()),
    index("meetings_status_idx").on(t.status),
    index("meetings_search_idx").using("gin", t.search),
    uniqueIndex("meetings_media_asset_uq").on(t.mediaProvider, t.mediaAssetId),
    check("meetings_media_ck", sql`(${t.mediaProvider} IS NULL) = (${t.mediaAssetId} IS NULL)`),
  ],
);

export const meetingParticipants = pgTable(
  "meeting_participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
    /** Set when the participant is a user of this workspace. */
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    email: text("email"),
    title: text("title"),
    company: text("company"),
    isExternal: boolean("is_external").notNull().default(false),
    /** 0-based speaker slot; the AI sees speakers as S0..S7. */
    speakerIdx: smallint("speaker_idx").notNull(),
    color: text("color").notNull(),
    talkMs: integer("talk_ms").notNull().default(0),
    wordCount: integer("word_count").notNull().default(0),
  },
  (t) => [
    uniqueIndex("meeting_participants_speaker_uq").on(t.meetingId, t.speakerIdx),
    index("meeting_participants_user_idx").on(t.userId),
  ],
);

export const transcriptSegments = pgTable(
  "transcript_segments",
  {
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => meetingParticipants.id, { onDelete: "cascade" }),
    /** Denormalised so the search vector (a generated column) can include it. */
    speakerName: text("speaker_name").notNull(),
    startMs: integer("start_ms").notNull(),
    endMs: integer("end_ms").notNull(),
    text: text("text").notNull(),
    /** Spoken words rank above the speaker's name. */
    search: tsvector("search").generatedAlwaysAs(
      sql`setweight(to_tsvector('english', text), 'A') || setweight(to_tsvector('simple', speaker_name), 'C')`,
    ),
  },
  (t) => [
    primaryKey({ name: "transcript_segments_pk", columns: [t.meetingId, t.seq] }),
    // Player/clip windows: WHERE meeting_id = $1 AND start_ms < $end AND end_ms > $start.
    index("transcript_segments_meeting_start_idx").on(t.meetingId, t.startMs),
    index("transcript_segments_participant_idx").on(t.participantId),
    index("transcript_segments_search_idx").using("gin", t.search),
    check("transcript_segments_time_order_ck", sql`${t.endMs} >= ${t.startMs} AND ${t.startMs} >= 0`),
  ],
);

export const highlights = pgTable(
  "highlights",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    /** Moment the Highlight button was pressed. */
    atMs: integer("at_ms").notNull(),
    label: text("label"),
    createdAt: createdAt(),
  },
  (t) => [
    index("highlights_meeting_at_idx").on(t.meetingId, t.atMs),
    check("highlights_at_ms_ck", sql`${t.atMs} >= 0`),
  ],
);

export const actionItems = pgTable(
  "action_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    assigneeParticipantId: uuid("assignee_participant_id").references(() => meetingParticipants.id, {
      onDelete: "set null",
    }),
    /** Owner as stated in the call, kept even when it matches no participant. */
    assigneeName: text("assignee_name"),
    dueDate: date("due_date", { mode: "string" }),
    /** Due date as phrased in the call ("by Friday"), when one was stated. */
    dueText: text("due_text"),
    status: actionItemStatus("status").notNull().default("open"),
    origin: itemOrigin("origin").notNull().default("ai"),
    /** Transcript lines (seq) that ground this item. */
    sourceSeqs: integer("source_seqs").array().notNull().default(sql`'{}'::integer[]`),
    /** Denormalised start of the first cited line, for one-click "jump to". */
    sourceStartMs: integer("source_start_ms"),
    evidenceQuote: text("evidence_quote"),
    /** True when every cited seq exists and the quote matches the transcript. */
    verified: boolean("verified").notNull().default(false),
    sortOrder: smallint("sort_order").notNull().default(0),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    search: tsvector("search").generatedAlwaysAs(sql`to_tsvector('english', text)`),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("action_items_meeting_idx").on(t.meetingId, t.sortOrder),
    index("action_items_assignee_idx").on(t.assigneeParticipantId),
    // "My open action items" across meetings.
    index("action_items_open_idx").on(t.status).where(sql`${t.status} = 'open'`),
    index("action_items_search_idx").using("gin", t.search),
  ],
);

export const clips = pgTable(
  "clips",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Public share path: /c/<slug>. */
    slug: text("slug").notNull().unique(),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    startMs: integer("start_ms").notNull(),
    endMs: integer("end_ms").notNull(),
    isPublic: boolean("is_public").notNull().default(true),
    viewCount: integer("view_count").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    index("clips_meeting_idx").on(t.meetingId),
    check("clips_range_ck", sql`${t.startMs} >= 0 AND ${t.endMs} > ${t.startMs}`),
  ],
);

// ---------------------------------------------------------------------------
// AI pipeline artefacts
// ---------------------------------------------------------------------------

/** Stage 1: notes for one time window, produced while the call is still live. */
export const chunkNotes = pgTable(
  "chunk_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
    promptVersion: text("prompt_version").notNull(),
    chunkIdx: smallint("chunk_idx").notNull(),
    firstSeq: integer("first_seq").notNull(),
    lastSeq: integer("last_seq").notNull(),
    startMs: integer("start_ms").notNull(),
    endMs: integer("end_ms").notNull(),
    notes: jsonb("notes").$type<ChunkNotes>().notNull(),
    model: text("model").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("chunk_notes_meeting_version_idx_uq").on(t.meetingId, t.promptVersion, t.chunkIdx)],
);

/** Stage 2: canonical merged facts. 1:1 with a meeting. */
export const meetingKnowledge = pgTable("meeting_knowledge", {
  meetingId: uuid("meeting_id")
    .primaryKey()
    .references(() => meetings.id, { onDelete: "cascade" }),
  promptVersion: text("prompt_version").notNull(),
  transcriptHash: text("transcript_hash").notNull(),
  knowledge: jsonb("knowledge").$type<MeetingKnowledge>().notNull(),
  model: text("model").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Stage 3: a template rendered for a meeting. Unique key doubles as the cache. */
export const summaries = pgTable(
  "summaries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
    templateId: text("template_id")
      .notNull()
      .references(() => templates.id, { onDelete: "cascade" }),
    promptVersion: text("prompt_version").notNull(),
    status: summaryStatus("status").notNull().default("pending"),
    content: jsonb("content").$type<SummaryContent>(),
    model: text("model"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    cacheReadTokens: integer("cache_read_tokens"),
    error: text("error"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("summaries_meeting_template_version_uq").on(t.meetingId, t.templateId, t.promptVersion)],
);

/**
 * Durable, idempotent job queue in Postgres - each job is one short serverless
 * invocation. `key` makes enqueueing idempotent (e.g. "chunk:<meeting>:3:v1");
 * workers claim with FOR UPDATE SKIP LOCKED and hold a lease via locked_until.
 */
export const processingJobs = pgTable(
  "processing_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull().unique(),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
    kind: jobKind("kind").notNull(),
    status: jobStatus("status").notNull().default("queued"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    attempts: smallint("attempts").notNull().default(0),
    maxAttempts: smallint("max_attempts").notNull().default(3),
    runAfter: timestamp("run_after", { withTimezone: true }).notNull().defaultNow(),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    lastError: text("last_error"),
    /** Wall-clock cost of the last attempt, for the processing timeline UI. */
    durationMs: bigint("duration_ms", { mode: "number" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // Worker poll: next runnable queued job.
    index("processing_jobs_runnable_idx").on(t.runAfter).where(sql`${t.status} = 'queued'`),
    index("processing_jobs_meeting_idx").on(t.meetingId, t.kind),
  ],
);

// ---------------------------------------------------------------------------
// Relations (Drizzle relational query API)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Open core: tenant keys (BYOK) and personal access tokens
// ---------------------------------------------------------------------------

export const secretKind = pgEnum("secret_kind", ["deepgram", "huggingface"]);

/** A user's own provider key, AES-256-GCM encrypted (src/vault.ts). Preferred over the server's env keys. */
export const userSecrets = pgTable(
  "user_secrets",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    kind: secretKind("kind").notNull(),
    ciphertext: text("ciphertext").notNull(),
    last4: text("last4").notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.kind] })],
);

/** Bearer tokens for scripts and the capture extension. Only the SHA-256 is stored. */
export const apiTokens = pgTable(
  "api_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    prefix: text("prefix").notNull(),
    scopes: text("scopes", { enum: ["ingest", "calendar"] }).array().notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("api_tokens_user_idx").on(t.userId)],
);

export const usersRelations = relations(users, ({ many }) => ({
  calendarConnections: many(calendarConnections),
  calendarEvents: many(calendarEvents),
  meetings: many(meetings),
  participations: many(meetingParticipants),
  highlights: many(highlights),
  clips: many(clips),
}));

export const calendarConnectionsRelations = relations(calendarConnections, ({ one, many }) => ({
  user: one(users, { fields: [calendarConnections.userId], references: [users.id] }),
  events: many(calendarEvents),
}));

export const calendarEventsRelations = relations(calendarEvents, ({ one }) => ({
  user: one(users, { fields: [calendarEvents.userId], references: [users.id] }),
  connection: one(calendarConnections, {
    fields: [calendarEvents.connectionId],
    references: [calendarConnections.id],
  }),
  meeting: one(meetings),
}));

export const templatesRelations = relations(templates, ({ many }) => ({
  summaries: many(summaries),
  meetings: many(meetings),
}));

export const meetingsRelations = relations(meetings, ({ one, many }) => ({
  owner: one(users, { fields: [meetings.ownerId], references: [users.id] }),
  calendarEvent: one(calendarEvents, { fields: [meetings.calendarEventId], references: [calendarEvents.id] }),
  defaultTemplate: one(templates, { fields: [meetings.defaultTemplateId], references: [templates.id] }),
  participants: many(meetingParticipants),
  segments: many(transcriptSegments),
  highlights: many(highlights),
  actionItems: many(actionItems),
  clips: many(clips),
  chunkNotes: many(chunkNotes),
  knowledge: one(meetingKnowledge),
  summaries: many(summaries),
  jobs: many(processingJobs),
}));

export const meetingParticipantsRelations = relations(meetingParticipants, ({ one, many }) => ({
  meeting: one(meetings, { fields: [meetingParticipants.meetingId], references: [meetings.id] }),
  user: one(users, { fields: [meetingParticipants.userId], references: [users.id] }),
  segments: many(transcriptSegments),
  assignedActionItems: many(actionItems),
}));

export const transcriptSegmentsRelations = relations(transcriptSegments, ({ one }) => ({
  meeting: one(meetings, { fields: [transcriptSegments.meetingId], references: [meetings.id] }),
  participant: one(meetingParticipants, {
    fields: [transcriptSegments.participantId],
    references: [meetingParticipants.id],
  }),
}));

export const highlightsRelations = relations(highlights, ({ one }) => ({
  meeting: one(meetings, { fields: [highlights.meetingId], references: [meetings.id] }),
  author: one(users, { fields: [highlights.createdBy], references: [users.id] }),
}));

export const actionItemsRelations = relations(actionItems, ({ one }) => ({
  meeting: one(meetings, { fields: [actionItems.meetingId], references: [meetings.id] }),
  assignee: one(meetingParticipants, {
    fields: [actionItems.assigneeParticipantId],
    references: [meetingParticipants.id],
  }),
}));

export const clipsRelations = relations(clips, ({ one }) => ({
  meeting: one(meetings, { fields: [clips.meetingId], references: [meetings.id] }),
  author: one(users, { fields: [clips.createdBy], references: [users.id] }),
}));

export const chunkNotesRelations = relations(chunkNotes, ({ one }) => ({
  meeting: one(meetings, { fields: [chunkNotes.meetingId], references: [meetings.id] }),
}));

export const meetingKnowledgeRelations = relations(meetingKnowledge, ({ one }) => ({
  meeting: one(meetings, { fields: [meetingKnowledge.meetingId], references: [meetings.id] }),
}));

export const summariesRelations = relations(summaries, ({ one }) => ({
  meeting: one(meetings, { fields: [summaries.meetingId], references: [meetings.id] }),
  template: one(templates, { fields: [summaries.templateId], references: [templates.id] }),
}));

export const processingJobsRelations = relations(processingJobs, ({ one }) => ({
  meeting: one(meetings, { fields: [processingJobs.meetingId], references: [meetings.id] }),
}));
