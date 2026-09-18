/**
 * Authoring format for seed meetings. Authors write dialogue and reference
 * lines by *tag*, never by seq or timestamp - build.ts assigns timing, splits
 * turns into transcriber-sized segments and resolves tags to seqs.
 *
 * Script conventions
 *   ["maya", "Text of the turn."]            a turn by speaker handle "maya"
 *   ["raj", "Text.", "sso-ask"]              same, tagged "sso-ask" for references
 *   ["tom", "~Sorry, go ahead."]             leading "~" = cross-talk: starts
 *                                            before the previous speaker finished
 *   { pause: 12000 }                         silence (screen share, reading, etc.)
 *
 * Summary / knowledge items: "plain text" or ["text", "tag", "tag2"] to cite.
 */

export type Line = [speaker: string, text: string, tag?: string] | { pause: number };

export type Cited = string | [text: string, ...tags: string[]];

export interface ParticipantSource {
  name: string;
  /** Workspace user email (internal participant). */
  user?: string;
  /** External email. */
  email?: string;
  title?: string;
  company?: string;
  external?: boolean;
}

export interface MeetingSource {
  key: string;
  title: string;
  meetingType: "product_review" | "standup" | "sales" | "one_on_one" | "interview" | "general";
  defaultTemplate: string;
  platform: "zoom" | "google_meet" | "teams";
  owner: string;
  /** "D-2@15:00" - also becomes the linked calendar event's start. */
  startedAt: string;
  /** Scheduled length of the calendar event. */
  scheduledMin: number;
  description?: string;
  /** Participants in speaker order; keys are handles used in the script. */
  participants: Record<string, ParticipantSource>;
  /** Rescale timing so the recording lasts exactly this long (hour-long call). */
  targetMinutes?: number;
  script: Line[];
  /**
   * Extra scenes spliced in after the line tagged with the key. "@start" and
   * "@end" prepend/append. Lets long meetings be written as a main flow plus
   * scenes without rewriting the flow.
   */
  inserts?: Record<string, Line[]>;
  highlights?: { at: string; label: string; by?: string }[];
  actionItems?: {
    text: string;
    owner: string | null;
    at: string;
    /** Must appear verbatim (modulo case/punctuation) in the tagged turn. */
    quote: string;
    due?: string;
    dueText?: string;
    status?: "open" | "done";
  }[];
  /** Manually added items (not from the transcript). */
  manualActionItems?: { text: string; owner: string | null; due?: string; status?: "open" | "done" }[];
  clips?: { slug: string; title: string; from: string; to?: string; views: number; by?: string }[];
  knowledge: {
    overview: string;
    topics: { title: string; summary: string; from: string; to: string }[];
    decisions: Cited[];
    openQuestions: Cited[];
    speakerContributions: Record<string, string>;
  };
  /** Hand-written renders for templates other than "general" (which is derived). */
  summaries?: Record<string, Record<string, Cited[]>>;
}

export const defineMeeting = (m: MeetingSource) => m;

/**
 * Resolve `inserts` into a flat script; every anchor must exist. Anchors may be
 * tags on inserted lines too, so a scene can hang off another scene.
 */
export function expandScript(m: MeetingSource): Line[] {
  const inserts = m.inserts ?? {};
  const used = new Set<string>();
  const out: Line[] = [];
  const emit = (l: Line) => {
    out.push(l);
    const t = Array.isArray(l) ? l[2] : undefined;
    if (t && inserts[t] && !used.has(t)) {
      used.add(t);
      inserts[t].forEach(emit);
    }
  };
  (inserts["@start"] ?? []).forEach(emit);
  m.script.forEach(emit);
  (inserts["@end"] ?? []).forEach(emit);
  const missing = Object.keys(inserts).filter((k) => !k.startsWith("@") && !used.has(k));
  if (missing.length) throw new Error(`${m.key}: insert anchors not found: ${missing.join(", ")}`);
  return out;
}

/** Merge extra scenes into a meeting (appending when both define the same anchor). */
export function withScenes(m: MeetingSource, scenes: Record<string, Line[]> | undefined): MeetingSource {
  if (!scenes) return m;
  const inserts = { ...(m.inserts ?? {}) };
  for (const [k, v] of Object.entries(scenes)) inserts[k] = [...(inserts[k] ?? []), ...v];
  return { ...m, inserts };
}
