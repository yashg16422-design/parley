import type { Line } from "../dsl";

/** Third pass of scenes, sized from the build's remaining slot-fill shortfalls. */
export const round3Scenes: Record<string, Record<string, Line[]>> = {
  "pricing-ai-usage-caps": {
    "helen-sensitivity": [
      ["maya", "What would make you uncomfortable in the sensitivity analysis? What's the scenario you're worried about?"],
      [
        "helen",
        "Two things. A few very large Pro accounts sitting just under the cap every month, which would squeeze margin without triggering an upgrade. And summaries becoming so popular that median usage triples. Neither is likely this year, but I want to know the numbers before we commit publicly.",
        "helen-worry",
      ],
      ["elena", "~If summaries become that popular, that's a good problem to have."],
      ["helen", "It is, as long as the price reflects it. I'll bring both scenarios to the leadership review, with a recommendation for each."],
      ["maya", "That's perfect. Honestly, having the downside modeled will make Chris much more comfortable saying yes."],
      ["aisha", "And if it helps, I can share what the prospects say about the shape before Helen finalizes anything. If someone reacts badly to the cap, we'll know early."],
      ["helen", "Please do. Real reactions beat my assumptions every time."],
    ],
  },

  "globex-security-review": {
    "daniel-diagram": [
      ["victor", "When can we expect the diagram? My team meets on the first of the month to review open vendor items."],
      ["daniel", "Within a few days. Well before your review. I'll include the redaction steps and the retention policy for the AI provider on the same page."],
      ["victor", "Good. One page is exactly right. My team won't read ten."],
    ],
  },

  "design-crit-dashboard-v3": {
    "raj-discover": [
      ["maya", "What did people do in the usability sessions when they wanted to fix a theme?"],
      [
        "marcus",
        "Mostly they looked for a menu on the theme card. Three dots, or a right-click. Nobody tried dragging. Which, now that I say it out loud, is a pretty clear answer.",
        "marcus-usability",
      ],
      ["raj", "~So the buttons should probably live in that menu, too."],
      ["marcus", "Yes. Menu on the card, buttons in the detail view, and drag and drop for people who discover it."],
    ],
    "maya-proposal": [
      ["raj", "One question for the alignment meeting. Do we present Themes-first as decided, or as a proposal?"],
      [
        "maya",
        "As a proposal with a strong recommendation. Tom and Aisha haven't seen it yet, and they'll have good questions about existing customers. I'd rather they feel part of the decision than have it handed to them.",
        "maya-proposal-framing",
      ],
      ["elena", "~That's a good call. People support what they help shape."],
    ],
  },

  "interview-backend-jordan": {
    "jordan-fairness": [
      ["priya", "How would you handle a customer who sends a huge backfill, like two years of history, all at once?"],
      [
        "jordan",
        "Treat it as a different class of work. Backfills go to a low priority lane, with a rate limit, so they never delay live feedback. The customer sees a progress bar. Live comments still show up within seconds, while the history fills in behind them.",
        "jordan-backfill",
      ],
      ["raj", "~That's roughly what we do, but we don't have separate lanes yet. Backfills and live data share the queue."],
      ["jordan", "Then that's where I'd look first if you ever see lag during onboarding of a big customer."],
    ],
    "raj-migration": [
      ["jordan", "Can I ask a clarifying question? Is the table partitioned, or is it one big table?"],
      ["raj", "One big table, which is part of the problem."],
      [
        "jordan",
        "Then I'd also think about partitioning by time, longer term. Most queries look at recent data, and old partitions can be moved to cheaper storage or dropped by retention. It also makes migrations much less scary, because each partition is small.",
        "jordan-partition",
      ],
      ["priya", "~That would help the nightly clustering too. It mostly reads the last ninety days."],
    ],
    "raj-close": [
      ["jordan", "Thank you both. I really enjoyed the clustering discussion, it's a fun problem."],
      ["priya", "It is. Thanks Jordan, great conversation."],
    ],
  },

  "launch-planning-insights": {
    "tom-candidates": [
      ["elena", "What's the risk of asking beta customers for stories too early?"],
      [
        "tom",
        "That they say yes to be polite, and then the product has a rough week and they regret it. I'd wait until the fourth or fifth check-in. By then you know who's genuinely happy.",
        "tom-timing",
      ],
      ["ivy", "~That's a good rule. Stories from genuinely happy customers are always better."],
    ],
    "elena-proposal": [
      ["maya", "One suggestion for the alignment meeting. Lead with why two phases, before the what. The engineers will be much more comfortable if they see we're not rushing the model."],
      [
        "elena",
        "Good idea. I'll open with the accuracy point, then the program, then the launch. And I'll keep it to one page, since everyone's going to have a lot to read.",
        "elena-structure",
      ],
      ["tom", "~One page. Please."],
    ],
  },

  "1on1-maya-raj": {
    "raj-growth": [
      ["maya", "What does managing formally mean to you? What would change day to day?"],
      [
        "raj",
        "Less coding, for sure. More time on hiring, career conversations, and making sure the team has what they need. Honestly, I already do half of that. It would just be official, and I'd stop feeling guilty about not writing code.",
        "raj-manage-meaning",
      ],
      ["maya", "~The guilt is real. Most new managers feel it."],
    ],
  },

  "1on1-maya-daniel": {
    "daniel-feedback": [
      ["maya", "Is there anything else? Something that would make your week easier?"],
      [
        "daniel",
        "Fewer interrupt requests from sales for one-off integrations. Every week someone asks if we can connect to some tool for one prospect. I want to help, but it fragments my time.",
        "daniel-interrupts",
      ],
      [
        "maya",
        "Let's route those through Aisha's weekly roadmap sync instead of direct messages. Then they get prioritized with everything else, and you're not the bottleneck.",
        "maya-route",
      ],
      ["daniel", "That would help a lot. I'll tell the sales team."],
    ],
  },

  "leadership-sync-weekly": {
    "tom-save": [
      ["helen", "What does the save play involve? Is it discounting?"],
      [
        "tom",
        "No discounts unless there's no other option. It's attention. A senior person on every at-risk account, a clear plan for what we'll fix, and early access to Insights where it makes sense. Discounting tends to just delay the churn.",
        "tom-no-discount",
      ],
      ["chris", "~Agreed. Fix the product problem, not the price."],
      ["helen", "Good. Then I won't budget for save discounts this quarter."],
    ],
    "raj-oncall": [
      ["helen", "Is there anything we can do for the team in the short term? Even something small."],
      [
        "chris",
        "Let's give the platform team a recovery day after the next release. And Raj, if there's a tool or a contractor that would take pressure off on-call, bring it to Helen directly.",
        "chris-recovery",
      ],
      ["raj", "Thank you. That will mean a lot to them."],
    ],
  },

  "interview-designer-sofia": {
    "sofia-project": [
      ["marcus", "What was your role on the project, specifically? Were you the only designer?"],
      [
        "sofia",
        "I was the lead designer, with one other designer on the team. I ran the research, set the direction, and designed the home page. My colleague focused on the detail pages. We had one PM and four engineers.",
        "sofia-role",
      ],
      ["maya", "~A small team. That matches how we work."],
    ],
    "sofia-critique-growth": [
      ["maya", "Would you show a trend at all for very small themes?"],
      [
        "sofia",
        "Probably not. Below some threshold, I'd just say 'new' or 'emerging', without an arrow. A theme with four comments doesn't have a trend, it has a story, and the story is in the quotes.",
        "sofia-emerging",
      ],
      ["marcus", "~'Emerging' is a nice word for it."],
    ],
  },

  "1on1-maya-elena": {
    "maya-invite": [
      ["elena", "Who else is going to be in the alignment meeting?"],
      [
        "maya",
        "Raj, Priya, Marcus, Tom, Aisha, and Daniel. Eight of us. It's a big group, so I'll keep the agenda tight. You'll have about ten minutes for launch, near the end.",
        "maya-attendees",
      ],
      ["elena", "Ten minutes is enough if the one-pager is good. I'll make it good."],
    ],
  },

  "kestrel-discovery": {
    "ben-competitor": [
      ["aisha", "What else did you like or dislike about their product, aside from price?"],
      [
        "ben",
        "The demo was slick. But when we asked how it would handle our app reviews, they said it would need a custom connector, with a services fee. That was the second red flag.",
        "ben-connector",
      ],
      ["noah", "~App store reviews are a standard connector for us. No services fee."],
    ],
  },

  "brightline-checkin": {
    "maya-apology": [
      ["maya", "Would it have helped to have a status page you could check yourselves?"],
      [
        "olivia",
        "Yes, honestly. Even a simple page saying 'ingest delayed, no data lost, next update at two o'clock' would have saved us a lot of anxiety and a few emails.",
        "olivia-status-page",
      ],
      ["tom", "~That's on our list. It'll be part of the new incident process."],
    ],
    "tom-audit": [
      ["maya", "Olivia, is there anything else we should know before the audit starts? Any categories that matter most?"],
      [
        "olivia",
        "Billing and delivery. Those are the two areas our executives ask about every week. If those tags are right, we'd trust the rest much more.",
        "olivia-priorities",
      ],
      ["tom", "Then we'll start with billing and delivery, and report on those two first."],
    ],
  },

  "interview-csm-andre": {
    "andre-questions": [
      ["tom", "Still in character. 'Look, I don't have time for a long diagnosis. Can you just fix it?'"],
      [
        "andre",
        "I understand, and I'll keep it short. Give me ten minutes this week with whoever uses the tags the most. That's all I need to find the misconfiguration. After that, I'll do the rest without taking more of your team's time.",
        "andre-short",
      ],
      ["tom", "~Okay, ten minutes I can do."],
    ],
    "andre-gap": [
      ["aisha", "How would you approach your first enterprise renewal here, given that gap?"],
      [
        "andre",
        "I'd ask Tom to let me shadow one of his, end to end. And I'd map the stakeholders early, six months before renewal, not six weeks. In my experience, enterprise renewals are lost because someone important was never in the conversation.",
        "andre-enterprise-plan",
      ],
      ["tom", "~Six months early is exactly right."],
    ],
  },

  "juniper-intro": {
    "@start": [
      ["aisha", "Hi Hiro, can you hear me okay?"],
      ["hiro", "Yes, perfectly. Sorry, I'm in a coffee shop, there might be some background noise."],
      ["aisha", "No problem at all. Thanks for making time."],
    ],
    "aisha-followup": [
      ["hiro", "One more question. If the Jira button comes out, would it be included in the plan, or extra?"],
      ["aisha", "I'd expect it to be included, but I'll confirm before I say it for sure. I'll include that in my follow-up."],
    ],
  },

  "arcadia-discovery": {
    "rosa-sources": [
      ["aisha", "Are all of those in one system today, or spread out?"],
      [
        "rosa",
        "Spread out. The portal comments are in one database, the call center notes are in our contact center software, and app reviews we pull manually. Getting them into one place would already be a big step for us.",
        "rosa-spread",
      ],
    ],
  },

  "postmortem-ingest-delay": {
    "maya-brightline": [
      ["raj", "Tom, anything else from customers we should know? Any requests that came out of this?"],
      [
        "tom",
        "Two customers asked for a status page. And Brightline asked if they could get an alert themselves when their feedback is delayed, instead of noticing on their own.",
        "tom-requests",
      ],
      ["raj", "~A customer-facing freshness indicator. That's a good idea, actually."],
      ["maya", "Let's capture it for the roadmap. Not now, but it's a nice way to show we take reliability seriously."],
    ],
  },
};
