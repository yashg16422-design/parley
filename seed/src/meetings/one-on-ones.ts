import { defineMeeting } from "../dsl";
import { D, staff } from "../workspace";

const base = {
  meetingType: "one_on_one" as const,
  defaultTemplate: "one_on_one",
  platform: "google_meet" as const,
  owner: D("maya"),
  scheduledMin: 25,
};

export const oneOnOneRaj = defineMeeting({
  ...base,
  key: "1on1-maya-raj",
  title: "Maya / Raj 1:1",
  startedAt: "D-4@19:30",
  participants: { maya: staff("maya"), raj: staff("raj") },
  script: [
    ["maya", "Hey Raj. How are you doing, honestly? It's been a heavy couple of weeks."],
    [
      "raj",
      "Honestly, tired. The outage took a lot out of the team, and out of me. But the postmortem went better than I expected. People were really constructive about it.",
      "raj-tired",
    ],
    [
      "maya",
      "I thought the postmortem was excellent. Clear, no blame, and the follow-ups were specific. Chris mentioned it to me unprompted, which he doesn't usually do.",
      "maya-praise",
    ],
    ["raj", "That's good to hear. Thank you."],
    ["maya", "What's on your mind for this week?"],
    [
      "raj",
      "Two things. First, on-call. With five engineers, everyone is on call every fifth week, and after the outage, people are nervous about it. Sam hasn't really slept properly on his last two shifts. I don't think that's sustainable.",
      "raj-oncall",
    ],
    ["maya", "What would make it sustainable?"],
    [
      "raj",
      "Either more people in the rotation, or fewer pages. We're working on fewer pages, the queue lag alert helped. But realistically we need the staff data engineer hire, and maybe share the rotation with the growth team.",
      "raj-rotation",
    ],
    [
      "maya",
      "Okay. I'll talk to Chris about accelerating the staff data engineer role, and I'll ask the growth team lead about a shared rotation. I can't promise the second one, but I'll push.",
      "maya-oncall-commit",
    ],
    [
      "raj",
      "Thanks. The second thing is the alignment meeting. I'm worried I'm going to walk in and be asked to do SSO and Jira and Insights all at once. We can't. I'd rather say that clearly than nod and then miss.",
      "raj-worry",
    ],
    [
      "maya",
      "I want you to say exactly that. Can you bring actual numbers? People, weeks, what's already committed. It's much easier for everyone to make a trade-off when the math is on the screen.",
      "maya-numbers",
    ],
    ["raj", "Yes. I'll put together a capacity breakdown before the alignment meeting.", "raj-capacity-commit"],
    ["maya", "Can I also ask for some feedback? Anything I could be doing differently for you or the team?"],
    [
      "raj",
      "Honestly, one thing. Sometimes priorities change after a conversation between you and sales that I'm not part of. By the time it reaches me, it's already decided. I'd rather be in the room earlier, even just to say 'that's three weeks, not one.'",
      "raj-feedback",
    ],
    [
      "maya",
      "That's fair, and thank you for saying it. I'll add you to the weekly roadmap sync with Aisha. If that ends up being too much of your time, tell me.",
      "maya-sync-commit",
    ],
    ["raj", "That would really help."],
    ["maya", "Last thing, growth. Last time you mentioned wanting to move toward engineering management. Is that still where your head is?"],
    [
      "raj",
      "Yes. I like the technical work, but the part I've enjoyed most this year is helping Sam and Lena grow. I'd like to be managing the platform team formally within a year.",
      "raj-growth",
    ],
    [
      "maya",
      "I think that's very realistic. Two concrete things. Lead the hiring loop for the staff data engineer, end to end. And let Lena lead the day to day on SAML, with you as the reviewer, rather than doing it yourself. That's the muscle you'll need.",
      "maya-growth",
    ],
    ["raj", "~Letting go of the SAML work will be hard. But yes, that makes sense."],
    ["maya", "Good. Let's check in on all of this in two weeks."],
  ],
  actionItems: [
    { text: "Talk to Chris about accelerating the staff data engineer hire; ask growth about a shared on-call rotation", owner: "maya", at: "maya-oncall-commit", quote: "I'll talk to Chris about accelerating the staff data engineer role", status: "done" },
    { text: "Prepare a capacity breakdown for the alignment meeting", owner: "raj", at: "raj-capacity-commit", quote: "I'll put together a capacity breakdown before the alignment meeting", due: "D-2", dueText: "before the alignment meeting", status: "done" },
    { text: "Add Raj to the weekly roadmap sync with Aisha", owner: "maya", at: "maya-sync-commit", quote: "I'll add you to the weekly roadmap sync with Aisha", status: "done" },
    { text: "Lead the staff data engineer hiring loop end to end", owner: "raj", at: "maya-growth", quote: "Lead the hiring loop for the staff data engineer, end to end" },
  ],
  knowledge: {
    overview: "Raj is tired after the outage. On-call every fifth week isn't sustainable, and he wants to be in priority conversations earlier. He'll bring capacity numbers to the alignment meeting, and he's growing toward managing the platform team.",
    topics: [
      { title: "Outage aftermath", summary: "The team is tired; the postmortem was well received, including by Chris.", from: "raj-tired", to: "maya-praise" },
      { title: "On-call load", summary: "One-in-five rotation is straining the team; needs the staff data engineer hire or a shared rotation.", from: "raj-oncall", to: "maya-oncall-commit" },
      { title: "Alignment meeting prep", summary: "Raj will show capacity math rather than agree to SSO, Jira and Insights at once.", from: "raj-worry", to: "raj-capacity-commit" },
      { title: "Feedback and growth", summary: "Wants to be in roadmap conversations earlier; aiming for formal management within a year.", from: "raj-feedback", to: "maya-growth" },
    ],
    decisions: [["Raj joins the weekly roadmap sync with Aisha.", "maya-sync-commit"], ["Lena leads SAML day to day, with Raj reviewing.", "maya-growth"]],
    openQuestions: [["Will the growth team share the on-call rotation?", "maya-oncall-commit"]],
    speakerContributions: { raj: "Raised on-call load, the capacity risk and the feedback on decision-making.", maya: "Committed to hiring and rotation help; set growth steps." },
  },
  summaries: {
    one_on_one: {
      wins: [["The outage postmortem was clear and blameless; Chris called it out.", "maya-praise"]],
      concerns: [
        ["On-call every fifth week is wearing the team down after the outage.", "raj-oncall"],
        ["Worried about being asked to deliver SSO, Jira and Insights together.", "raj-worry"],
      ],
      feedback: [
        ["Raj to Maya: priorities sometimes change in sales conversations he isn't part of; he wants to be in the room earlier.", "raj-feedback"],
        ["Maya to Raj: bring the capacity math, not just a 'no'.", "maya-numbers"],
      ],
      growth: [["Aiming to manage the platform team formally within a year: run the staff data engineer loop and let Lena lead SAML.", "raj-growth", "maya-growth"]],
      follow_ups: [
        ["Maya: push to accelerate the staff data engineer hire; ask growth about a shared rotation.", "maya-oncall-commit"],
        ["Raj: capacity breakdown for the alignment meeting.", "raj-capacity-commit"],
        ["Maya: add Raj to the roadmap sync with Aisha.", "maya-sync-commit"],
      ],
    },
  },
});

export const oneOnOneElena = defineMeeting({
  ...base,
  key: "1on1-maya-elena",
  title: "Maya / Elena 1:1",
  startedAt: "D-8@15:00",
  participants: { maya: staff("maya"), elena: staff("elena") },
  script: [
    ["maya", "Hi Elena! How's your week going?"],
    [
      "elena",
      "Busy, but good. The webinar last week had four hundred signups, which is our best ever. And the competitive teardown is done, I'll share it after this.",
      "elena-webinar",
    ],
    ["maya", "Four hundred, that's great. Congratulations. What drove it?"],
    ["elena", "Honestly, the title. We called it 'Stop reading every support ticket,' and people clicked. It tells me the problem framing resonates more than feature names."],
    ["maya", "That's a really useful insight for Insights 2.0 messaging."],
    [
      "elena",
      "That's actually my main worry. I'm hearing about Insights 2.0 in pieces. A design screenshot here, a Slack thread there. I don't know the scope or the timing, and I'm supposed to be planning a launch.",
      "elena-worry",
    ],
    [
      "maya",
      "That's completely fair, and that's on me. We're having a cross-functional alignment meeting next week to lock scope, the beta, and the SSO question. I want you there with a slot on the agenda for the launch plan.",
      "maya-invite",
    ],
    ["elena", "~Yes, please. That's exactly what I need."],
    ["elena", "I'll draft a one-page launch plan before that meeting, so there's something concrete to react to.", "elena-plan-commit"],
    ["maya", "Perfect. What else is on your plate?"],
    [
      "elena",
      "The conference booth next month. It's a lot of logistics, and it's eating into launch prep. I don't think I can do both well.",
      "elena-stretched",
    ],
    [
      "maya",
      "Let's not have you do both. Can we bring in Ivy, the contractor you worked with on the website, for the booth logistics? I'll approve the budget.",
      "maya-ivy",
    ],
    ["elena", "That would help enormously. I'll reach out to Ivy this week.", "elena-ivy-commit"],
    ["maya", "Can I give you one piece of feedback on the positioning drafts?"],
    ["elena", "Of course."],
    [
      "maya",
      "They're strong, but they're long, and they lead with what we built. The webinar just proved people respond to the problem. I'd lead with a customer's words, and get to the product in the second paragraph.",
      "maya-feedback",
    ],
    ["elena", "That's fair. I've been writing for the product team, not for the buyer. I'll rework them."],
    ["maya", "And longer term, what do you want to be doing more of?"],
    [
      "elena",
      "Customer research. I'd love to own a proper research program, especially for naming and positioning. Right now we guess, then argue about it.",
      "elena-growth",
    ],
    [
      "maya",
      "I love that. Let's start small. Use the Insights 2.0 beta as your first research program. Talk to design partners about what they call things and what they'd pay for.",
      "maya-growth",
    ],
    ["elena", "That's a great first project. Thank you."],
  ],
  actionItems: [
    { text: "Draft a one-page Insights 2.0 launch plan before the alignment meeting", owner: "elena", at: "elena-plan-commit", quote: "I'll draft a one-page launch plan before that meeting", due: "D-2", status: "done" },
    { text: "Engage Ivy (contractor) for conference booth logistics", owner: "elena", at: "elena-ivy-commit", quote: "I'll reach out to Ivy this week", due: "D-5", dueText: "this week", status: "done" },
    { text: "Invite Elena to the alignment meeting with a launch slot", owner: "maya", at: "maya-invite", quote: "I want you there with a slot on the agenda for the launch plan", status: "done" },
  ],
  highlights: [{ at: "elena-webinar", label: "Webinar: 400 signups, best ever" }],
  knowledge: {
    overview: "Elena's webinar hit a record 400 signups on a problem-first title. She's getting Insights 2.0 context piecemeal and is stretched by the conference booth. Maya added her to the alignment meeting, approved a contractor, and pointed her toward owning customer research.",
    topics: [
      { title: "Wins", summary: "Record webinar signups; competitive teardown done.", from: "elena-webinar", to: "elena-webinar" },
      { title: "Launch context", summary: "Elena lacks scope and timing for Insights 2.0; she'll join the alignment meeting with a launch slot.", from: "elena-worry", to: "elena-plan-commit" },
      { title: "Workload", summary: "Booth logistics are crowding out launch prep; Ivy the contractor will take it.", from: "elena-stretched", to: "elena-ivy-commit" },
      { title: "Feedback and growth", summary: "Lead positioning with the customer problem; Elena wants to own customer research, starting with the beta.", from: "maya-feedback", to: "maya-growth" },
    ],
    decisions: [["Elena gets a launch slot in the alignment meeting.", "maya-invite"], ["Contractor budget approved for booth logistics.", "maya-ivy"]],
    openQuestions: [],
    speakerContributions: { elena: "Shared wins, the context gap and workload; wants a research program.", maya: "Gave positioning feedback; unblocked launch context and booth workload." },
  },
  summaries: {
    one_on_one: {
      wins: [["Webinar hit 400 signups (best ever) with a problem-first title; teardown done.", "elena-webinar"]],
      concerns: [
        ["Hearing about Insights 2.0 in fragments while expected to plan the launch.", "elena-worry"],
        ["Conference booth logistics crowding out launch prep.", "elena-stretched"],
      ],
      feedback: [
        ["Maya to Elena: positioning drafts are strong but long; lead with the customer's words.", "maya-feedback"],
        ["Elena to Maya (implicit): bring marketing in earlier on scope and timing.", "elena-worry"],
      ],
      growth: [["Wants to own customer research; the beta design partners are the first program.", "elena-growth", "maya-growth"]],
      follow_ups: [
        ["Elena: one-page launch plan before the alignment meeting.", "elena-plan-commit"],
        ["Elena: contact Ivy about the booth.", "elena-ivy-commit"],
        ["Maya: launch slot in the alignment agenda.", "maya-invite"],
      ],
    },
  },
});

export const oneOnOneDaniel = defineMeeting({
  ...base,
  key: "1on1-maya-daniel",
  title: "Maya / Daniel 1:1",
  startedAt: "D-5@21:00",
  participants: { maya: staff("maya"), daniel: staff("daniel") },
  script: [
    ["maya", "Hey Daniel. Morning for you, right? How's it going?"],
    [
      "daniel",
      "Morning, yes. Good. The Zendesk backfill shipped yesterday, so now new workspaces can import ninety days of history. It's hidden in settings for now, but it works.",
      "daniel-backfill",
    ],
    ["maya", "That's great. We should think about where that lives in onboarding."],
    [
      "daniel",
      "Agreed. The other thing is the SSO versus Jira one-pager. I have a draft, and I'd love your eyes on it before the alignment meeting.",
      "daniel-onepager",
    ],
    ["maya", "Sure. What's your recommendation?"],
    [
      "daniel",
      "SSO first. But honestly I'm nervous about it. Tom's team has been asking about Jira for months, and I feel like I'm about to tell them no again.",
      "daniel-nervous",
    ],
    [
      "maya",
      "I get that. A couple of things. First, I read the draft this morning. It's good, but it buries the recommendation on page two. Lead with it. And add Aisha's pipeline numbers, because the revenue case is what makes SSO obvious.",
      "maya-feedback",
    ],
    ["daniel", "That makes sense. I'll get the pipeline numbers from Aisha and revise the one-pager.", "daniel-revise"],
    [
      "maya",
      "Second, on Tom. Don't let him hear it for the first time in the meeting. I'll give him a preview beforehand. And think about whether there's a small Jira thing you can offer, so it's not just 'no.'",
      "maya-tom",
    ],
    [
      "daniel",
      "Actually, yes. A lot of the Jira requests are really just 'let me create an issue from this.' A one-way button would cover most of them, and it's small.",
      "daniel-button",
    ],
    ["maya", "Put that in the one-pager as part of the recommendation."],
    ["maya", "Anything you want from me? Feedback on how I'm managing?"],
    [
      "daniel",
      "One thing. I don't always know how you're weighing things when we prioritize. Revenue, retention, strategy. If I knew the criteria, I could bring you better recommendations, instead of guessing.",
      "daniel-feedback",
    ],
    [
      "maya",
      "That's a very good point. I'll write down the prioritization criteria I actually use and share them with the PM team. It'll help everyone, not just you.",
      "maya-criteria",
    ],
    ["daniel", "Thank you. And on growth, I'd really like to own SSO end to end. Requirements, rollout, the enterprise admin area, all of it."],
    [
      "maya",
      "I think you should. If the alignment meeting goes the way I expect, SSO is yours. Treat it as the start of an enterprise platform area you lead, not a one-off project.",
      "maya-growth",
    ],
    ["daniel", "That's exactly what I was hoping to hear."],
  ],
  actionItems: [
    { text: "Revise the SSO vs Jira one-pager: lead with the recommendation, add pipeline numbers, include the one-way Jira button", owner: "daniel", at: "daniel-revise", quote: "I'll get the pipeline numbers from Aisha and revise the one-pager", due: "D-2", status: "done" },
    { text: "Preview the SSO-first recommendation with Tom before the alignment meeting", owner: "maya", at: "maya-tom", quote: "I'll give him a preview beforehand", status: "done" },
    { text: "Write down and share the PM prioritization criteria", owner: "maya", at: "maya-criteria", quote: "I'll write down the prioritization criteria I actually use and share them with the PM team", due: "D+7" },
  ],
  knowledge: {
    overview: "Daniel shipped the Zendesk backfill and drafted the SSO vs Jira one-pager. Maya asked him to lead with the recommendation and the revenue case and to offer a one-way Jira button. She'll preview it with Tom and document her prioritization criteria. Daniel will own SSO end to end.",
    topics: [
      { title: "Zendesk backfill", summary: "Shipped; 90-day import hidden in settings for now.", from: "daniel-backfill", to: "daniel-backfill" },
      { title: "SSO vs Jira one-pager", summary: "Lead with SSO-first and pipeline numbers; add the one-way Jira button; preview with Tom.", from: "daniel-onepager", to: "daniel-button" },
      { title: "Feedback and growth", summary: "Daniel wants explicit prioritization criteria; he'll own SSO as the start of an enterprise platform area.", from: "daniel-feedback", to: "maya-growth" },
    ],
    decisions: [["Daniel will own SSO end to end if it's prioritized.", "maya-growth"]],
    openQuestions: [],
    speakerContributions: { daniel: "Shared the backfill win and one-pager; asked for prioritization criteria.", maya: "Gave one-pager feedback; will preview with Tom and write criteria." },
  },
  summaries: {
    one_on_one: {
      wins: [["Zendesk 90-day backfill shipped.", "daniel-backfill"]],
      concerns: [["Nervous that recommending SSO first means telling CS 'no' on Jira again.", "daniel-nervous"]],
      feedback: [
        ["Maya to Daniel: lead the one-pager with the recommendation and the revenue case.", "maya-feedback"],
        ["Daniel to Maya: make the prioritization criteria explicit.", "daniel-feedback"],
      ],
      growth: [["Own SSO end to end as the start of an enterprise platform area.", "maya-growth"]],
      follow_ups: [
        ["Daniel: revise the one-pager with pipeline numbers and the one-way Jira button.", "daniel-revise", "daniel-button"],
        ["Maya: preview the recommendation with Tom.", "maya-tom"],
        ["Maya: share prioritization criteria with the PM team.", "maya-criteria"],
      ],
    },
  },
});
