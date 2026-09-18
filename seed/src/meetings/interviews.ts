import { defineMeeting } from "../dsl";
import { D, staff } from "../workspace";

export const interviewBackend = defineMeeting({
  key: "interview-backend-jordan",
  title: "Interview: Senior Backend Engineer (Jordan Reyes)",
  meetingType: "interview",
  defaultTemplate: "interview",
  platform: "zoom",
  owner: D("raj"),
  startedAt: "D-3@19:00",
  scheduledMin: 45,
  participants: {
    raj: staff("raj"),
    priya: staff("priya"),
    jordan: { name: "Jordan Reyes", email: "jordan.reyes@mail.example", title: "Candidate, Senior Backend Engineer", external: true },
  },
  script: [
    ["raj", "Hi Jordan, thanks for joining. I'm Raj, I lead the platform team, and this is Priya, our staff ML engineer. We'll do a few minutes on your background, then a system design problem, and leave time for your questions."],
    ["jordan", "Sounds great. Nice to meet you both."],
    ["raj", "Tell us about what you're working on now."],
    [
      "jordan",
      "I'm at a payments company, about six years now. For the last three I've owned our event processing platform. It's mostly Go and Postgres, with a queue in front. The thing I'm proudest of is making payment webhooks exactly-once from the customer's point of view. We had duplicate charges happening a few times a month, and we got it to zero.",
      "jordan-background",
    ],
    ["priya", "How did you get it to zero?"],
    [
      "jordan",
      "Idempotency keys everywhere. Every event carries a key from the source, and we record it in the same transaction as the side effect. If the event comes in again, the insert conflicts and we skip it. The queue is at-least-once, but the effect is exactly-once.",
      "jordan-idempotency",
    ],
    ["raj", "~That's exactly the pattern we use. Okay, let's do the design problem."],
    [
      "raj",
      "Imagine our ingest pipeline. Customers connect sources like Zendesk and app stores, and we pull in feedback continuously. Some customers send ten comments a day, some send fifty thousand in an hour when something breaks. Design it so we never lose feedback and never show duplicates.",
      "raj-problem",
    ],
    [
      "jordan",
      "Okay. First, I'd separate fetching from processing. Connectors pull from the source and write raw records to a durable queue, with the source and the external ID as the dedupe key. Workers pull from the queue, normalize, and write to Postgres with a unique constraint on source plus external ID. So retries are safe.",
      "jordan-design",
    ],
    [
      "jordan",
      "For spikes, the queue absorbs the burst, and workers scale on queue depth. I'd also want per-customer fairness, so one customer's fifty thousand comments don't delay everyone else. Probably a queue partition per customer, or weighted scheduling.",
      "jordan-fairness",
    ],
    ["raj", "What would you monitor?"],
    [
      "jordan",
      "Error rates, obviously. Worker throughput. And, hmm. I'd probably say latency of the processing step.",
    ],
    ["raj", "What would tell you that customers aren't seeing their feedback, even if nothing is erroring?"],
    [
      "jordan",
      "Oh, right. Queue lag. How old the oldest unprocessed message is. That's the one that actually matches customer pain. Errors can be zero while you're six hours behind.",
      "jordan-lag",
    ],
    ["raj", "~Ha. You'd be surprised how relevant that is here."],
    [
      "priya",
      "Let me add a twist. After ingest, we cluster feedback into themes. Re-clustering everything on every new comment is expensive. How would you approach that?",
      "priya-twist",
    ],
    [
      "jordan",
      "I'd split it into a fast path and a slow path. The fast path assigns each new comment to the nearest existing theme, if it's close enough. The slow path re-clusters everything on a schedule, nightly maybe. Anything the fast path isn't confident about waits for the slow path.",
      "jordan-incremental",
    ],
    ["priya", "That's very close to what we're planning. How would you know if the fast path is drifting?"],
    [
      "jordan",
      "Compare them. After each nightly run, measure how many fast-path assignments the full re-cluster would have made differently. If that number climbs, the themes have drifted and you re-cluster more often.",
      "jordan-drift",
    ],
    ["priya", "~I like that a lot."],
    [
      "raj",
      "Last one. You need to add a column to a table with two billion rows, while it's taking writes at peak. How?",
      "raj-migration",
    ],
    [
      "jordan",
      "Never in one step. Add the column as nullable with no default, which is instant in modern Postgres. Backfill in small batches. Then switch reads, then add constraints. Expand, migrate, contract. And never do it without being able to watch lock waits in real time.",
      "jordan-migration",
    ],
    ["raj", "Great. What questions do you have for us?"],
    [
      "jordan",
      "How does on-call work? I've been on a team where it burned people out, and I'd want to know honestly.",
      "jordan-oncall-q",
    ],
    [
      "raj",
      "Honestly, it's currently one week in five, and after a recent outage it's been heavier than I'd like. Hiring this role is part of fixing that. I'd rather tell you now than have you find out later.",
      "raj-honest",
    ],
    ["jordan", "I appreciate that. Thank you, this was a fun conversation."],
    ["raj", "Thanks Jordan. We'll get back to you within a couple of days.", "raj-close"],
  ],
  actionItems: [
    { text: "Get back to Jordan with a decision", owner: "raj", at: "raj-close", quote: "We'll get back to you within a couple of days", due: "D-1", dueText: "within a couple of days" },
  ],
  manualActionItems: [
    { text: "Submit scorecard with hire recommendation for Jordan Reyes", owner: "raj", due: "D-2", status: "done" },
    { text: "Schedule Jordan's final round with Maya", owner: "raj", due: "D+2" },
  ],
  highlights: [
    { at: "jordan-lag", label: "Found queue lag with a nudge" },
    { at: "jordan-drift", label: "Good idea: measure fast-path drift against the nightly re-cluster" },
  ],
  clips: [{ slug: "jordan-incremental-clustering", title: "Candidate on incremental clustering", from: "priya-twist", to: "jordan-drift", views: 6, by: "priya" }],
  knowledge: {
    overview: "Strong system design interview. Jordan designed an idempotent, fair ingest pipeline, independently proposed fast-path/slow-path clustering with drift measurement, and gave a textbook zero-downtime migration answer. He needed a nudge to name queue lag as the key metric.",
    topics: [
      { title: "Background", summary: "6 years at a payments company; owns event processing; eliminated duplicate charges with idempotency keys.", from: "jordan-background", to: "jordan-idempotency" },
      { title: "Ingest design", summary: "Durable queue, dedupe on source + external ID, per-customer fairness; found queue lag after a prompt.", from: "raj-problem", to: "jordan-lag" },
      { title: "Incremental clustering", summary: "Fast-path assignment plus nightly re-cluster; measure drift between them.", from: "priya-twist", to: "jordan-drift" },
      { title: "Migrations and questions", summary: "Expand/migrate/contract; asked candidly about on-call.", from: "raj-migration", to: "raj-honest" },
    ],
    decisions: [],
    openQuestions: [["How much ML infrastructure experience does Jordan have beyond this discussion?", "priya-twist"]],
    speakerContributions: { jordan: "Candidate.", raj: "System design and migration questions.", priya: "Clustering follow-up." },
  },
  summaries: {
    interview: {
      background: [["Six years at a payments company; owns the event processing platform (Go, Postgres, queue).", "jordan-background"]],
      technical: [
        ["Exactly-once effects via idempotency keys recorded in the same transaction.", "jordan-idempotency"],
        ["Ingest design: durable queue, unique source + external ID, scaling on depth, per-customer fairness.", "jordan-design", "jordan-fairness"],
        ["Independently proposed incremental assignment and a drift metric.", "jordan-incremental", "jordan-drift"],
        ["Zero-downtime migration: expand, backfill in batches, contract.", "jordan-migration"],
      ],
      communication: [["Structured, thought out loud, took the hint on monitoring gracefully; asked a candid question about on-call.", "jordan-lag", "jordan-oncall-q"]],
      strengths: [
        ["Deep, practical reliability instincts.", "jordan-idempotency"],
        ["Product-aware ideas (drift measurement).", "jordan-drift"],
      ],
      concerns: [["Didn't name queue lag unprompted.", "jordan-lag"], ["ML infrastructure depth not yet tested.", "priya-twist"]],
      recommendation: ["Hire (high confidence). Final round with Maya."],
    },
  },
});

export const interviewDesigner = defineMeeting({
  key: "interview-designer-sofia",
  title: "Interview: Senior Product Designer (Sofia Marin)",
  meetingType: "interview",
  defaultTemplate: "interview",
  platform: "google_meet",
  owner: D("marcus"),
  startedAt: "D-7@17:00",
  scheduledMin: 30,
  participants: {
    marcus: staff("marcus"),
    maya: staff("maya"),
    sofia: { name: "Sofia Marin", email: "sofia.marin@mail.example", title: "Candidate, Senior Product Designer", external: true },
  },
  script: [
    ["marcus", "Hi Sofia, welcome. I'm Marcus, I lead design, and Maya leads product. We'd love to start with a project from your portfolio, then we'll do a small critique exercise together."],
    [
      "sofia",
      "Great. I'll walk you through the analytics redesign I led at a fintech company. They had a dashboard with forty-two charts on the home page. Nobody used it. Our research showed that people only looked at three of them, and even then mostly to check nothing was on fire.",
      "sofia-project",
    ],
    ["maya", "~Forty-two charts. Wow."],
    [
      "sofia",
      "So we redesigned the home around questions instead of charts. 'Is anything unusual today?', 'What changed this week?'. Each question had one answer and a link to the detail. Weekly active usage of the dashboard went from about fifteen percent to fifty-five percent.",
      "sofia-result",
    ],
    ["marcus", "How did you decide which questions?"],
    [
      "sofia",
      "Twenty interviews, and then a diary study for two weeks, where people logged every time they opened the dashboard and why. The questions came straight from the diaries. I didn't invent any of them.",
      "sofia-research",
    ],
    ["maya", "I love that. How did you handle the power users who wanted the forty-two charts back?"],
    [
      "sofia",
      "We kept an 'all charts' view one click away, and we tracked it. After two months, it was under five percent of sessions, so we stopped maintaining half of the charts.",
      "sofia-powerusers",
    ],
    ["marcus", "Okay, the exercise. I'll share a screen from our current work. It's an early version of our themes home. Talk us through your honest reaction."],
    { pause: 10000 },
    [
      "sofia",
      "First reaction, it's much calmer than most analytics products, which I like. My main question is the growth arrow. Growth relative to what? Last week? Last month? And is a theme growing from two to four comments shown the same as one growing from two hundred to four hundred?",
      "sofia-critique-growth",
    ],
    ["marcus", "~That's a great question. Right now, yes, they look the same."],
    [
      "sofia",
      "I'd make the time period explicit, and I'd weight the arrow by volume, or at least show the absolute numbers on hover. Otherwise small themes will look alarming and people will stop trusting the arrows.",
      "sofia-suggest",
    ],
    [
      "sofia",
      "Second, the quotes are the most human part of the card, but they're at the bottom. I'd test moving one quote up, right under the label.",
      "sofia-quotes",
    ],
    ["maya", "What would worry you about working on a product like ours?"],
    [
      "sofia",
      "Honestly, I haven't worked much on admin and enterprise settings. Permissions, SSO setup, that kind of thing. I know it matters for your customers, and I'd need to ramp up there.",
      "sofia-gap",
    ],
    ["maya", "That's an honest answer, thank you."],
    ["marcus", "Thanks Sofia. We'll be in touch about next steps this week.", "marcus-close"],
  ],
  actionItems: [
    { text: "Follow up with Sofia about next steps", owner: "marcus", at: "marcus-close", quote: "We'll be in touch about next steps this week", due: "D-4", dueText: "this week", status: "done" },
  ],
  manualActionItems: [
    { text: "Invite Sofia to the collaboration round with the squad", owner: "marcus", status: "done" },
    { text: "Fix the growth arrow: explicit time period and volume-weighted trend (from Sofia's critique)", owner: "marcus" },
  ],
  highlights: [{ at: "sofia-critique-growth", label: "Sharp critique: growth relative to what?" }],
  clips: [{ slug: "sofia-growth-arrow-critique", title: "Candidate critique of the growth arrow", from: "sofia-critique-growth", to: "sofia-suggest", views: 9, by: "marcus" }],
  knowledge: {
    overview: "Sofia presented a research-driven redesign that lifted dashboard weekly usage from 15% to 55%, and gave a sharp critique of the themes growth arrow. Her gap is enterprise admin and settings experience. She moves to the next round.",
    topics: [
      { title: "Portfolio", summary: "Replaced 42 charts with question-led home; WAU 15% to 55%; diary study-driven.", from: "sofia-project", to: "sofia-powerusers" },
      { title: "Critique exercise", summary: "The growth arrow needs an explicit period and volume weighting; move a quote up.", from: "sofia-critique-growth", to: "sofia-quotes" },
      { title: "Gaps", summary: "Limited enterprise admin experience.", from: "sofia-gap", to: "sofia-gap" },
    ],
    decisions: [["Sofia advances to the collaboration round.", "sofia-gap"]],
    openQuestions: [["Can Sofia ramp on enterprise admin surfaces (SSO setup, permissions) quickly?", "sofia-gap"]],
    speakerContributions: { sofia: "Candidate.", marcus: "Ran the portfolio and critique.", maya: "Probed power users and risks." },
  },
  summaries: {
    interview: {
      background: [["Senior designer; led a fintech analytics redesign.", "sofia-project"]],
      technical: [
        ["Question-led home replaced 42 charts; weekly usage 15% to 55%.", "sofia-result"],
        ["Research rigor: 20 interviews plus a two-week diary study.", "sofia-research"],
        ["Managed power users with a tracked fallback view.", "sofia-powerusers"],
      ],
      communication: [["Direct, specific critique delivered constructively.", "sofia-critique-growth", "sofia-suggest"]],
      strengths: [["Evidence-driven simplification of data-dense UIs.", "sofia-research"], ["Spotted a real trust problem in our growth arrow.", "sofia-critique-growth"]],
      concerns: [["Little experience with enterprise admin and settings.", "sofia-gap"]],
      recommendation: ["Advance to the collaboration round (medium-high confidence)."],
    },
  },
});

export const interviewCsm = defineMeeting({
  key: "interview-csm-andre",
  title: "Interview: Customer Success Manager (Andre Wallace)",
  meetingType: "interview",
  defaultTemplate: "interview",
  platform: "teams",
  owner: D("tom"),
  startedAt: "D-11@15:00",
  scheduledMin: 30,
  participants: {
    tom: staff("tom"),
    aisha: staff("aisha"),
    andre: { name: "Andre Wallace", email: "andre.wallace@mail.example", title: "Candidate, Customer Success Manager", external: true },
  },
  script: [
    ["tom", "Hi Andre, thanks for coming in. I'm Tom, I lead customer success, and Aisha leads sales. We'll talk about your background, then do a short role play."],
    [
      "andre",
      "Thanks for having me. I've been a CSM for four years at an HR software company. I manage about forty mid-market accounts, and my net revenue retention last year was a hundred and eight percent.",
      "andre-background",
    ],
    ["aisha", "What's behind the hundred and eight?"],
    [
      "andre",
      "Mostly expansion into new departments. I run a quarterly business review with every account, and I bring their own usage data. When a team is getting value, I ask who else in the company has the same problem. That's where most of the expansion came from.",
      "andre-expansion",
    ],
    ["tom", "Okay, the role play. I'm going to be a frustrated customer, and you're my CSM. Ready?"],
    ["andre", "Ready."],
    [
      "tom",
      "Andre, honestly, I'm thinking about not renewing. Your auto-tagging is basically random. My team stopped using it months ago. We're paying for something we export to a spreadsheet anyway.",
      "tom-roleplay",
    ],
    [
      "andre",
      "Thank you for telling me directly, I'd much rather hear this now than at renewal. Can I ask a few questions so I understand it properly? When you say the tags are random, can you give me an example of one that was wrong recently?",
      "andre-questions",
    ],
    ["tom", "Sure. Billing complaints get tagged as 'onboarding' half the time. Things like that."],
    [
      "andre",
      "That's really helpful. And when your team exports to the spreadsheet, what do they do with it? Who looks at it?",
    ],
    ["tom", "One of my managers turns it into slides for our weekly exec meeting. Takes her half a day."],
    [
      "andre",
      "Okay. So the real problem isn't the tags, it's that getting a weekly picture for your execs takes half a day. Here's what I'd suggest. Let me look at your tagging setup with our support team this week, because it sounds like the rules may be misconfigured. And I'll find out whether you can get early access to the new theme clustering, which is built for exactly that weekly picture.",
      "andre-plan",
    ],
    ["tom", "Okay. And if that doesn't work?"],
    ["andre", "Then we should talk about it honestly, and I'll help you make the best decision for your team, even if that's not renewing. But I'd like the chance to fix it first."],
    ["tom", "~Okay, stepping out of the role play. That was really good."],
    ["aisha", "Agreed. What's your experience with larger enterprise accounts?"],
    [
      "andre",
      "Limited, honestly. My biggest account was about two thousand employees. I haven't managed a multi-stakeholder enterprise renewal with procurement and security reviews. I'd want to shadow someone on those.",
      "andre-gap",
    ],
    ["tom", "That's fair. Thanks Andre, we'll be in touch soon.", "tom-close"],
  ],
  actionItems: [
    { text: "Get back to Andre with a decision", owner: "tom", at: "tom-close", quote: "we'll be in touch soon", status: "done" },
  ],
  manualActionItems: [{ text: "Make an offer to Andre; plan enterprise renewal shadowing for onboarding", owner: "tom", status: "done" }],
  highlights: [{ at: "andre-plan", label: "Reframed churn risk around the real job" }],
  clips: [{ slug: "andre-churn-roleplay", title: "Role play: handling a churn-risk customer", from: "tom-roleplay", to: "andre-plan", views: 14, by: "tom" }],
  knowledge: {
    overview: "Andre (4 years CSM, 108% NRR) handled a churn-risk role play well: he asked diagnostic questions and reframed the problem as the weekly exec picture. He's limited on enterprise renewals. Recommendation: hire, with shadowing.",
    topics: [
      { title: "Background", summary: "HR software CSM, ~40 mid-market accounts, 108% NRR via departmental expansion.", from: "andre-background", to: "andre-expansion" },
      { title: "Role play", summary: "Frustrated customer about random tags; Andre diagnosed and proposed a fix plus early access.", from: "tom-roleplay", to: "andre-plan" },
      { title: "Gap", summary: "Limited enterprise multi-stakeholder renewal experience.", from: "andre-gap", to: "andre-gap" },
    ],
    decisions: [["Proceed to offer.", "andre-gap"]],
    openQuestions: [],
    speakerContributions: { andre: "Candidate.", tom: "Ran the role play.", aisha: "Probed expansion and enterprise experience." },
  },
  summaries: {
    interview: {
      background: [["Four years as a CSM at an HR software company; ~40 mid-market accounts; 108% NRR.", "andre-background"]],
      technical: [
        ["Expansion playbook: QBRs with usage data, then asking who else has the problem.", "andre-expansion"],
        ["Role play: asked for concrete examples before proposing anything.", "andre-questions"],
        ["Reframed the complaint to the real job (the weekly exec picture) and offered a concrete plan.", "andre-plan"],
      ],
      communication: [["Calm, direct and honest, including about possibly not renewing.", "andre-plan"]],
      strengths: [["Diagnostic questioning.", "andre-questions"], ["Commercial instinct for expansion.", "andre-expansion"]],
      concerns: [["Limited enterprise renewal experience (procurement, security reviews).", "andre-gap"]],
      recommendation: ["Hire (high confidence), with shadowing on enterprise renewals."],
    },
  },
});
