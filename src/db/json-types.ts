/**
 * Shapes of the jsonb columns. Zod schemas are the source of truth: the AI
 * layer validates model output against them, the seed validates fixtures
 * against them, and schema.ts types the columns with the inferred types.
 *
 * `seqs` always refers to transcript_segments.seq within the same meeting -
 * the stable per-meeting line number shown to the model as [#seq].
 */
import { z } from "zod";

const seqs = z.array(z.number().int().nonnegative());

export const attendeeSchema = z.object({
  name: z.string(),
  email: z.email(),
  responseStatus: z.enum(["accepted", "tentative", "declined", "needsAction"]).default("accepted"),
  isOrganizer: z.boolean().default(false),
});
export type Attendee = z.infer<typeof attendeeSchema>;

/** A file on a calendar event. `body` is set for seeded briefs rendered in-app. */
export const attachmentSchema = z.object({
  title: z.string(),
  kind: z.enum(["pdf", "doc", "sheet", "slides", "link"]),
  url: z.string(),
  body: z.string().optional(),
});
export type Attachment = z.infer<typeof attachmentSchema>;

/** Computed once when a meeting is finalised, so dashboards never aggregate. */
export const meetingStatsSchema = z.object({
  durationMs: z.number().int(),
  segmentCount: z.number().int(),
  wordCount: z.number().int(),
  speakerCount: z.number().int(),
  talkTime: z.array(
    z.object({ participantId: z.uuid(), talkMs: z.number().int(), share: z.number() }),
  ),
  actionItemCount: z.number().int(),
  highlightCount: z.number().int(),
});
export type MeetingStats = z.infer<typeof meetingStatsSchema>;

/** A template is data, not code: the section list drives prompt + rendering. */
export const templateSectionSchema = z.object({
  id: z.string(),
  heading: z.string(),
  guidance: z.string(),
});
export type TemplateSection = z.infer<typeof templateSectionSchema>;

/** Stage 1 output: notes for one ~10-minute window. */
export const chunkNotesSchema = z.object({
  topics: z.array(z.object({ title: z.string(), summary: z.string(), seqs })),
  decisions: z.array(z.object({ text: z.string(), seqs })),
  actionItemCandidates: z.array(
    z.object({
      text: z.string(),
      owner: z.string().nullable(),
      dueText: z.string().nullable(),
      evidenceQuote: z.string(),
      seqs,
    }),
  ),
  openQuestions: z.array(z.object({ text: z.string(), seqs })),
  notableMoments: z.array(z.object({ text: z.string(), seqs })),
});
export type ChunkNotes = z.infer<typeof chunkNotesSchema>;

/** Stage 2 output: the canonical, de-duplicated facts about the meeting. */
export const meetingKnowledgeSchema = z.object({
  overview: z.string(),
  topics: z.array(
    z.object({ title: z.string(), summary: z.string(), startMs: z.number().int(), endMs: z.number().int(), seqs }),
  ),
  decisions: z.array(z.object({ text: z.string(), seqs })),
  openQuestions: z.array(z.object({ text: z.string(), seqs })),
  speakerContributions: z.array(z.object({ speaker: z.string(), summary: z.string() })),
});
export type MeetingKnowledge = z.infer<typeof meetingKnowledgeSchema>;

/** Stage 3 output: one template rendered for one meeting. */
export const summaryContentSchema = z.object({
  sections: z.array(
    z.object({
      id: z.string(),
      heading: z.string(),
      items: z.array(z.object({ text: z.string(), seqs })),
    }),
  ),
});
export type SummaryContent = z.infer<typeof summaryContentSchema>;
