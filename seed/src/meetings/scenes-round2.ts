import type { Line } from "../dsl";

/**
 * Second pass of scenes, written after the build's slot-fill check reported
 * how far short each meeting still was. Anchors that already have a scene get
 * this one appended after it.
 */
export const round2Scenes: Record<string, Record<string, Line[]>> = {
  "pricing-ai-usage-caps": {
    "aisha-no-seat": [
      ["maya", "Did Kestrel say how the per-seat pricing was presented to them?"],
      [
        "aisha",
        "Fifteen dollars per seat per month, on top of the base plan, for everyone who can see the AI features. For their sixty-person support team, that was more than the whole base contract. Grace said it felt like being charged twice.",
        "aisha-kestrel-seat",
      ],
      ["helen", "~And per seat punishes exactly the behavior we want, which is more people looking at the themes."],
      ["elena", "That's a great line for the launch, honestly. 'AI for your whole team, not per seat.'"],
    ],
    "maya-cap": [
      ["helen", "What counts as a comment for the cap? If a customer imports ninety days of history on day one, do they blow through it immediately?"],
      [
        "maya",
        "Good catch. I'd exclude the initial backfill from the cap. Otherwise the onboarding moment we're designing around becomes a pricing problem.",
        "maya-backfill-exempt",
      ],
      ["aisha", "~Yes, please. That would be a terrible first week."],
      ["helen", "Excluding the backfill is fine financially, it's a one-time cost. I'll include it in the model as onboarding cost."],
      ["elena", "And duplicates? Some customers get the same comment from two sources."],
      ["maya", "We de-duplicate before summarizing anyway, so duplicates don't count twice. I'll make that explicit in the proposal."],
    ],
    "elena-copy": [
      ["aisha", "Will the tier names change? Pro and Business mean very little to buyers."],
      [
        "elena",
        "Not for this launch. Renaming tiers is a much bigger project, and it would distract from Insights. I'd rather describe what each tier includes more clearly on the page.",
        "elena-no-rename",
      ],
      ["maya", "Agreed. One change at a time."],
    ],
  },

  "globex-security-review": {
    "nadia-scim": [
      ["daniel", "Nadia, when you say SCIM is a nice-to-have, what's the workaround in the meantime?"],
      [
        "nadia",
        "A quarterly access review. We export the user list from each tool and check it against HR. It's manual, but it works, and it's what we do for most vendors today.",
        "nadia-review",
      ],
      ["daniel", "We can make that export easy. There's already a user list export in admin settings, and it includes last login dates."],
      ["nadia", "Last login is actually the most useful field for us. Good."],
    ],
    "victor-fiscal": [
      ["aisha", "Could the contract include the SSO date as a commitment? Would that help procurement?"],
      [
        "victor",
        "Yes. If the contract says SSO and audit logs will be available by a specific date, with an exit clause if you miss it, procurement is comfortable. We've done that with other vendors.",
        "victor-clause",
      ],
      ["aisha", "That's very workable on our side. I'll check with our legal team, but I don't expect any issue."],
    ],
    "noah-sandbox": [
      ["nadia", "Can the sandbox have realistic data? Testing permissions on an empty workspace doesn't tell us much."],
      [
        "noah",
        "Yes. I'll load it with a sample dataset, a few thousand anonymized support tickets, so the themes and permissions behave like they would in production.",
        "noah-sample-data",
      ],
      ["nadia", "Perfect."],
    ],
  },

  "design-crit-dashboard-v3": {
    "marcus-test": [
      ["elena", "Who would you test with? CS folks know the product too well."],
      [
        "marcus",
        "Fair. Two people from CS, plus two from finance and ops who've never used the product. The question is simple: look at a card for five seconds, then tell me what the theme is about.",
        "marcus-test-design",
      ],
      ["raj", "~Five seconds is harsh. I like it."],
      ["marcus", "That's roughly how long people look at a dashboard card in real life, based on the session recordings."],
    ],
    "elena-arrow": [
      ["maya", "How often do themes grow because of praise, in the pilot data?"],
      [
        "marcus",
        "More than I expected. When Lakeshore Bank shipped their new mobile app, the top growing theme for a week was people saying they loved the redesign. With a red arrow, it looked like a crisis.",
        "marcus-lakeshore",
      ],
      ["elena", "~That's exactly the moment we'd want to celebrate, not alarm."],
      ["raj", "Could the team even share those in Slack? Praise themes are great for morale."],
      ["maya", "Put that on the list for the share to Slack idea. Not for v3, but later."],
    ],
    "marcus-update": [
      ["raj", "What about mobile? Do we need a mobile version of the themes home for the beta?"],
      [
        "marcus",
        "I don't think so. Almost all usage is desktop, and the beta audience is product and CX teams at their desks. I'd make it readable on a phone, but not optimized.",
        "marcus-mobile",
      ],
      ["maya", "Agreed. Readable, not optimized."],
      ["marcus", "Okay, thanks everyone, this was really useful. I'll send the updated prototype before the alignment meeting."],
    ],
  },

  "interview-backend-jordan": {
    "jordan-idempotency": [
      ["raj", "How did you test that? Idempotency bugs are notoriously hard to catch before production."],
      [
        "jordan",
        "Two ways. In tests, we deliberately delivered every event twice and asserted nothing changed the second time. And in production, we ran a daily reconciliation job comparing our records against the payment processor's. Any mismatch paged someone.",
        "jordan-testing",
      ],
      ["priya", "~Deliver everything twice in tests. That's a nice trick."],
      ["jordan", "It found three bugs in the first week. Tests that only deliver once don't catch any of them."],
    ],
    "jordan-design": [
      ["priya", "Would you store the raw payload, or only the normalized record?"],
      [
        "jordan",
        "Both. The raw payload goes to cheap object storage, keyed by source and external ID. The normalized record goes to Postgres. When you change the normalization logic, which you will, you can reprocess from the raw data instead of re-fetching from the source.",
        "jordan-raw",
      ],
      ["raj", "~We learned that one the hard way last year."],
    ],
    "jordan-lag": [
      ["raj", "Would you set an alert on it, or an SLO, or both?"],
      [
        "jordan",
        "Both, for different people. An alert for on-call, say if lag goes over five minutes. And an SLO for the team, like ninety-nine percent of feedback visible within two minutes, measured weekly. The alert tells you something's wrong now, the SLO tells you whether the system is getting better or worse over time.",
        "jordan-slo",
      ],
      ["raj", "That's a really clear way to put it."],
    ],
    "jordan-incremental": [
      ["priya", "Where would you store the embeddings for the fast path?"],
      [
        "jordan",
        "If the data is already in Postgres, I'd start with a vector extension there before adding a new system. At your scale, millions of comments, it's fine. I'd only move to a dedicated vector database if queries got slow, and I'd want numbers first.",
        "jordan-pgvector",
      ],
      ["priya", "~That's what we do today, actually. It's been fine so far."],
    ],
    "jordan-oncall-q": [
      ["jordan", "And a second question. How do technical decisions get made on the team? Is it consensus, or does someone decide?"],
      [
        "raj",
        "For big decisions, someone writes a short design doc, the team comments for a couple of days, and then the person who owns the area decides. Usually me for platform, Priya for ML. We try hard not to decide in meetings.",
        "raj-decisions",
      ],
      ["jordan", "That's how I like to work. Written first, then discussion."],
    ],
  },

  "launch-planning-insights": {
    "maya-agree": [
      ["tom", "What about internal launch? Sales and CS need to know what's coming before customers hear about it."],
      [
        "elena",
        "Yes. I'd do an internal preview a week before the beta invites go out. Demo, FAQ, and what you can and can't promise. Especially no dates for GA.",
        "elena-internal",
      ],
      ["maya", "~And no promises about accuracy. 'It's early and it gets better as you use it' is the line."],
    ],
    "ivy-calendar": [
      ["elena", "Which channels would you focus on?"],
      [
        "ivy",
        "For the beta, mostly your own channels. Customer newsletter, in-app announcement, and personal emails from Maya. For GA, add the webinar, LinkedIn, and a couple of guest posts in CX communities where your buyers hang out.",
        "ivy-channels",
      ],
      ["tom", "The CX communities are a great idea. That's where our best customers came from originally."],
      ["ivy", "I'll include a list of the communities in the calendar, with who we know in each."],
    ],
    "@end": [
      ["elena", "Anything else before we wrap?"],
      ["tom", "Just that I'd love to see the draft plan before the alignment meeting, so I'm not surprised by my own action items."],
      ["elena", "~Ha, fair. I'll share it the day before."],
      ["maya", "Thanks everyone. Ivy, welcome aboard, this is going to be fun."],
    ],
  },

  "1on1-maya-raj": {
    "raj-worry": [
      ["maya", "What if someone pushes back in the room? Aisha will want SSO yesterday."],
      [
        "raj",
        "Then I'll show what we'd have to drop to do it faster. If the answer is 'pause the outage hardening', I'll say no, and I'd want you to back me. If it's 'drop Jira', that's a business call, and I'm happy for the group to make it.",
        "raj-pushback-plan",
      ],
      ["maya", "That's exactly the right framing. Reliability isn't on the table, scope is."],
    ],
  },

  "1on1-maya-daniel": {
    "daniel-onepager": [
      ["maya", "How long is it right now?"],
      [
        "daniel",
        "Three pages, which I know isn't really a one-pager. It has the request data, the revenue at stake, effort estimates, and a section on risks. I wanted to be thorough, because I know people will challenge it.",
        "daniel-length",
      ],
      [
        "maya",
        "Being thorough is good, but put the thoroughness in an appendix. The first page should be readable in two minutes. Most people in the meeting will only read that page.",
        "maya-appendix",
      ],
    ],
    "maya-criteria": [
      ["daniel", "When do you think you'd have the criteria written down?"],
      ["maya", "End of next week. I'll draft it, share it with you and the other PMs for comments, and then we'll use it in the next planning cycle."],
      ["daniel", "Great. I'm happy to be a guinea pig for it with the SSO work."],
      ["maya", "~Deal. You'll be the first test case."],
    ],
  },

  "leadership-sync-weekly": {
    "chris-ask": [
      ["chris", "And the board meeting is in two weeks. I'd like the SSO decision and the Insights plan in the deck, even if it's a single slide."],
      [
        "maya",
        "That works. The alignment meeting is before then, so I'll have both. One slide on the SSO decision and timeline, one on the Insights beta.",
        "maya-board",
      ],
    ],
    "chris-hire-decision": [
      ["tom", "Related, on hiring. We made an offer to Andre for the CSM role. He accepted yesterday, starts in three weeks."],
      ["chris", "~Great news."],
      [
        "tom",
        "He'll take about thirty mid-market accounts, which frees me up to spend more time on the at-risk ones. Brightline especially.",
        "tom-andre",
      ],
    ],
    "maya-costs": [
      ["chris", "Anything else? Okay. One thing from me, then. I want us to be careful about how we talk about AI externally. Everyone is saying AI. We should only say it when we can show it."],
      [
        "maya",
        "Agreed. The beta is private for exactly that reason. We'll show it to customers who can see it working on their own data before we say anything publicly.",
        "maya-ai-careful",
      ],
      ["chris", "Good. Same time next week."],
    ],
  },

  "interview-designer-sofia": {
    "sofia-result": [
      ["maya", "How did you measure that fifty-five percent? Weekly active on the dashboard page?"],
      [
        "sofia",
        "Weekly active users who opened the home page at least once, divided by all active users of the product. We also tracked how often people clicked from a question into the detail, which went up almost four times. That told us the answers were actually useful, not just visible.",
        "sofia-metrics",
      ],
      ["marcus", "~Click-through to detail is a smart metric. It separates looking from using."],
    ],
    "sofia-suggest": [
      ["marcus", "If you had to pick one thing to test first, what would it be?"],
      [
        "sofia",
        "The arrow. Because it's the thing that could damage trust fastest. If people see alarming arrows on tiny themes a couple of times, they'll ignore all the arrows, including the ones that matter.",
        "sofia-priority",
      ],
      ["maya", "That's a strong argument. Trust is our whole problem with the old tagging too."],
    ],
    "@end": [
      ["sofia", "Before we go, can I ask a question? How do designers and the ML team work together today?"],
      [
        "marcus",
        "Closely, but informally. Priya and I sit down every week or so. Honestly, I'd love someone to make that more deliberate, especially around how the AI explains itself in the interface.",
        "marcus-ml-collab",
      ],
      ["sofia", "That's the part of the job I'd be most excited about."],
      ["maya", "Thank you, Sofia. This was a great conversation."],
    ],
  },

  "1on1-maya-elena": {
    "elena-plan-commit": [
      ["maya", "What do you think goes into the one-pager?"],
      [
        "elena",
        "Audience, phases, the core message, what we need from each team, and a rough sequence. No dates, just the order of things. And one line on how we'll know it worked.",
        "elena-plan-shape",
      ],
      ["maya", "~Perfect. And the 'how we'll know it worked' line is the one people usually forget."],
    ],
    "maya-growth": [
      ["elena", "Should I pitch the research program formally, or just start?"],
      [
        "maya",
        "Just start, with the beta. After two months, write up what you learned and what it would take to make it permanent. It's much easier to get budget for something that's already working.",
        "maya-just-start",
      ],
      ["elena", "That's great advice. Thank you, Maya."],
    ],
  },

  "kestrel-discovery": {
    "grace-wand": [
      ["aisha", "How many regional managers would want access?"],
      [
        "grace",
        "Six, one for each region. Plus me, my director of support, and probably a couple of people in product. So around a dozen people, but only a few of them every day.",
        "grace-users",
      ],
      ["noah", "~That's a very typical shape. A few daily users and a wider group checking in weekly."],
    ],
  },

  "brightline-checkin": {
    "maya-preview": [
      ["olivia", "How accurate is it? That's really the only question I care about, after the tagging."],
      [
        "maya",
        "Honest answer: better than the old tagger by a wide margin, but not perfect. Today, about four out of five comments land in the right theme. That's why you can merge and split themes, and every correction improves it.",
        "maya-honest-accuracy",
      ],
      ["olivia", "Four out of five is a lot better than what we have. And I like that we can fix it ourselves."],
    ],
    "tom-shortlist": [
      ["olivia", "When would the beta start, roughly?"],
      ["maya", "We're finalizing the plan next week. I'll let Tom share the timing as soon as it's locked, rather than guess now."],
      [
        "olivia",
        "That's fine. Honestly, this call changed my view. I came in expecting to tell you we're evaluating alternatives, and I'm leaving with a reason to wait.",
        "olivia-shift",
      ],
      ["tom", "That means a lot. We'll make sure it's worth it."],
    ],
  },

  "interview-csm-andre": {
    "andre-background": [
      ["tom", "Why are you looking to move?"],
      [
        "andre",
        "Honestly, I want to work on a product where the customer's problem is changing fast. HR software is stable, which is good, but I'm most energized when I'm helping customers figure out something new. AI features in customer feedback feel like that right now.",
        "andre-why",
      ],
      ["aisha", "~That's a good reason."],
    ],
    "@end": [
      ["andre", "Can I ask what the biggest challenge is for the CS team right now?"],
      [
        "tom",
        "Trust in the tagging. A lot of our at-risk accounts stopped trusting the automatic tags, and that makes the whole product feel less valuable. The new theme clustering should fix a lot of that, but we'll need to win people back one by one.",
        "tom-challenge",
      ],
      ["andre", "That's exactly the kind of work I enjoy. Rebuilding trust account by account."],
      ["aisha", "Thanks Andre, great talking with you."],
    ],
  },

  "juniper-intro": {
    "aisha-jira": [
      ["aisha", "What does the handoff to product look like today, step by step?"],
      [
        "hiro",
        "I copy a few reviews into a Jira ticket, write a summary, and guess at the priority. Then product asks me how many people are affected, and I go back and count by hand. It usually takes three or four back and forths.",
        "hiro-handoff",
      ],
      ["aisha", "~So the count is the missing piece."],
      ["hiro", "Exactly. If the ticket said 'two hundred reviews this week, growing', nobody would need to ask."],
    ],
  },

  "arcadia-discovery": {
    "imran-baa": [
      ["aisha", "On retention, is there a specific period your policy requires?"],
      [
        "imran",
        "For patient feedback, we keep it for seven years for compliance, but we'd want the option to delete earlier on request. And any copies used for AI processing shouldn't be kept at all after processing.",
        "imran-retention",
      ],
      ["noah", "~That matches how our AI processing works. Nothing is retained by the model provider."],
    ],
    "noah-themes": [
      ["rosa", "Can I see what a theme looks like when you click into it?"],
      [
        "noah",
        "Sure. Here's a theme called 'Hard to reschedule appointments online'. You see every comment in it, from every source, with the date and location. And you can export the list or share it with someone.",
        "noah-drilldown",
      ],
      ["rosa", "This would have caught the reminder problem in the first week."],
    ],
  },

  "postmortem-ingest-delay": {
    "sam-timeline": [
      ["maya", "Who was on call when it started?"],
      [
        "sam",
        "I was. But nothing paged me, so I didn't know until Tom's team escalated. Then it took about twenty minutes to find the blocking lock, because I was looking at the workers first, and they looked healthy.",
        "sam-oncall",
      ],
      ["raj", "~And that's the system's fault, not yours. The tools pointed you the wrong way."],
    ],
    "tom-template": [
      ["maya", "What would the template include?"],
      [
        "tom",
        "Three versions. First response within fifteen minutes, saying what we know and when we'll update next. Regular updates every hour. And a resolution message with a short, honest explanation. Plus a rule that at-risk accounts get a personal call.",
        "tom-template-detail",
      ],
      ["raj", "Can engineering get a heads-up before it goes out? Just so we're telling the same story."],
      ["tom", "Yes, the on-call engineer reviews the first message. It takes one minute and avoids contradictions."],
    ],
  },
};
