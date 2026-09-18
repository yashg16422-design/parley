/**
 * Summary templates. Data, not code: the section list is both the output
 * contract given to the model and the render order in the UI. `instructions`
 * is the template-specific part of the prompt (the transcript prefix is shared
 * and cached across templates).
 */
import type { DatasetInput } from "../../src/db/seed/fixtures";

type Template = NonNullable<DatasetInput["templates"]>[number] & { sections: { id: string; heading: string; guidance: string }[] };

export const templates: Template[] = [
  {
    id: "general",
    name: "General",
    description: "Balanced notes for any meeting: overview, topics, decisions, next steps.",
    isDefault: true,
    sortOrder: 0,
    instructions:
      "Write neutral, skimmable meeting notes. Prefer concrete nouns and numbers from the call over adjectives. Every decision and next step must cite the lines it came from.",
    sections: [
      { id: "overview", heading: "Overview", guidance: "2-3 sentences: purpose of the call and the outcome." },
      { id: "topics", heading: "Key topics", guidance: "One bullet per topic discussed, in order, with the gist." },
      { id: "decisions", heading: "Decisions", guidance: "Only things explicitly agreed. Omit proposals that weren't settled." },
      { id: "next_steps", heading: "Next steps", guidance: "Owner: task (due date if stated)." },
      { id: "open_questions", heading: "Open questions", guidance: "Unresolved questions someone needs to answer." },
    ],
  },
  {
    id: "product_review",
    name: "Product Review",
    description: "For roadmap, scoping and launch discussions.",
    sortOrder: 1,
    instructions:
      "Summarize for a product team. Separate customer evidence from opinion. Make trade-offs explicit: what was cut or deferred and why. Quote metrics exactly as stated.",
    sections: [
      { id: "goals", heading: "Goals", guidance: "What the team is trying to achieve and how success is measured." },
      { id: "customer_signal", heading: "Customer signal", guidance: "Evidence from customers, sales and support, with numbers." },
      { id: "decisions", heading: "Decisions", guidance: "What was decided, including scope and sequencing." },
      { id: "scope", heading: "Scope & trade-offs", guidance: "In, out, and deferred - with the reason." },
      { id: "risks", heading: "Risks", guidance: "Technical, commercial or timeline risks raised." },
      { id: "launch_plan", heading: "Launch plan", guidance: "Dates, audiences, gates." },
      { id: "open_questions", heading: "Open questions", guidance: "Unresolved and who owns the answer." },
    ],
  },
  {
    id: "exec_brief",
    name: "Executive Brief",
    description: "A 60-second read for leadership: outcomes, risks, asks.",
    sortOrder: 2,
    instructions:
      "Write for a busy executive who did not attend. Lead with outcomes. No play-by-play. At most 4 bullets per section. Surface anything that needs a leadership decision.",
    sections: [
      { id: "tldr", heading: "TL;DR", guidance: "The 2-3 things that matter." },
      { id: "decisions", heading: "Decisions made", guidance: "Settled outcomes only." },
      { id: "risks", heading: "Risks", guidance: "What could go wrong and its impact." },
      { id: "asks", heading: "Asks & escalations", guidance: "What the team needs from leadership." },
    ],
  },
  {
    id: "sales_discovery",
    name: "Sales Discovery",
    description: "Qualification notes: pain, requirements, budget, decision process.",
    sortOrder: 3,
    instructions:
      "Summarize a sales conversation for the account team and CRM. Use the prospect's own words for pains. Be explicit about unknowns in budget, timeline and decision process - never guess.",
    sections: [
      { id: "company", heading: "Company context", guidance: "Who they are, size, team using the product." },
      { id: "pain", heading: "Pain points", guidance: "Problems in the prospect's words, with impact." },
      { id: "current_solution", heading: "Current solution", guidance: "What they use today and why it falls short." },
      { id: "requirements", heading: "Requirements & objections", guidance: "Must-haves, deal blockers, concerns." },
      { id: "budget_timeline", heading: "Budget & timeline", guidance: "Stated budget, timing, triggers." },
      { id: "decision_process", heading: "Decision process", guidance: "Champion, economic buyer, steps, competitors." },
      { id: "next_steps", heading: "Next steps", guidance: "Agreed follow-ups on both sides." },
    ],
  },
  {
    id: "standup",
    name: "Daily Standup",
    description: "Per-person progress, plans and blockers.",
    sortOrder: 4,
    instructions: "One bullet per person per section, prefixed with their name. Keep each under 20 words. Blockers must name who can unblock.",
    sections: [
      { id: "done", heading: "Since last standup", guidance: "Completed or progressed work." },
      { id: "today", heading: "Today", guidance: "Planned focus." },
      { id: "blockers", heading: "Blockers", guidance: "What's blocked and who can unblock it." },
    ],
  },
  {
    id: "one_on_one",
    name: "1:1",
    description: "Manager/report conversation: wins, concerns, feedback, growth.",
    sortOrder: 5,
    instructions:
      "Write private 1:1 notes in a supportive, factual tone. Capture feedback in both directions. Do not editorialize about the person.",
    sections: [
      { id: "wins", heading: "Wins", guidance: "Recent progress worth recognizing." },
      { id: "concerns", heading: "Concerns & blockers", guidance: "What's worrying or slowing them down." },
      { id: "feedback", heading: "Feedback", guidance: "Feedback given or asked for, both directions." },
      { id: "growth", heading: "Growth", guidance: "Career goals, stretch opportunities." },
      { id: "follow_ups", heading: "Follow-ups", guidance: "Commitments from either side." },
    ],
  },
  {
    id: "interview",
    name: "Candidate Interview",
    description: "Structured interview debrief with evidence for each signal.",
    sortOrder: 6,
    instructions:
      "Write an interview debrief. Every signal must be backed by what the candidate actually said or did. Separate observation from judgment. End with a recommendation and confidence.",
    sections: [
      { id: "background", heading: "Candidate background", guidance: "Relevant experience as described by the candidate." },
      { id: "technical", heading: "Technical assessment", guidance: "Problem-solving and depth, with evidence." },
      { id: "communication", heading: "Communication & collaboration", guidance: "How they explained, listened, handled pushback." },
      { id: "strengths", heading: "Strengths", guidance: "Clear positives." },
      { id: "concerns", heading: "Concerns", guidance: "Gaps or risks, with evidence." },
      { id: "recommendation", heading: "Recommendation", guidance: "Hire / no hire / next round, with confidence." },
    ],
  },
];
