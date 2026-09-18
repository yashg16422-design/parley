import type { ChatMessage } from "./llm";

const SYSTEM = `You turn meeting transcripts into structured notes.
Rules:
- Reply with ONLY one JSON object. No markdown, no code fences, no commentary.
- Transcript lines look like [#412 23:14 Raj Patel] text. "seqs" are those line numbers (412), as integers.
- Every item must cite the line numbers it came from. Never cite a line you were not shown.
- "evidenceQuote" must be copied word for word from a cited line.
- An action item is a commitment someone made ("I'll send it", "Raj will draft it"), not an idea or a maybe.
- "owner" is the committed person's name as it appears in the transcript, or null.
- "dueText" is the deadline exactly as said ("by end of week"), or null. Never invent dates.
- If a list has nothing in it, use [].`;

const CHUNK_SHAPE = `{"topics":[{"title":"...","summary":"...","seqs":[1]}],
 "decisions":[{"text":"...","seqs":[1]}],
 "actionItemCandidates":[{"text":"...","owner":"Name or null","dueText":"... or null","evidenceQuote":"exact words","seqs":[1]}],
 "openQuestions":[{"text":"...","seqs":[1]}],
 "notableMoments":[{"text":"...","seqs":[1]}]}`;

const MERGE_SHAPE = `{"overview":"2-3 sentences",
 "topics":[{"title":"...","summary":"...","seqs":[1]}],
 "decisions":[{"text":"...","seqs":[1]}],
 "openQuestions":[{"text":"...","seqs":[1]}],
 "speakerContributions":[{"speaker":"Name","summary":"..."}],
 "actionItems":[{"text":"...","owner":"Name or null","dueText":"... or null","evidenceQuote":"exact words","seqs":[1]}]}`;

const msgs = (user: string): ChatMessage[] => [
  { role: "system", content: SYSTEM },
  { role: "user", content: user },
];

export function chunkPrompt(o: { title: string; participants: string[]; window: string; lines: string }): ChatMessage[] {
  return msgs(`Meeting: ${o.title}
Participants: ${o.participants.join(", ")}
This is ${o.window} of the transcript. The first few lines are lead-in from the previous part.

${o.lines}

Extract notes for this part. Reply with JSON in exactly this shape:
${CHUNK_SHAPE}`);
}

export function mergePrompt(o: { title: string; participants: string[]; notes: string }): ChatMessage[] {
  return msgs(`Meeting: ${o.title}
Participants: ${o.participants.join(", ")}
Below are notes from consecutive ~10-minute parts of one meeting, in order. They overlap slightly.
Merge them into one record: de-duplicate repeated items, keep the earliest citation for each,
and keep every real commitment as an action item. Copy seqs and evidenceQuote values from the notes, don't invent new ones.

${o.notes}

Reply with JSON in exactly this shape:
${MERGE_SHAPE}`);
}

export function summaryPrompt(o: {
  title: string;
  template: { name: string; instructions: string; sections: { id: string; heading: string; guidance: string }[] };
  record: string;
}): ChatMessage[] {
  const sections = o.template.sections.map((s) => `- "${s.id}" (${s.heading}): ${s.guidance}`).join("\n");
  return msgs(`Meeting: ${o.title}
Write the "${o.template.name}" summary. ${o.template.instructions}
Use only the facts in this meeting record; keep their seqs as citations:

${o.record}

Sections, in this order:
${sections}

Reply with JSON in exactly this shape (one entry per section id above, items may be []):
{"sections":[{"id":"section_id","items":[{"text":"...","seqs":[1]}]}]}`);
}
