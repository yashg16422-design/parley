import type { Line } from "../../dsl";

/** ~30:00-60:00 - design review, SSO vs Jira decision, launch, pricing, recap. */
export const part2: Line[] = [
  // --- Design review -------------------------------------------------------
  ["marcus", "Okay, sharing now. Let me know when you can see the Figma file."],
  { pause: 8000 },
  ["elena", "Yep, it's up."],
  [
    "marcus",
    "Cool. So this is the new home screen for Insights 2.0. The big change is that the default view is Themes, not the Feed. Today, you land on a list of raw feedback, newest first. Which is exactly the 'nobody reads it' problem Tom just described. Here, you land on the top themes this week, ranked by volume and by how fast they're growing.",
    "themes-default",
  ],
  ["tom", "Oh, I like the little growth arrow."],
  [
    "marcus",
    "Thanks. So each theme card has the AI label, the number of comments, the trend over the last four weeks, and three representative quotes. We tested showing five quotes, and people just stopped reading after the second one, so we went down to three.",
    "theme-card",
  ],
  ["maya", "What's the source mix? Can I tell whether a theme is mostly support tickets or mostly NPS?"],
  ["marcus", "Yes, there's a small breakdown bar under the count. Hover it and you get the exact split by source."],
  ["maya", "Great, that's important for sales-led accounts."],
  [
    "marcus",
    "Then if you click into a theme, you get the full list of comments, and this is where merge and split live. You can drag one theme onto another to merge them, or you select a handful of comments and split them out into a new theme.",
    "merge-split",
  ],
  ["priya", "~And every merge or split gets logged as a training signal?"],
  [
    "marcus",
    "That's the idea. We'd show a small toast like 'thanks, this improves your themes,' so people know it's actually doing something, and it's not just busywork.",
  ],
  ["priya", "Love that. That's exactly the data I need.", "priya-love"],
  [
    "raj",
    "What does this look like for a brand new workspace with, like, fifty comments? Clustering fifty comments is going to give you garbage themes.",
    "small-workspace",
  ],
  [
    "marcus",
    "Great question, honestly that was the part I was least sure about. Right now, below a threshold, we show an empty state that says 'themes appear after about two hundred comments,' with a progress bar, and we keep the feed as the fallback view.",
    "empty-state",
  ],
  [
    "maya",
    "I think that's right. I would rather show nothing than show bad themes. First impressions of the AI are going to stick, especially with the accounts that already distrust the tagging.",
  ],
  [
    "elena",
    "Could the empty state import something, though? Like, connect Zendesk and we backfill the last ninety days? Then most people would blow past two hundred comments on day one.",
    "zendesk-idea",
  ],
  ["marcus", "~Oh, that's a really good idea."],
  [
    "daniel",
    "We already have a Zendesk backfill, it's just buried in the settings page. Surfacing it in onboarding is maybe a day of work.",
  ],
  ["marcus", "Okay. I'll put the Zendesk import step right into the onboarding flow."],
  [
    "maya",
    "Before we move on. Are there any objections to Themes being the default view? This is a big change for existing customers, so I want to make sure we're all okay with it.",
  ],
  [
    "tom",
    "Existing customers will definitely be surprised. Can we give them a toggle for the first month or so? Some admins have trained their whole team around the feed, and I don't want to generate fifty support tickets on day one.",
    "feed-toggle",
  ],
  ["marcus", "Yes. A 'switch back to feed' toggle, with a note that it goes away later. I'm totally fine with that."],
  [
    "maya",
    "Okay, so decision: Themes is the default for everyone, with a feed toggle for existing customers during the beta. Marcus, can you update the prototype with the empty state, the Zendesk import step, and the toggle?",
    "themes-decision",
  ],
  ["marcus", "Yep. I'll have the updated prototype ready by end of this week.", "marcus-commit"],
  [
    "elena",
    "Small thing, but can we talk about naming? 'Themes' versus 'Topics'. In the pilot interviews, a couple of people called them topics.",
    "naming",
  ],
  ["marcus", "We tested both. Themes won, but only barely. Six to four, or something like that."],
  ["maya", "Let's keep Themes for the beta and see what design partners call them without prompting. That'll tell us more than a vote."],
  ["elena", "Fair enough."],
  { pause: 5000 },

  // --- SSO vs Jira -----------------------------------------------------------
  ["maya", "Okay. Daniel, SSO versus Jira. Walk us through it."],
  [
    "daniel",
    "Right. So I wrote a one-pager, I'll drop it in the chat. The short version is this. Jira has more requests by count, the eleven accounts, and it's great for retention stories. SSO has fewer requests, but it's attached to four hundred and twenty thousand in open pipeline. And it's table stakes for basically every enterprise deal we're going to do next year. Every security questionnaire asks about it.",
    "daniel-onepager",
  ],
  ["aisha", "Every single one. It's usually question three."],
  [
    "daniel",
    "So my recommendation is SAML SSO first, with Okta and Azure AD at launch, plus audit logs, because Globex asked for both. Then the full Jira integration in Q1. And in the meantime, we ship the lightweight 'create Jira issue' button from a theme. One way. Which honestly covers most of what people actually ask for when they say 'Jira integration.'",
    "daniel-rec",
  ],
  [
    "raj",
    "If we do the button, I want it scoped to exactly that. No two-way sync, no status updates coming back, nothing. Otherwise it becomes the full integration by stealth, and then we're back to not having the people.",
    "scope-guard",
  ],
  ["daniel", "~Agreed. One way, one button."],
  [
    "tom",
    "I'm fine with that. As long as I can tell the eleven accounts it's coming in Q1, with a real date, I can manage the conversation.",
  ],
  ["aisha", "And I need a date for SSO that I can put in writing to Globex. What's realistic?"],
  [
    "raj",
    "If we start SAML next week with two people, I'd say five weeks to something Globex can actually test, and then a week of hardening. So roughly six weeks. And I really don't want to promise less than that.",
    "six-weeks",
  ],
  [
    "aisha",
    "Six weeks I can sell. Honestly, I'd much rather give them six and hit it than give them four and slip. Victor will remember a slip.",
  ],
  [
    "maya",
    "Okay, so I'm hearing consensus. Let me say it back. We prioritize SAML SSO, with Okta and Azure AD plus audit logs, this quarter, with two engineers, targeting six weeks. The full Jira integration moves to Q1. And we ship a one-way 'create Jira issue' button from themes as part of Insights 2.0. Does anyone disagree?",
    "sso-decision",
  ],
  ["priya", "No."],
  ["tom", "~No, sounds good."],
  ["daniel", "~Agreed."],
  ["maya", "Great. That's decided.", "decided"],
  [
    "daniel",
    "I'll write the SAML requirements doc this week. It'll cover Okta and Azure AD, the audit log events, and what the admin setup flow looks like. Raj, can you do a spike on the SAML library so we know whether six weeks is real?",
    "daniel-commit",
  ],
  ["raj", "Yes. I'll do the spike and have an estimate I actually trust within three days.", "raj-spike"],
  [
    "aisha",
    "And I'll send Globex and Arcadia our updated security questionnaire answers, with SSO marked as in development. Daniel, can you review them before I send?",
    "aisha-commit",
  ],
  ["daniel", "Yep, send them over, I'll turn it around quickly."],
  [
    "tom",
    "I'll let the Jira accounts know it's coming in Q1. Actually, I'd like to call the two that churned personally. Maybe we can win one of them back with the button and a date.",
    "tom-calls",
  ],
  ["maya", "Love that. Please do."],
  { pause: 3000 },

  // --- Launch plan -----------------------------------------------------------
  ["maya", "Okay, Elena. Launch."],
  [
    "elena",
    "Okay. So, given everything we've just said, here's what I'd propose. We run a private beta of Insights 2.0 with around twenty design partners, starting in about two weeks. No big announcement. Just a personal invite from Maya and the account team.",
    "launch-plan",
  ],
  [
    "elena",
    "Then general availability once we actually hit the precision bar, and that's when we do the big launch. Blog post, webinar, customer stories, the whole thing.",
    "ga-plan",
  ],
  ["maya", "Why twenty design partners?"],
  [
    "elena",
    "Enough to generate real merge and split data for Priya. And small enough that Tom's team can actually talk to every single one of them, every week.",
  ],
  [
    "tom",
    "Twenty is about what we can handle. I'd want a mix. The six pilot accounts who asked for it, plus a few bigger ones, and at least a couple in retail and healthcare, for Priya's data.",
    "partner-mix",
  ],
  ["priya", "~Yes please. Healthcare is our weakest area by far."],
  ["daniel", "Healthcare only after the redaction pass, though."],
  ["tom", "Right, agreed. Healthcare partners join once redaction is in.", "healthcare-gate"],
  [
    "elena",
    "And on messaging. I'd like to test moving away from 'feedback analytics' toward something like 'from feedback to decisions.' The idea being, we're not another dashboard. We tell you what to do next.",
    "messaging",
  ],
  ["marcus", "I like that a lot. It matches the Themes-first design really well."],
  ["aisha", "It'll help in demos for sure. It's a much simpler story than what we have today."],
  [
    "maya",
    "Let's test it with the beta invite and with the design partners before we commit to it for GA. Elena, can you draft the messaging brief and the beta invite email?",
  ],
  ["elena", "Yes. I'll have a draft of the messaging brief and the beta invite by early next week.", "elena-commit"],
  ["maya", "And Tom, the design partner list?"],
  ["tom", "I'll shortlist twenty design partners, plus a few backups, and share the list at the start of next week.", "tom-commit"],
  [
    "raj",
    "One risk I want to name. If the precision eval comes back and we're still at seventy-nine, do we still start the beta on schedule?",
    "beta-risk",
  ],
  [
    "maya",
    "Good question. My view is yes. The beta is how we get to eighty-five, through the merge and split data. But GA is gated on eighty-five. We don't go GA below that.",
    "beta-gate",
  ],
  ["priya", "~That's the right call. I'd be really nervous shipping GA at seventy-nine."],
  ["maya", "Okay, so that's a decision too. The beta starts on schedule regardless, and GA is gated on eighty-five percent precision.", "gate-decision"],

  // --- Pricing -------------------------------------------------------------
  [
    "aisha",
    "What about pricing? Customers are going to ask me what Insights 2.0 costs. Is it in Pro, is it an add-on?",
    "pricing-q",
  ],
  [
    "maya",
    "Honestly, it's not decided. My instinct is that themes are included in Pro, but we put usage caps on the AI summaries, because that's where our costs actually are. But I need to work the numbers with Helen before I say that to anyone outside this room.",
    "pricing-instinct",
  ],
  ["aisha", "Okay. So for now I tell people pricing will be announced at GA?"],
  [
    "maya",
    "Yes. The beta is free for design partners, and pricing comes at GA. I'll bring a proposal on AI usage caps to the leadership team by end of next week.",
    "maya-commit",
  ],
  ["elena", "~Can I see it before leadership? Packaging affects the launch story."],
  ["maya", "Of course. I'll share a draft with you and Aisha first."],
  { pause: 2000 },

  // --- Recap -----------------------------------------------------------------
  ["maya", "Okay, we're nearly out of time. Let me recap owners and dates, and please shout if I get anything wrong.", "recap"],
  [
    "maya",
    "Priya, the two thousand comment labeled set and the precision report by the middle of next week, plus scoping the redaction pass with Daniel. Raj, the SAML spike and a real estimate, and the incremental assignment plan with the three second budget. Daniel, the SAML requirements doc this week. Marcus, the prototype updates by end of week.",
    "recap-1",
  ],
  [
    "maya",
    "Elena, the messaging brief and beta invite early next week. Tom, the design partner shortlist at the start of next week, and the Jira churn number. Aisha, the security questionnaire answers to Globex and Arcadia, once Daniel reviews. And me, the pricing proposal by end of next week.",
    "recap-2",
  ],
  ["tom", "~And the calls to the two churned accounts."],
  ["maya", "And those, yes. Did I miss anything?"],
  [
    "raj",
    "Can we put a go or no-go on the calendar for the beta? A few days before it starts, so we can look at the eval results and the latency numbers together, in one room.",
    "go-no-go",
  ],
  ["maya", "Yes, good idea. I'll schedule the beta go or no-go meeting today.", "maya-go-no-go"],
  ["elena", "Great meeting. Honestly, this is the first time the launch has felt real to me."],
  ["maya", "Same. Thanks everyone, this was a really good discussion. Talk soon."],
  ["aisha", "Bye all."],
  ["marcus", "~Bye!"],
];
