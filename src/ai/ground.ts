/**
 * Validation between the model and the database. Zod schemas are lenient on
 * shape (small models drift: "#12" instead of 12, missing arrays), then every
 * citation is checked against the actual transcript lines:
 *   - a citation to a line that doesn't exist (or is outside the window) is removed;
 *   - an item left with no valid citation is dropped;
 *   - an action item whose quote isn't in its cited lines is re-pointed to the
 *     line that does contain it, or kept but flagged `verified: false`.
 */
import { z } from "zod";
import { isGrounded } from "../lib/transcript";

const seq = z.union([z.number(), z.string()]).transform((v) => Number(String(v).replace(/[^\d]/g, "")));
const seqs = z.array(seq).default([]);
const cited = z.object({ text: z.string().min(1), seqs });
const list = <T extends z.ZodType>(t: T) => z.array(t).default([]);

const action = z.object({
  text: z.string().min(1),
  owner: z.string().nullish().transform((v) => v || null),
  dueText: z.string().nullish().transform((v) => v || null),
  evidenceQuote: z.string().min(3),
  seqs,
});

// Core keys are required (no default): a reply shaped like something else must
// fail and be retried, not be accepted as "nothing found in this window".
export const modelChunkNotes = z.object({
  topics: z.array(z.object({ title: z.string().min(1), summary: z.string().default(""), seqs })),
  decisions: list(cited),
  actionItemCandidates: z.array(action),
  openQuestions: list(cited),
  notableMoments: list(cited),
});

export const modelMerge = z.object({
  overview: z.string().min(1),
  topics: list(z.object({ title: z.string().min(1), summary: z.string().default(""), seqs })),
  decisions: list(cited),
  openQuestions: list(cited),
  speakerContributions: list(z.object({ speaker: z.string(), summary: z.string() })),
  actionItems: list(action),
});

export const modelSummary = z.object({
  sections: z.array(z.object({ id: z.string(), items: list(cited) })).min(1),
});

export type Lines = ReadonlyMap<number, { text: string }>;
export type GroundReport = { kept: number; dropped: number; repaired: number; flagged: number };
export const emptyReport = (): GroundReport => ({ kept: 0, dropped: 0, repaired: 0, flagged: 0 });

const valid = (xs: number[], lines: Lines) => [...new Set(xs)].filter((s) => lines.has(s)).sort((a, b) => a - b);

/** Keep items that still cite at least one real line; strip the fake citations. */
export function groundCited<T extends { seqs: number[] }>(items: T[], lines: Lines, r: GroundReport): T[] {
  return items.flatMap((it) => {
    const s = valid(it.seqs, lines);
    if (!s.length) return (r.dropped++, []);
    r.kept++;
    return [{ ...it, seqs: s }];
  });
}

export type GroundedAction = z.infer<typeof action> & { verified: boolean };

export function groundActions(items: z.infer<typeof action>[], lines: Lines, r: GroundReport): GroundedAction[] {
  const all = [...lines.keys()].sort((a, b) => a - b);
  return items.flatMap((it): GroundedAction[] => {
    const s = valid(it.seqs, lines);
    if (s.length && isGrounded(lines, s, it.evidenceQuote)) return (r.kept++, [{ ...it, seqs: s, verified: true }]);
    // Quote is real but cited wrong: find the line (or adjacent pair) that says it.
    const hit = all.map((q) => [q]).find((c) => isGrounded(lines, c, it.evidenceQuote)) ??
      all.slice(1).map((q, i) => [all[i]!, q]).find((c) => isGrounded(lines, c, it.evidenceQuote));
    if (hit) return (r.repaired++, [{ ...it, seqs: hit, verified: true }]);
    if (!s.length) return (r.dropped++, []);
    r.flagged++;
    return [{ ...it, seqs: s, verified: false }];
  });
}
