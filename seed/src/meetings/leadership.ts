import { defineMeeting } from "../dsl";
import { D, staff } from "../workspace";

export const leadershipSync = defineMeeting({
  key: "leadership-sync-weekly",
  title: "Weekly leadership sync",
  meetingType: "general",
  defaultTemplate: "exec_brief",
  platform: "zoom",
  owner: D("chris"),
  startedAt: "D-7@16:00",
  scheduledMin: 30,
  participants: {
    chris: staff("chris"),
    maya: staff("maya"),
    aisha: staff("aisha"),
    raj: staff("raj"),
    tom: staff("tom"),
    helen: staff("helen"),
  },
  script: [
    ["chris", "Morning everyone. Let's go around quickly. Aisha, pipeline first?"],
    [
      "aisha",
      "Q4 pipeline is about one point two million. The two biggest deals, Globex and Arcadia, together around four hundred and twenty thousand, are both blocked on SAML SSO. Without SSO, I'd call both of them unlikely this quarter.",
      "aisha-pipeline",
    ],
    ["chris", "That's a third of the pipeline behind one feature."],
    [
      "maya",
      "It is. We're doing a cross-functional alignment meeting next week to make the SSO versus Jira call, because we can't staff both. I'll come out of it with a decision and a date.",
      "maya-alignment",
    ],
    ["chris", "Good. I'd like that decision in writing to this group the same day.", "chris-ask"],
    [
      "tom",
      "On retention. Net revenue retention is ninety-seven percent for the quarter, down from a hundred and two. I'm finishing an analysis of forty-one churn and downgrade conversations. The early read is that the top reason is 'nobody reads the feedback', not missing features.",
      "tom-nrr",
    ],
    ["helen", "~Ninety-seven is below plan. What's the plan to get it back?"],
    [
      "tom",
      "Short term, a save play for the at-risk accounts, starting with Brightline. Longer term, honestly, Insights 2.0 is the fix, because it attacks the top churn reason directly.",
      "tom-save",
    ],
    [
      "raj",
      "On engineering. The outage follow-ups are mostly done, the lag alert shipped. The bigger issue is on-call load. With five engineers, it's heavy, and we're asking a lot of the team.",
      "raj-oncall",
    ],
    [
      "maya",
      "Related ask, Chris. Can we accelerate the staff data engineer role? It helps on-call and it helps the clustering work.",
      "maya-hire-ask",
    ],
    ["chris", "Helen, can we afford to open that this month instead of next quarter?"],
    [
      "helen",
      "Yes, if we're comfortable pushing the second marketing hire back a quarter. That's the trade-off.",
      "helen-tradeoff",
    ],
    ["chris", "Let's do it. Open the staff data engineer role now, push the marketing hire.", "chris-hire-decision"],
    [
      "helen",
      "One more thing from me. Before anyone announces pricing for the AI features, I need a cost model. What does the AI actually cost us per customer, and what happens to margin as they grow.",
      "helen-costs",
    ],
    [
      "maya",
      "Understood. I'll get cost numbers from Priya, and you and I can work on pricing together before it goes anywhere.",
      "maya-costs",
    ],
    ["chris", "Good. Thanks all. Short and useful."],
  ],
  actionItems: [
    { text: "Send the SSO vs Jira decision and date to the leadership group the same day it's made", owner: "maya", at: "maya-alignment", quote: "I'll come out of it with a decision and a date", status: "done" },
    { text: "Get AI cost numbers from Priya and build the pricing model with Helen", owner: "maya", at: "maya-costs", quote: "I'll get cost numbers from Priya", status: "done" },
    { text: "Run a save play for at-risk accounts, starting with Brightline", owner: "tom", at: "tom-save", quote: "a save play for the at-risk accounts, starting with Brightline" },
  ],
  manualActionItems: [{ text: "Open the staff data engineer req this month", owner: "helen", status: "done" }],
  highlights: [
    { at: "aisha-pipeline", label: "A third of Q4 pipeline blocked on SSO" },
    { at: "tom-nrr", label: "NRR 97%, down from 102%" },
  ],
  knowledge: {
    overview: "Leadership sync: a third of the $1.2M Q4 pipeline is blocked on SAML SSO, NRR fell to 97%, and on-call load is heavy. Chris approved opening the staff data engineer role now; Helen needs an AI cost model before any pricing.",
    topics: [
      { title: "Pipeline", summary: "$1.2M Q4 pipeline; Globex and Arcadia (~$420K) blocked on SSO.", from: "aisha-pipeline", to: "chris-ask" },
      { title: "Retention", summary: "NRR 97% (from 102%); top churn reason is unread feedback; Brightline save play.", from: "tom-nrr", to: "tom-save" },
      { title: "Engineering and hiring", summary: "On-call load is heavy; staff data engineer role accelerated, marketing hire pushed.", from: "raj-oncall", to: "chris-hire-decision" },
      { title: "AI pricing", summary: "A cost model is required before pricing announcements.", from: "helen-costs", to: "maya-costs" },
    ],
    decisions: [
      ["Open the staff data engineer role now; push the second marketing hire a quarter.", "chris-hire-decision"],
      ["No AI pricing announcement without a cost and margin model.", "helen-costs"],
    ],
    openQuestions: [["SSO or Jira this quarter? The alignment meeting will decide.", "maya-alignment"]],
    speakerContributions: {
      chris: "Chaired; approved the hiring trade-off.",
      aisha: "Pipeline and the SSO blocker.",
      tom: "NRR and churn analysis.",
      raj: "Outage follow-ups, on-call load.",
      helen: "Hiring trade-off; AI cost model requirement.",
      maya: "Alignment meeting; hiring ask.",
    },
  },
  summaries: {
    exec_brief: {
      tldr: [
        ["~$420K of the $1.2M Q4 pipeline is blocked on SAML SSO.", "aisha-pipeline"],
        ["NRR dropped to 97%; unread feedback, not missing features, drives churn.", "tom-nrr"],
      ],
      decisions: [["Staff data engineer role opens now; second marketing hire moves out a quarter.", "chris-hire-decision"]],
      risks: [["Enterprise deals slip without an SSO commitment.", "aisha-pipeline"], ["On-call load on a five-person platform team.", "raj-oncall"]],
      asks: [
        ["Maya: SSO vs Jira decision to this group the same day.", "chris-ask"],
        ["Helen: AI cost model before any pricing.", "helen-costs"],
      ],
    },
  },
});

/** The day after the alignment call: working the pricing proposal. */
export const pricingSession = defineMeeting({
  key: "pricing-ai-usage-caps",
  title: "Pricing working session: AI features",
  meetingType: "general",
  defaultTemplate: "exec_brief",
  platform: "google_meet",
  owner: D("maya"),
  startedAt: "D-1@18:00",
  scheduledMin: 30,
  participants: { maya: staff("maya"), helen: staff("helen"), elena: staff("elena"), aisha: staff("aisha") },
  script: [
    ["maya", "Thanks for making time. Goal today is to agree on the proposal I take to leadership. Helen, can you start with the cost model?"],
    [
      "helen",
      "Sure. Using Priya's numbers, the median workspace costs about a dollar eighty a month in AI costs. The largest is around fourteen dollars. Almost all of it is theme summaries. On our Pro price, that's fine for the median. The risk is the tail, a few very large accounts.",
      "helen-model",
    ],
    ["maya", "So three options. A, include AI in Pro with a usage cap on summaries. B, a separate AI add-on. C, per-seat pricing like the competitor."],
    [
      "aisha",
      "Please not C. Kestrel literally told us per-seat AI pricing was why they walked away from the competitor. Buyers hate it.",
      "aisha-no-seat",
    ],
    [
      "elena",
      "And from a positioning point of view, 'AI included in Pro' is a much stronger story than an add-on. It says this is the product, not an upsell.",
      "elena-included",
    ],
    ["helen", "~I'm fine with A, as long as the cap protects margin."],
    [
      "maya",
      "What cap works? At the alignment meeting I floated fifty thousand comments a month summarized in Pro.",
      "maya-cap",
    ],
    [
      "helen",
      "At fifty thousand, the worst case in Pro is about nine dollars a month in costs. That keeps us above our eighty percent gross margin target on every Pro account. Above the cap, accounts move to Business, which has room.",
      "helen-margin",
    ],
    ["aisha", "What happens when someone hits the cap mid-month? I don't want the feature to just stop working."],
    [
      "maya",
      "Good point. Clustering keeps working, since it's cheap. Only new summaries pause, with a clear message and an upgrade path. And we warn at eighty percent of the cap.",
      "maya-cap-behavior",
    ],
    ["elena", "~That's a much friendlier experience."],
    [
      "maya",
      "Okay, so the proposal is option A. AI included in Pro, summaries capped at fifty thousand comments a month, clustering unlimited, warning at eighty percent, Business uncapped. Everyone comfortable?",
      "maya-proposal",
    ],
    ["helen", "Yes."],
    ["aisha", "Yes. I'd like to test the message with two or three prospects before it's final."],
    ["maya", "Please do, but don't quote prices. Just the shape."],
    ["aisha", "I'll test the packaging shape with Kestrel and Juniper this week, no prices.", "aisha-test"],
    ["helen", "I'll run a sensitivity analysis on the cap, what if usage doubles next year.", "helen-sensitivity"],
    ["elena", "I'll draft the packaging copy for the pricing page, so leadership sees how it reads.", "elena-copy"],
    ["maya", "And I'll write up the proposal for the leadership review. Thanks all, this was fast.", "maya-writeup"],
  ],
  actionItems: [
    { text: "Test the packaging shape (no prices) with Kestrel and Juniper", owner: "aisha", at: "aisha-test", quote: "I'll test the packaging shape with Kestrel and Juniper this week", due: "D+4", dueText: "this week" },
    { text: "Run a margin sensitivity analysis if AI usage doubles", owner: "helen", at: "helen-sensitivity", quote: "I'll run a sensitivity analysis on the cap", due: "D+3" },
    { text: "Draft pricing-page packaging copy for the leadership review", owner: "elena", at: "elena-copy", quote: "I'll draft the packaging copy for the pricing page", due: "D+4" },
    { text: "Write up the AI pricing proposal for the leadership review", owner: "maya", at: "maya-writeup", quote: "I'll write up the proposal for the leadership review", due: "D+4" },
  ],
  highlights: [{ at: "maya-proposal", label: "Proposal: AI in Pro, 50K summary cap" }],
  clips: [{ slug: "ai-pricing-proposal", title: "The AI pricing proposal in one minute", from: "helen-margin", to: "maya-proposal", views: 8, by: "maya" }],
  knowledge: {
    overview: "Working session on AI pricing. The group chose to include AI in Pro, cap summaries at 50K comments/month (clustering unlimited, warning at 80%), and leave Business uncapped. That keeps the worst-case Pro AI cost around $9/month, inside the 80% margin target.",
    topics: [
      { title: "Cost model", summary: "Median $1.80/month, largest $14; almost all cost is summaries.", from: "helen-model", to: "helen-model" },
      { title: "Options", summary: "Per-seat rejected (Kestrel walked from it); 'AI included' is the stronger story.", from: "aisha-no-seat", to: "elena-included" },
      { title: "Cap design", summary: "50K comments/month keeps worst-case at ~$9; summaries pause at the cap, clustering continues; 80% warning.", from: "maya-cap", to: "maya-cap-behavior" },
    ],
    decisions: [
      ["Recommend: AI included in Pro with summaries capped at 50K comments/month; clustering unlimited; Business uncapped.", "maya-proposal"],
      ["No per-seat AI pricing.", "aisha-no-seat"],
    ],
    openQuestions: [["Does the cap hold if usage doubles next year?", "helen-sensitivity"]],
    speakerContributions: {
      helen: "Cost and margin model.",
      aisha: "Buyer reaction to per-seat pricing; will test the shape.",
      elena: "Positioning of 'AI included'.",
      maya: "Framed the options and the cap behavior.",
    },
  },
  summaries: {
    exec_brief: {
      tldr: [["Proposal: AI included in Pro, with AI summaries capped at 50K comments/month; clustering unlimited.", "maya-proposal"]],
      decisions: [["No per-seat AI pricing.", "aisha-no-seat"], ["Worst-case Pro AI cost ~$9/month, above the 80% margin target.", "helen-margin"]],
      risks: [["Margin if usage doubles, being modeled.", "helen-sensitivity"]],
      asks: [["Leadership review of the proposal this week.", "maya-writeup"]],
    },
  },
});

/** Churn-risk account after the outage. */
export const brightlineCheckin = defineMeeting({
  key: "brightline-checkin",
  title: "Brightline Retail: check-in",
  meetingType: "general",
  defaultTemplate: "general",
  platform: "teams",
  owner: D("tom"),
  startedAt: "D-10@17:30",
  scheduledMin: 30,
  participants: {
    tom: staff("tom"),
    maya: staff("maya"),
    olivia: { name: "Olivia Grant", email: "olivia.grant@brightline.example", title: "Director of Customer Experience", company: "Brightline Retail", external: true },
  },
  script: [
    ["tom", "Olivia, thanks for making time. Maya wanted to join personally, after the delay last week."],
    [
      "maya",
      "First, I want to apologize properly. Your team was the one who told us ingest was stuck, and the first reply you got from us was vague. That's not the experience you should have had.",
      "maya-apology",
    ],
    ["olivia", "I appreciate you saying that. Honestly, the delay itself was annoying, but it's not the main issue for us."],
    ["tom", "What is the main issue?"],
    [
      "olivia",
      "The tagging. We turned auto-tagging off for our support team about two months ago. The tags felt random. Billing issues tagged as shipping, that kind of thing. So now my team exports everything and sorts it by hand, which is exactly what we bought your product to avoid.",
      "olivia-tagging",
    ],
    ["maya", "~That's really useful to hear directly."],
    [
      "olivia",
      "I'll be honest with you both. Our renewal is in about three months, and I'm being asked whether we should look at alternatives. One of the AI tools pitched us last month.",
      "olivia-renewal",
    ],
    [
      "maya",
      "Thank you for being straight with us. Can I show you something early? We've been working on a new theme clustering model, and it's a big step up from the old tagger. It groups feedback into themes automatically, and you can merge or split them if they're wrong.",
      "maya-preview",
    ],
    { pause: 12000 },
    ["olivia", "This is much closer to what I actually need. Can my team use this?"],
    [
      "maya",
      "Not quite yet. We're planning a private beta with a small group of design partners. I'd like Brightline to be one of them, if you're open to it. Retail is exactly where we need more data.",
      "maya-invite",
    ],
    ["olivia", "~I'd be interested. It would change the renewal conversation for sure."],
    [
      "tom",
      "In the meantime, I don't want you sorting by hand for three months. Let me have our support team audit your tagging rules this week. I suspect some of the rules are misconfigured, which would explain the shipping and billing mix-ups.",
      "tom-audit",
    ],
    ["olivia", "That would help. Thank you."],
    ["tom", "I'll add Brightline to the design partner shortlist and schedule the tagging audit.", "tom-shortlist"],
  ],
  actionItems: [
    { text: "Audit Brightline's tagging rules with support", owner: "tom", at: "tom-audit", quote: "Let me have our support team audit your tagging rules this week", due: "D-6", dueText: "this week", status: "done" },
    { text: "Add Brightline to the design partner shortlist", owner: "tom", at: "tom-shortlist", quote: "I'll add Brightline to the design partner shortlist", status: "done" },
  ],
  highlights: [
    { at: "olivia-renewal", label: "Brightline renewal at risk in ~3 months" },
    { at: "olivia-tagging", label: "Turned off tagging: 'exactly what we bought your product to avoid'" },
  ],
  clips: [{ slug: "brightline-tagging-pain", title: "Brightline on why they turned tagging off", from: "olivia-tagging", to: "olivia-renewal", views: 26, by: "tom" }],
  knowledge: {
    overview: "Churn-risk check-in after the ingest delay. Brightline turned auto-tagging off two months ago and sorts feedback by hand; renewal is in ~3 months with alternatives under review. A preview of theme clustering landed, and Brightline was invited to the design partner beta. A tagging audit covers the gap until then.",
    topics: [
      { title: "Apology", summary: "Maya apologized for the delay and the vague first response.", from: "maya-apology", to: "maya-apology" },
      { title: "Tagging problem", summary: "Auto-tagging turned off; manual sorting; renewal in ~3 months, alternatives pitched.", from: "olivia-tagging", to: "olivia-renewal" },
      { title: "Theme clustering preview", summary: "The preview landed; invited to the design partner beta.", from: "maya-preview", to: "maya-invite" },
      { title: "Interim fix", summary: "Support to audit the tagging rules.", from: "tom-audit", to: "tom-shortlist" },
    ],
    decisions: [["Brightline is invited as a design partner.", "maya-invite", "tom-shortlist"]],
    openQuestions: [["Will the tagging audit fix enough to hold the renewal until the beta?", "tom-audit"]],
    speakerContributions: {
      olivia: "Explained the tagging pain and renewal risk.",
      maya: "Apologized; previewed themes; invited to the beta.",
      tom: "Owns the tagging audit and shortlist.",
    },
  },
  summaries: {
    exec_brief: {
      tldr: [
        ["Brightline's renewal (~3 months out) is at risk: they turned off tagging and sort feedback by hand.", "olivia-tagging", "olivia-renewal"],
        ["The theme clustering preview landed; they're invited to the design partner beta.", "maya-preview", "maya-invite"],
      ],
      decisions: [["Brightline joins the design partner shortlist.", "tom-shortlist"]],
      risks: [["An AI competitor is already pitching them.", "olivia-renewal"]],
      asks: ["None."],
    },
  },
});
