import { defineMeeting } from "../dsl";
import { D, staff } from "../workspace";

const squad = {
  maya: staff("maya"),
  raj: staff("raj"),
  priya: staff("priya"),
  marcus: staff("marcus"),
  sam: staff("sam"),
  lena: staff("lena"),
};

const base = {
  meetingType: "standup" as const,
  defaultTemplate: "standup",
  platform: "google_meet" as const,
  owner: D("maya"),
  scheduledMin: 15,
  title: "Insights squad standup",
  participants: squad,
};

/** About a week after the ingest outage: recovery work dominates. */
export const standupD8 = defineMeeting({
  ...base,
  key: "standup-d8",
  startedAt: "D-8@14:30",
  script: [
    ["maya", "Morning all. Let's keep it quick, I know a few of you have a long day. Sam, you want to start?"],
    [
      "sam",
      "Sure. Yesterday I finished the queue lag alert. It fires when ingest is more than five minutes behind, and it pages whoever's on call. It's in review now, I'm hoping to ship it today.",
      "sam-alert",
    ],
    ["raj", "~I'll review it right after this."],
    ["sam", "Thanks. Today, once it's out, I'm going back to the exports job refactor."],
    [
      "lena",
      "I'm on the online migrations work. I tested two tools on staging yesterday. One of them rewrote a big table without locking it, which is exactly what we want. Today I'm writing up the comparison so Raj can pick one.",
      "lena-migrations",
    ],
    ["maya", "Nice. Priya?"],
    [
      "priya",
      "I added a re-ranking step to the clustering model. On the eval set it moved precision from seventy-six to seventy-eight, which is a good sign. Today I want to run the full eval, but I'm blocked on GPU quota. The job keeps getting killed.",
      "priya-rerank",
    ],
    [
      "raj",
      "I can fix that. I'll raise the quota on the ML project this morning, it's just a settings change.",
      "raj-quota",
    ],
    ["priya", "Amazing, thank you."],
    [
      "marcus",
      "I'm on the second version of the themes home screen. I'm playing with making themes the default view instead of the feed. It's a bit controversial, so I'd love a few minutes with Maya later this week.",
      "marcus-themes-idea",
    ],
    ["maya", "Put something on my calendar, I'm very interested."],
    [
      "raj",
      "And me, I'm handing off on-call to Sam tomorrow, and I'm finishing the postmortem doc. I want it out before the end of the week.",
      "raj-postmortem",
    ],
    ["maya", "Great. Anything else? No? Okay, thanks everyone."],
  ],
  actionItems: [
    { text: "Ship the ingest queue lag alert (pages on-call when > 5 minutes behind)", owner: "sam", at: "sam-alert", quote: "I'm hoping to ship it today", due: "D-8", dueText: "today", status: "done" },
    { text: "Raise GPU quota on the ML project so the full eval can run", owner: "raj", at: "raj-quota", quote: "I'll raise the quota on the ML project this morning", due: "D-8", dueText: "this morning", status: "done" },
    { text: "Write up the online migration tool comparison", owner: "lena", at: "lena-migrations", quote: "Today I'm writing up the comparison so Raj can pick one", due: "D-8", dueText: "today", status: "done" },
    { text: "Publish the ingest outage postmortem", owner: "raj", at: "raj-postmortem", quote: "I'm finishing the postmortem doc", due: "D-6", dueText: "before the end of the week", status: "done" },
  ],
  highlights: [{ at: "marcus-themes-idea", label: "First mention: Themes as the default view" }],
  knowledge: {
    overview: "Post-outage recovery standup: the queue lag alert is almost out, online migration tools are being compared, and the re-ranking step moved precision to 78%.",
    topics: [
      { title: "Outage follow-ups", summary: "Queue lag alert in review; online migration tools tested on staging; postmortem due this week.", from: "sam-alert", to: "lena-migrations" },
      { title: "Model precision", summary: "Re-ranking moved precision from 76% to 78%; the full eval was blocked on GPU quota.", from: "priya-rerank", to: "raj-quota" },
      { title: "Themes-first idea", summary: "Marcus is exploring Themes as the default view.", from: "marcus-themes-idea", to: "marcus-themes-idea" },
    ],
    decisions: [],
    openQuestions: [["Should Themes replace the feed as the default view?", "marcus-themes-idea"]],
    speakerContributions: {
      sam: "Queue lag alert; then exports refactor.",
      lena: "Online migration tool comparison.",
      priya: "Re-ranking step, precision 78%; blocked on GPU quota.",
      raj: "Unblocking quota; postmortem; on-call handoff.",
      marcus: "Themes-first home screen v2.",
    },
  },
  summaries: {
    standup: {
      done: [
        ["Sam: queue lag alert built, in review.", "sam-alert"],
        ["Lena: tested two online migration tools on staging.", "lena-migrations"],
        ["Priya: re-ranking step, precision 76% to 78%.", "priya-rerank"],
      ],
      today: [
        ["Sam: ship the alert, then back to the exports refactor.", "sam-alert"],
        ["Lena: write the tool comparison for Raj.", "lena-migrations"],
        ["Marcus: themes home v2; wants time with Maya on Themes-as-default.", "marcus-themes-idea"],
        ["Raj: on-call handoff and the postmortem.", "raj-postmortem"],
      ],
      blockers: [["Priya: full eval blocked on GPU quota; Raj is raising it this morning.", "priya-rerank", "raj-quota"]],
    },
  },
});

/** The day before the alignment call. */
export const standupD3 = defineMeeting({
  ...base,
  key: "standup-d3",
  startedAt: "D-3@14:30",
  script: [
    ["maya", "Hi everyone. Big day tomorrow-ish with the alignment meeting, so let's be fast. Priya, you first today?"],
    [
      "priya",
      "Sure. I re-ran the full eval with the new embedding model and the re-ranking. We're at seventy-nine percent. So up from seventy-eight, but I was hoping for more.",
      "priya-79",
    ],
    ["maya", "Seventy-nine is still real progress. Is that the number for the alignment deck?"],
    [
      "priya",
      "Yes. I'll put the eval sheet together for the alignment meeting, with the failure examples, so people can see what the errors actually look like.",
      "priya-sheet",
    ],
    ["maya", "Perfect. Marcus?"],
    [
      "marcus",
      "Design crit is this afternoon for dashboard v3. The big thing is Themes as the default, plus a first pass at merge and split. And I'm on a new headset, so hopefully no robot voice this time.",
      "marcus-crit",
    ],
    ["raj", "~No promises."],
    [
      "sam",
      "I finished the exports refactor. The job queue is now generic, so other features can use it. That's probably useful for the clustering work too.",
      "sam-queue",
    ],
    ["raj", "~Very useful. That's exactly what the nightly re-cluster would run on."],
    [
      "lena",
      "I'm running the online migration tool against a staging copy of the events table. I'm blocked because the staging snapshot is three weeks old, and the table structure has changed since then.",
      "lena-blocked",
    ],
    ["raj", "I'll refresh the staging snapshot tonight. You'll have it in the morning.", "raj-snapshot"],
    ["lena", "Thanks."],
    [
      "raj",
      "And for me, I've been putting together capacity numbers for tomorrow. I'll be honest, we can't do SSO and Jira both this quarter. I'll show the math tomorrow.",
      "raj-capacity",
    ],
    ["maya", "Good, I'd rather hear it tomorrow than find out in a month. Thanks everyone."],
  ],
  actionItems: [
    { text: "Prepare the eval sheet with failure examples for the alignment meeting", owner: "priya", at: "priya-sheet", quote: "I'll put the eval sheet together for the alignment meeting", due: "D-2", dueText: "before the alignment meeting", status: "done" },
    { text: "Refresh the staging database snapshot for the migration test", owner: "raj", at: "raj-snapshot", quote: "I'll refresh the staging snapshot tonight", due: "D-3", dueText: "tonight", status: "done" },
  ],
  highlights: [{ at: "raj-capacity", label: "Raj: can't do SSO and Jira both this quarter" }],
  knowledge: {
    overview: "Standup the day before the alignment call: precision reached 79%, the generic job queue landed, and Raj previewed that SSO and Jira can't both fit this quarter.",
    topics: [
      { title: "Model precision", summary: "Full eval at 79% with the new embeddings and re-ranking.", from: "priya-79", to: "priya-sheet" },
      { title: "Design crit today", summary: "Dashboard v3: Themes as default and a first pass at merge/split.", from: "marcus-crit", to: "marcus-crit" },
      { title: "Platform", summary: "Exports refactor made the job queue generic; migration test blocked on a stale snapshot.", from: "sam-queue", to: "raj-snapshot" },
      { title: "Capacity preview", summary: "SSO and Jira can't both happen this quarter.", from: "raj-capacity", to: "raj-capacity" },
    ],
    decisions: [],
    openQuestions: [["SSO or Jira this quarter? To be decided at the alignment meeting.", "raj-capacity"]],
    speakerContributions: {
      priya: "Eval at 79%; preparing the eval sheet.",
      marcus: "Dashboard v3 crit this afternoon.",
      sam: "Generic job queue from the exports refactor.",
      lena: "Blocked on a stale staging snapshot.",
      raj: "Snapshot refresh; capacity preview.",
    },
  },
  summaries: {
    standup: {
      done: [
        ["Priya: full eval at 79% precision.", "priya-79"],
        ["Sam: exports refactor finished; the job queue is now generic.", "sam-queue"],
      ],
      today: [
        ["Priya: eval sheet with failure examples for the alignment meeting.", "priya-sheet"],
        ["Marcus: dashboard v3 design crit this afternoon.", "marcus-crit"],
        ["Raj: capacity numbers for the alignment meeting.", "raj-capacity"],
      ],
      blockers: [["Lena: staging snapshot three weeks old; Raj refreshing it tonight.", "lena-blocked", "raj-snapshot"]],
    },
  },
});

/** The day after the alignment call: SSO spike and beta prep underway. */
export const standupD1 = defineMeeting({
  ...base,
  key: "standup-d1",
  startedAt: "D-1@14:30",
  script: [
    ["maya", "Morning. First standup since we locked the plan, so let's check we're all moving. Raj?"],
    [
      "raj",
      "I started the SAML spike yesterday afternoon. Daniel got us an Okta developer tenant, and I have a login working locally already, which is a good sign. The Azure AD side I haven't touched, because we don't have a sandbox yet.",
      "raj-spike",
    ],
    [
      "maya",
      "I'll ask Aisha to chase Arcadia for the Azure AD sandbox today. That's the piece that decides whether six weeks is real.",
      "maya-azure",
    ],
    [
      "priya",
      "The labeling guidelines went out last night, and Tom's two people start labeling today. I also changed the prompt so theme labels are short noun phrases. The labels already read a lot more human.",
      "priya-labels",
    ],
    ["marcus", "~Oh, I saw those this morning. Much better."],
    [
      "marcus",
      "On my side, the empty state for small workspaces is done in the prototype. The Zendesk import step is half done. And I started on the share to Slack flow.",
      "marcus-proto",
    ],
    [
      "sam",
      "I'm writing the design doc for incremental assignment. The short version is, new comments get assigned to the nearest existing theme in real time, and anything that's too far from every theme goes into a holding bucket until the nightly job.",
      "sam-incremental",
    ],
    ["priya", "~That matches what I was thinking. Can I review it?"],
    ["sam", "Yes, I'll send you the draft after lunch.", "sam-doc"],
    [
      "lena",
      "I'm wrapping up the online migrations work. The tool works on the fresh staging snapshot. Then I start pairing with Raj on SAML tomorrow.",
      "lena-wrap",
    ],
    ["maya", "Great. Nothing blocked except the Azure sandbox? Okay. Thanks all, good energy."],
  ],
  actionItems: [
    { text: "Ask Aisha to chase Arcadia for an Azure AD sandbox tenant", owner: "maya", at: "maya-azure", quote: "I'll ask Aisha to chase Arcadia for the Azure AD sandbox today", due: "D-1", dueText: "today", status: "done" },
    { text: "Send the incremental assignment design doc draft to Priya for review", owner: "sam", at: "sam-doc", quote: "I'll send you the draft after lunch", due: "D-1", dueText: "after lunch" },
  ],
  knowledge: {
    overview: "First standup after the alignment call: the SAML spike has Okta login working, labeling has started with the new guidelines, and the prototype and incremental assignment design are progressing. The only blocker is the Azure AD sandbox.",
    topics: [
      { title: "SAML spike", summary: "Okta login works locally; Azure AD untested without a sandbox.", from: "raj-spike", to: "maya-azure" },
      { title: "Model and labeling", summary: "Labeling guidelines out; labels now short noun phrases.", from: "priya-labels", to: "priya-labels" },
      { title: "Prototype and incremental assignment", summary: "Empty state done, Zendesk import in progress, share to Slack started; incremental assignment design doc in progress.", from: "marcus-proto", to: "sam-doc" },
    ],
    decisions: [],
    openQuestions: [["Will Arcadia provide an Azure AD sandbox in time for the spike?", "raj-spike", "maya-azure"]],
    speakerContributions: {
      raj: "SAML spike, Okta working.",
      priya: "Labeling guidelines out; label prompt improved.",
      marcus: "Prototype: empty state done, Zendesk import and Slack share in progress.",
      sam: "Incremental assignment design doc.",
      lena: "Finishing online migrations; SAML pairing next.",
    },
  },
  summaries: {
    standup: {
      done: [
        ["Raj: SAML spike started; Okta login working locally.", "raj-spike"],
        ["Priya: labeling guidelines sent; labels now short noun phrases.", "priya-labels"],
        ["Marcus: small-workspace empty state done.", "marcus-proto"],
      ],
      today: [
        ["Sam: incremental assignment design doc to Priya after lunch.", "sam-doc"],
        ["Marcus: Zendesk import step and share-to-Slack flow.", "marcus-proto"],
        ["Lena: finish online migrations; SAML pairing from tomorrow.", "lena-wrap"],
      ],
      blockers: [["Raj: no Azure AD sandbox; Maya asking Aisha to chase Arcadia.", "raj-spike", "maya-azure"]],
    },
  },
});
