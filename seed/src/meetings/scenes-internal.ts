import type { Line } from "../dsl";

/** Extra scenes for internal and leadership meetings, keyed by meeting key, then anchor tag. */
export const internalScenes: Record<string, Record<string, Line[]>> = {
  "postmortem-ingest-delay": {
    "@start": [
      ["raj", "Give it a second, a couple of people are still joining. Tom, you made it."],
      ["tom", "Just about. I was on the phone with Brightline until two minutes ago."],
      ["maya", "~How did that go?"],
      ["tom", "Tense, but okay. I'll share more when we get to customer impact."],
    ],
    "sam-detection": [
      ["priya", "Why didn't the worker health checks catch it? The workers were stuck for hours."],
      [
        "sam",
        "Because they weren't stuck from the health check's point of view. They were alive, connected, and waiting on a database lock. The health check only asks 'is the process running', not 'is it making progress'.",
        "sam-healthcheck",
      ],
      ["lena", "~That's a subtle one. Alive but not doing anything."],
      [
        "raj",
        "Let's add that as a follow-up. A progress-based health check, so a worker that hasn't completed a job in some time counts as unhealthy.",
        "raj-progress-check",
      ],
    ],
    "lena-well": [
      ["maya", "Was there any risk of losing data if the lock had lasted longer?"],
      [
        "lena",
        "Not for a while. The queue retains messages for seven days. We'd have had to be stuck for a week before anything was at risk. That was a deliberate decision last year, and it paid off.",
        "lena-retention",
      ],
      ["raj", "Worth writing that down in the postmortem as a thing that worked, so nobody shortens the retention to save money."],
    ],
    "lena-badly": [
      ["maya", "Why was the migration run during peak hours? I'm asking about the process, not the person."],
      [
        "raj",
        "Because we had no rule against it. The migration looked harmless, adding an index, and our tooling didn't warn that it would lock the table. The person who ran it followed our process exactly. The process was the problem.",
        "raj-process",
      ],
      ["sam", "~And to be fair, the same migration on staging took two seconds, because staging has a tiny fraction of the data."],
      ["lena", "Which is another follow-up. Staging should have realistic data volumes for the big tables, or we should at least test migrations on a copy."],
    ],
    "tom-comms": [
      ["maya", "What should the first message to customers have said?"],
      [
        "tom",
        "Something like: we know feedback isn't appearing, nothing is lost, here's when we'll update you next. Short and honest. Instead, the first reply said we were 'looking into reports of an issue', which sounded like we didn't believe them.",
        "tom-better-message",
      ],
      ["raj", "~That's fair. We also didn't give support anything to say, because we didn't know ourselves for a while."],
    ],
    "raj-policy": [
      ["priya", "Should the policy cover the ML tables too? The clustering jobs do big writes at night."],
      ["raj", "Yes, any table over a certain size. I'll define the threshold in the policy, probably ten million rows."],
      ["lena", "And the runbook should include how to find blocking locks. It took us twenty minutes to find the right query that day."],
      ["raj", "Agreed. I'll put the exact queries in the runbook."],
    ],
  },

  "design-crit-dashboard-v3": {
    "@start": [
      ["marcus", "Hi all, can you see my screen? I'm sharing the Figma prototype."],
      ["raj", "Yep, we see it."],
      ["elena", "Hi, I'm here, just finishing a message. Go ahead."],
    ],
    "maya-quotes": [
      ["elena", "~Agreed. And the quotes are the most human part. I'd rather see one great quote than five okay ones."],
      [
        "marcus",
        "How do we pick the one great quote, though? Right now the model picks the three to five most typical comments in the theme. Typical isn't the same as quotable.",
        "marcus-pick",
      ],
      [
        "maya",
        "Could it pick the clearest one? Short, specific, no customer names. Priya could probably score that.",
        "maya-clearest",
      ],
      ["marcus", "I'll ask her. For the prototype I'll pick them by hand."],
    ],
    "marcus-sentiment": [
      ["raj", "How would sentiment be calculated? Per comment, then averaged?"],
      [
        "marcus",
        "That's my assumption, but Priya would know better. The display would be simple, a small dot that's green, grey, or orange, with the split on hover. Mostly positive, mixed, mostly negative.",
      ],
      ["elena", "Orange rather than red is good. Red feels like an alarm, orange feels like 'look at this'."],
      ["maya", "~I like that we're thinking about how it feels, not just what it shows."],
    ],
    "raj-discover": [
      ["elena", "~I didn't know either, honestly."],
      ["marcus", "Okay, so that's two out of three people who didn't find it. That's a clear signal."],
    ],
    "marcus-buttons": [
      ["raj", "What happens technically when someone merges two themes? Does the model learn from it immediately?"],
      [
        "marcus",
        "In the prototype it's instant, visually. But I don't know what happens behind the scenes. That's something to figure out with Priya.",
      ],
      [
        "raj",
        "My guess is the merge is saved immediately, and the model learns from it in the next nightly run. As long as the user sees their change stick, they won't care when the learning happens.",
        "raj-merge-backend",
      ],
      ["maya", "Right. The important thing is the next morning's themes shouldn't undo their merge."],
      ["marcus", "~Oh, that would be infuriating. Let's make sure that never happens."],
    ],
    "maya-proposal": [
      ["elena", "Can I ask what happens to existing customers? Some of them have built their whole workflow around the feed."],
      [
        "maya",
        "Good question, and I don't have the answer yet. That's something to raise at the alignment meeting. Tom will have a view on it.",
        "maya-existing",
      ],
      ["marcus", "I'll add a slide on it, so we don't forget."],
    ],
  },

  "launch-planning-insights": {
    "@start": [
      ["elena", "Hi everyone. Ivy, can you hear us okay?"],
      ["ivy", "Yes, all good. Thanks for having me in on this, I've been looking forward to it."],
      ["tom", "~Welcome, Ivy."],
    ],
    "elena-two-phase": [
      ["ivy", "What's the reason the model isn't ready? I want to understand what I can and can't say in content."],
      [
        "maya",
        "Accuracy. When it groups feedback into themes, it's right about four times out of five today. The goal is closer to nine out of ten before we call it generally available. The beta is how we get there, because customers correcting it is what improves it.",
        "maya-accuracy",
      ],
      ["ivy", "Got it. So the beta content should be honest that it's early, and invite people to help shape it."],
      ["elena", "~Exactly. 'Help us build it' is a good story in itself."],
    ],
    "tom-program": [
      ["elena", "What would you want in the design partner agreement?"],
      [
        "tom",
        "A simple one-pager, not a contract. Weekly check-in, shared channel, a named person on their side, and permission to use anonymized feedback about the product. And we ask up front if they'd be open to a case study at GA.",
        "tom-agreement",
      ],
      ["maya", "Keep it light. The moment it needs legal review, half of them will drop out."],
    ],
    "ivy-stories": [
      ["elena", "What makes a customer story actually work, in your experience?"],
      [
        "ivy",
        "A specific moment. Not 'they saved time', but 'on a Monday in March, they noticed X, and because of that they did Y'. Plus a number, and a named person who's willing to be quoted. Without the named person, it reads like marketing.",
        "ivy-moment",
      ],
      ["tom", "~Brightline would have been perfect for that, if they weren't so unhappy right now."],
      ["maya", "Maybe they still will be. If the beta goes well for them, that's the best story of all."],
    ],
    "tom-candidates": [
      ["ivy", "Would any of them do a video? Video testimonials perform much better than written ones."],
      [
        "tom",
        "Lakeshore Bank, probably not, banks are careful. A retail or logistics company, more likely. I'll ask when I talk to them about the beta.",
      ],
      ["elena", "Let's not push video in the beta. Ask for it at GA, once they've had a good experience."],
    ],
    "maya-caution": [
      ["ivy", "What about a waitlist? Something public, so people can sign up for early access without a date?"],
      [
        "elena",
        "I like that. It builds demand without committing to a date. And it gives Aisha's team a reason to follow up with prospects.",
        "elena-waitlist",
      ],
      ["maya", "As long as we don't promise waitlist people access in a specific time frame. Design partners first."],
      ["ivy", "~Understood. 'Be the first to know', not 'get access in two weeks'."],
    ],
  },

  "leadership-sync-weekly": {
    "@start": [
      ["chris", "Morning. Helen's on her way, she's just finishing a call with the auditors. Let's start without her."],
      ["aisha", "Morning."],
      ["raj", "~Morning."],
    ],
    "aisha-pipeline": [
      ["chris", "How confident are you in the rest of the pipeline, the part that isn't blocked?"],
      [
        "aisha",
        "Reasonably. About five hundred thousand is mid-market, with normal risk. Kestrel Logistics is the one I'm most excited about. And Juniper is small but moving. The rest is early stage and I wouldn't count on it this quarter.",
        "aisha-rest",
      ],
      ["helen", "~Sorry I'm late. Aisha, what's the weighted number?"],
      ["aisha", "Weighted, about six hundred thousand. With SSO committed, I'd move Globex up, and that pushes us closer to eight."],
    ],
    "tom-nrr": [
      ["chris", "Which accounts are driving the drop?"],
      [
        "tom",
        "Mostly downgrades rather than full churn. Harbor and Pine went from Business to Pro. Two smaller accounts churned outright, both mentioned Jira. And Brightline is the biggest risk ahead of us, their renewal is in about three months.",
        "tom-accounts",
      ],
      ["chris", "What does Brightline need to stay?"],
      ["tom", "Honestly, a reason to believe the tagging will get better. Maya and I have a call with them this week."],
    ],
    "raj-oncall": [
      ["chris", "How close are we to the team burning out? I want an honest answer."],
      [
        "raj",
        "Not there yet, but I can see it from here. Pages have tripled since the outage, some of that is new alerts being noisy. If nothing changes in the next month, I'd expect someone to start looking elsewhere.",
        "raj-burnout",
      ],
      ["chris", "~Okay. That's clear. Thank you for saying it plainly."],
    ],
    "helen-tradeoff": [
      ["chris", "Maya, how do you feel about pushing the marketing hire? That affects Elena."],
      [
        "maya",
        "It's the right trade. Elena's stretched, but we're bringing in a contractor for the event work, which covers the most urgent gap. The staff data engineer helps two problems at once, on-call and the model.",
        "maya-trade",
      ],
    ],
    "helen-costs": [
      ["aisha", "Is there a rough timeline on pricing? Prospects are starting to ask."],
      [
        "helen",
        "Once Maya has the cost numbers, I'd need about a week to model it. So maybe two to three weeks for a proposal. Until then, please don't quote anything for the AI features.",
        "helen-timeline",
      ],
      ["aisha", "Understood. I'll tell people pricing comes with general availability."],
    ],
  },

  "pricing-ai-usage-caps": {
    "@start": [
      ["maya", "Hi all. Aisha, are you there? I see you but can't hear you."],
      ["aisha", "Sorry, I was on mute. I'm here."],
      ["helen", "~Classic."],
    ],
    "helen-model": [
      ["elena", "How confident are those numbers? If the model price changes, does everything move?"],
      [
        "helen",
        "The numbers assume today's model pricing and today's usage. Model prices have been going down, not up, so I think the risk is on usage, not price. If customers use summaries far more than in the pilot, costs rise with them.",
        "helen-assumptions",
      ],
      ["maya", "Which is exactly what a cap protects against."],
    ],
    "elena-included": [
      ["maya", "What about option B, the add-on? Some companies do very well with that."],
      [
        "aisha",
        "It adds a second negotiation to every deal. Buyers who already have budget for us need to go find more budget for the AI part. In my experience that slows deals down by weeks.",
        "aisha-addon",
      ],
      [
        "helen",
        "Financially, the add-on would bring in more revenue per account in the short term. But if it slows deals and hurts retention, it's not worth it. I'm persuaded by option A.",
        "helen-persuaded",
      ],
    ],
    "helen-margin": [
      ["elena", "How many customers would actually hit fifty thousand comments a month today?"],
      [
        "helen",
        "Using the pilot data and our current customer base, about four percent of Pro accounts. Most of them are already close to the Business tier for other reasons.",
        "helen-four-percent",
      ],
      ["aisha", "~So the cap is also a natural upgrade trigger."],
      ["maya", "Right, which is good, as long as it feels fair, not punishing."],
    ],
    "maya-cap-behavior": [
      ["helen", "Should the cap reset monthly, or roll over?"],
      [
        "maya",
        "Monthly reset. Rollover sounds generous, but it's confusing to explain and hard to forecast. Simple beats clever for pricing.",
        "maya-reset",
      ],
      ["elena", "Agreed. Simple is easier to put on a pricing page too."],
    ],
    "@end": [
      ["aisha", "Maya, when's the leadership review? I want to make sure I test the shape before it."],
      ["maya", "It's on the calendar for later this week. So you have a few days. Even two conversations would help."],
      ["aisha", "I'll make it happen. Thanks, everyone."],
    ],
  },

  "brightline-checkin": {
    "@start": [
      ["tom", "Hi Olivia, can you hear us?"],
      ["olivia", "Yes, hi Tom. Hi Maya, nice to finally meet you."],
      ["maya", "You too, Olivia. Thanks for making time, especially after last week."],
    ],
    "maya-apology": [
      ["maya", "What we've changed since: we added alerting that would have caught the delay within minutes, and we're changing how we run database changes so it can't happen the same way again."],
      [
        "olivia",
        "That's reassuring. And to be fair, your team was responsive once they knew. It was the first few hours that were frustrating, when we weren't sure anyone was looking.",
        "olivia-first-hours",
      ],
      ["tom", "~That's exactly what we're fixing on the communication side too."],
    ],
    "olivia-tagging": [
      ["maya", "How many people are sorting by hand today?"],
      [
        "olivia",
        "Two people, for about half a day each week. Plus me, reading through the summary they produce. It works, but it's the kind of work I really don't want my team spending time on.",
        "olivia-manual",
      ],
      ["tom", "And when the tags were on, what was the worst part?"],
      [
        "olivia",
        "That we couldn't tell which tags to trust. If some are wrong, you have to check all of them, and then what's the point. It only takes a few bad ones to lose trust in all of them.",
        "olivia-trust",
      ],
      ["maya", "~That's exactly what we've heard from other customers too."],
    ],
    "olivia-renewal": [
      ["maya", "Can I ask what the alternative is promising?"],
      [
        "olivia",
        "AI themes, basically. A weekly list of what customers are talking about. The demo looked good, but they couldn't show me how it would work on our data, and it was priced per seat, which is expensive for a team our size.",
        "olivia-alternative",
      ],
    ],
    "maya-invite": [
      ["olivia", "What would being a design partner involve for us?"],
      [
        "tom",
        "A thirty minute check-in each week with us, a shared channel for questions, and honest feedback. In return, you get early access, free during the beta, and a real say in how it works.",
        "tom-partner-terms",
      ],
      ["olivia", "That's reasonable. I'd want one of my two analysts involved, since they'd be using it every day."],
      ["maya", "That's ideal, actually. The people doing the work are the ones who'll tell us what's wrong."],
    ],
    "tom-audit": [
      ["olivia", "How long would the audit take?"],
      [
        "tom",
        "A couple of days. We'll look at the rules, compare them to a sample of your recent tickets, and fix anything misconfigured. I'll send you a summary of what we changed, so your team knows why the tags look different.",
        "tom-audit-detail",
      ],
      ["olivia", "Okay. If the tags get noticeably better, I'll turn them back on for a trial."],
    ],
  },
};
