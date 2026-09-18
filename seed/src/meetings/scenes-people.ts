import type { Line } from "../dsl";

/** Extra scenes for 1:1s and interviews, keyed by meeting key, then anchor tag. */
export const peopleScenes: Record<string, Record<string, Line[]>> = {
  "1on1-maya-raj": {
    "raj-tired": [
      ["maya", "How are Sam and Lena doing? They carried a lot of that night."],
      [
        "raj",
        "Sam was shaken. It was his first real incident as incident commander, and he was hard on himself afterwards. I told him he handled it well, which he did. Lena's fine, she's seen worse at her last job. She actually enjoyed digging into the lock.",
        "raj-team",
      ],
      ["maya", "It might be worth telling Sam in front of the team what he did well. It lands differently when it's public."],
      ["raj", "Good idea. I'll do it at the next team retro.", "raj-recognize"],
    ],
    "raj-rotation": [
      ["maya", "How many pages did on-call get last week, roughly?"],
      [
        "raj",
        "Eleven. Before the outage it was more like three or four a week. Some of that is the new alerts being a bit too sensitive, which we'll tune. But some of it is real, the ingest system is under more load than it was designed for.",
        "raj-pages",
      ],
      ["maya", "Is there a quick win to reduce the noise while the hire happens?"],
      ["raj", "Yes, tuning the lag alert thresholds. Sam's already on it. That should get us back to five or six a week."],
    ],
    "maya-numbers": [
      [
        "raj",
        "One thing I want to check with you before I build it. Should I include the outage hardening as committed work, or present it as something we could pause?",
        "raj-check",
      ],
      [
        "maya",
        "Committed. We are not pausing reliability work to make a roadmap look better. If someone asks, I'll back you on that in the room.",
        "maya-backing",
      ],
      ["raj", "Thank you. That makes the conversation a lot easier."],
    ],
    "@end": [
      ["raj", "Before we go, can I ask how the board feels about the roadmap? I hear bits and pieces."],
      [
        "maya",
        "Mostly positive. They want to see enterprise traction, which is why SSO keeps coming up. And they like the Insights story, as long as it's real and not just an AI label. I'll share more after the board meeting.",
      ],
      ["raj", "Thanks. See you tomorrow."],
    ],
  },

  "1on1-maya-elena": {
    "elena-webinar": [
      ["maya", "Did anything surprise you in the questions people asked during the webinar?"],
      [
        "elena",
        "Yes. Almost half the questions were about trust. 'How do I know the AI is right', 'can I see which comments it used.' Nobody asked about features. They asked whether they could believe it.",
        "elena-trust",
      ],
      ["maya", "That's really important. It matches what Priya keeps saying about showing the underlying comments."],
      ["elena", "I'd like the launch messaging to lean into that. Traceability as a feature, not a footnote."],
    ],
    "elena-worry": [
      ["maya", "What would help you most, day to day, beyond the alignment meeting?"],
      [
        "elena",
        "A single place where the current scope lives. Even a simple doc that says what's in, what's out, and when it changes. Right now I piece it together from Slack.",
        "elena-scope-doc",
      ],
      ["maya", "Fair. I'll make sure the outcome of the alignment meeting becomes that doc, and I'll keep it current."],
    ],
    "elena-stretched": [
      ["maya", "How much of the booth work could Ivy take, realistically?"],
      [
        "elena",
        "Most of it. Shipping the booth, the printed materials, the schedule for who staffs it. I'd still want to write the one-line message on the booth, but the logistics are what's eating my time.",
      ],
      ["maya", "Then that's the split. You write the message, Ivy runs the logistics."],
    ],
    "maya-feedback": [
      [
        "elena",
        "Can I ask for feedback in the other direction? When you review my drafts, the comments sometimes come in over several days. It's hard to know when I have everything.",
        "elena-feedback",
      ],
      [
        "maya",
        "That's completely fair. I'll do reviews in one pass from now on, and tell you when I'm done. If I think of something later, I'll flag it as optional.",
        "maya-onepass",
      ],
      ["elena", "That would help a lot. Thank you."],
    ],
    "elena-growth": [
      ["maya", "What would a research program look like in your head?"],
      [
        "elena",
        "Small to start. A standing panel of ten or fifteen customers we can talk to every month. Some interviews, some quick surveys, and a shared notes repository, so product, design and marketing all hear the same things.",
        "elena-panel",
      ],
      ["maya", "And this app would be a pretty good place to keep those interview recordings."],
      ["elena", "~Ha, yes. We should use our own product."],
    ],
  },

  "1on1-maya-daniel": {
    "daniel-backfill": [
      ["maya", "How long does the backfill take for a big account?"],
      [
        "daniel",
        "For ninety days of a large Zendesk account, maybe forty thousand tickets, about twenty minutes. We rate limit ourselves so we don't hit their API limits. The user sees a progress bar and gets an email when it's done.",
        "daniel-backfill-speed",
      ],
      ["maya", "That's fast enough to put in onboarding. Nobody minds waiting twenty minutes if they know it's working."],
    ],
    "daniel-nervous": [
      ["maya", "What's the actual conversation you're dreading with Tom?"],
      [
        "daniel",
        "That his team has been promising customers Jira for a while, based on things we said six months ago. So when it moves again, it's his team's credibility on the line, not mine.",
        "daniel-credibility",
      ],
      [
        "maya",
        "That's a real problem, and it's partly on me for saying 'soon' six months ago. The fix is a real date. If we commit to Q1 and hit it, Tom's team gets their credibility back.",
        "maya-real-date",
      ],
    ],
    "daniel-button": [
      ["maya", "What would the button actually do? Walk me through it."],
      [
        "daniel",
        "From any theme, you click 'create Jira issue'. It opens a small form with the title pre-filled from the theme label, the description filled with the summary and the top three quotes, and a link back to the theme. You pick the project, and that's it. No syncing back.",
        "daniel-button-flow",
      ],
      ["maya", "That's genuinely useful. I'd use that myself."],
    ],
    "daniel-feedback": [
      ["maya", "What would you want the criteria to look like?"],
      [
        "daniel",
        "Even something simple. Like, revenue at risk or blocked, number of customers affected, strategic fit, and effort. With rough weights. Then when I recommend something, I can show the scoring and we argue about the inputs, not the conclusion.",
        "daniel-criteria",
      ],
      ["maya", "I like that. Arguing about inputs is much healthier."],
    ],
    "maya-growth": [
      ["daniel", "What would you need to see from me to make that a formal role?"],
      [
        "maya",
        "Ship SSO on the date we commit to, run the security review well, and build a relationship with two or three enterprise customers' IT teams. If that happens, I'll make the case for a lead PM title next cycle.",
        "maya-bar",
      ],
      ["daniel", "That's clear. Thank you, Maya."],
    ],
  },

  "interview-backend-jordan": {
    "@start": [
      ["raj", "Hi Jordan, can you hear us okay? I think Priya's just joining."],
      ["jordan", "Yes, I can hear you. Hi."],
      ["priya", "Hi, sorry, my previous meeting ran over. I'm here."],
    ],
    "jordan-background": [
      ["raj", "What was the hardest part of that project?"],
      [
        "jordan",
        "Honestly, the migration. We had years of events in the old format, and we couldn't stop processing payments while we moved. We ran both systems in parallel for about six weeks, compared every output, and only cut over once they matched for a full week.",
        "jordan-parallel",
      ],
      ["priya", "~Six weeks of running both. That takes patience."],
      ["jordan", "It does. But payments are the kind of thing where you really only want to cut over once."],
    ],
    "jordan-fairness": [
      ["raj", "What happens if a worker crashes halfway through processing a batch?"],
      [
        "jordan",
        "The message isn't acknowledged, so the queue redelivers it after a timeout. Because the write is idempotent, processing it twice is harmless. The only thing I'd watch is poison messages, a record that crashes the worker every time. After a few attempts, those go to a dead letter queue, and someone gets alerted.",
        "jordan-poison",
      ],
      ["raj", "And what do you do with the dead letter queue?"],
      ["jordan", "Look at it every day, and have a tool to replay messages once the bug is fixed. A dead letter queue nobody looks at is just a slower way of losing data."],
    ],
    "jordan-drift": [
      ["priya", "How would you decide the threshold for 'close enough' in the fast path?"],
      [
        "jordan",
        "I'd start from the data. Take last month's comments, run the fast path and the full clustering, and look at the distance where they start disagreeing. Pick the threshold just below that. Then revisit it every month, because the themes change as the product changes.",
        "jordan-threshold",
      ],
      ["priya", "~That's how I'd do it too."],
    ],
    "jordan-migration": [
      ["raj", "Have you ever had a migration go badly?"],
      [
        "jordan",
        "Yes. Early in my career I added a foreign key to a large table, and validating it locked writes for eleven minutes. Payments backed up. It's why I'm a bit obsessive about watching locks now. The fix is to add the constraint as not valid first, then validate it separately.",
        "jordan-story",
      ],
      ["raj", "~That's almost exactly what happened to us two weeks ago."],
      ["jordan", "Then I'm sorry, and I understand completely."],
    ],
    "raj-honest": [
      ["jordan", "What would my first month look like, if I joined?"],
      [
        "raj",
        "Probably helping finish the online migrations work, which is a great way to learn the system. Then the incremental clustering pipeline with Priya. And you'd join the on-call rotation after about four weeks, shadowing first.",
        "raj-first-month",
      ],
      ["jordan", "That sounds like a good ramp. Thank you."],
    ],
  },

  "interview-designer-sofia": {
    "sofia-research": [
      ["marcus", "What did the diary study tell you that interviews didn't?"],
      [
        "sofia",
        "Timing. In interviews, people said they checked the dashboard every morning. The diaries showed they actually opened it when something felt wrong, usually after an angry email. So the home page needed to answer 'is this the thing that's wrong', not give a morning overview.",
        "sofia-timing",
      ],
      ["maya", "~That's a great insight. People describe their ideal selves in interviews."],
      ["sofia", "Exactly. Diaries catch what people actually do."],
    ],
    "sofia-powerusers": [
      ["maya", "How did you get engineering on board with removing charts? That's usually a fight."],
      [
        "sofia",
        "Data. We showed that twenty of the charts had fewer than ten views a month, and several of them were expensive to compute. Removing them made the page load twice as fast. Engineering loved it once they saw that.",
        "sofia-engineering",
      ],
    ],
    "sofia-quotes": [
      ["marcus", "Anything else you'd push back on?"],
      [
        "sofia",
        "The count. '412 comments' is meaningful to you, but a new user doesn't know if 412 is a lot. I'd show it relative to their total, like 'eight percent of all feedback this week'. That makes the ranking self-explanatory.",
        "sofia-relative",
      ],
      ["marcus", "~Oh, I like that a lot."],
      [
        "sofia",
        "And I'd test the label wording. Some of these are quite abstract. 'Onboarding friction' versus 'Can't find the import button'. The second one is something a team can act on.",
        "sofia-labels",
      ],
    ],
    "sofia-gap": [
      ["marcus", "How do you usually get up to speed in a new domain?"],
      [
        "sofia",
        "I shadow support for a week. Reading tickets tells you where people get stuck much faster than any documentation. For enterprise settings, I'd also ask to sit in on a few implementation calls with IT teams.",
        "sofia-ramp",
      ],
      ["maya", "That's exactly what we'd want. Our support team would love you."],
      ["sofia", "What does the design team look like today?"],
      [
        "marcus",
        "Three designers including me, and a researcher we share with marketing. You'd own the insights and themes area end to end, and work very closely with Priya on how the AI shows up in the interface.",
        "marcus-team",
      ],
      ["sofia", "That's exciting. AI interfaces are where I want to spend the next few years."],
    ],
  },

  "interview-csm-andre": {
    "andre-expansion": [
      ["tom", "What does a typical QBR look like for you?"],
      [
        "andre",
        "Thirty minutes. Ten on what they achieved, using their own numbers. Ten on what's not working, and I always ask that directly. And ten on what's next, which is usually where expansion comes up naturally. I send the deck two days ahead so there are no surprises.",
        "andre-qbr",
      ],
      ["aisha", "~Two days ahead, I like that."],
      ["tom", "How do you handle an account where the champion leaves?"],
      [
        "andre",
        "That's the scariest moment in customer success. I try to have at least two relationships in every account before it happens. When it does happen, I ask for an intro to the replacement in the first week and offer a fresh onboarding, as if they were a new customer.",
        "andre-champion",
      ],
    ],
    "andre-plan": [
      ["tom", "Still in character. What would you do in the first week, concretely?"],
      [
        "andre",
        "Day one, I'd confirm the tagging audit with our support team and give you a date. Mid week, I'd share what we found and the fixes. End of week, I'd follow up on early access with our product team. And I'd put a thirty minute check-in on your calendar for the week after, so you're not chasing me.",
        "andre-week",
      ],
      ["tom", "~That's exactly what I'd want as a customer."],
    ],
    "andre-gap": [
      ["aisha", "How do you work with sales? Some CSMs see us as the enemy."],
      [
        "andre",
        "I think we're on the same team with different timing. Sales owns the first yes, I own the second and third. I like to be in the last call before signature, so the customer meets me before they're handed over. It makes the transition much smoother.",
        "andre-sales",
      ],
      ["aisha", "That's music to my ears."],
      ["andre", "What does success look like for this role in the first ninety days?"],
      [
        "tom",
        "You'd take over about thirty mid-market accounts. Success is knowing every one of them, having a health score you trust, and at least a couple of design partners for our new AI features coming from your book.",
        "tom-90days",
      ],
      ["andre", "That sounds very doable, and exciting."],
    ],
  },
};
