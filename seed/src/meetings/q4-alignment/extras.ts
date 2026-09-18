import type { Line } from "../../dsl";

/**
 * Scenes spliced into the hour-long call after the tagged anchor line (see
 * index.ts). Kept separate so the main flow in part1/part2 stays readable.
 */
export const inserts: Record<string, Line[]> = {
  // After Raj: "Great, thanks." - quick outage recap before customer signal.
  "raj-thanks": [
    [
      "maya",
      "Actually, Raj, before Tom starts. Can you give everyone thirty seconds on the ingest outage? I know a few people here haven't read the postmortem yet, and it's relevant to the capacity conversation.",
    ],
    [
      "raj",
      "Sure. So, two weeks ago, ingest was delayed for about six hours. Feedback kept arriving, we didn't lose anything, but it wasn't showing up in workspaces. Two hundred and twelve workspaces were affected, mostly the larger ones.",
      "outage-summary",
    ],
    [
      "raj",
      "Root cause was a schema migration that took a lock on the events table during peak traffic. The queue backed up behind it, and our alerting only looked at error rates, not at how far behind the queue was. So we found out from a customer, which is the part I'm least happy about.",
      "outage-root-cause",
    ],
    ["tom", "~Yeah, we got fourteen tickets and two escalations that morning. Brightline was one of them, actually."],
    ["maya", "Of course it was."],
    [
      "raj",
      "The queue lag alert shipped last week, so that part's fixed. What's left is moving to online migrations, so a schema change can never lock a hot table again. That's the hardening work I mentioned. It's about one engineer until the end of the month.",
      "outage-remaining",
    ],
    ["priya", "Does that affect the clustering jobs? We read from the same events table."],
    ["raj", "It does, in a good way. Once the migrations are online, your nightly re-cluster can run without us worrying about locks at all."],
    ["maya", "Okay. Thanks Raj. And thanks for being so direct in the postmortem, it was really clear."],
    ["raj", "Thanks. Okay, over to Tom."],
  ],

  // After Priya: "...I'll come back to it." - specific account stories.
  "priya-later": [
    [
      "tom",
      "I want to give one more concrete example, because the numbers can feel abstract. Harbor and Pine, the outdoor retailer, downgraded from Business to Pro last month.",
      "harbor-pine",
    ],
    [
      "tom",
      "Their CX lead told me she spends every Monday morning copying support tickets into a slide deck for their exec meeting. By hand. She said, 'I'm paying you to do exactly this, and I'm still doing it myself.'",
      "harbor-quote",
    ],
    ["marcus", "~Oof."],
    ["elena", "~That's painful."],
    ["maya", "That's basically the Themes pitch in one sentence."],
    [
      "tom",
      "It really is. And the other pattern is Slack. Separate from Jira, a lot of people just want a weekly summary pushed into a Slack channel, so the product team sees it without logging in. That came up in, I think, nine of the forty-one conversations.",
      "slack-nine",
    ],
    ["maya", "Daniel, we have a Slack app already, right?"],
    [
      "daniel",
      "We do, but it only sends alerts. Like, 'a new comment matched your saved filter.' It doesn't do summaries. Honestly, most people turn it off after a week because it's too noisy.",
      "slack-app-noisy",
    ],
    ["maya", "Okay, let's keep that in mind for when Marcus shows the design."],
  ],

  // After Daniel: "So we'd need both from day one." - Arcadia and Kestrel detail.
  "both-idps": [
    [
      "aisha",
      "And for context on Arcadia, it's a big deployment. About three thousand support agents across their patient services teams. They want to pull in feedback from their patient portal, their call center notes, and app store reviews.",
      "arcadia-context",
    ],
    ["priya", "~Patient portal feedback, okay. That's going to be very sensitive text."],
    ["aisha", "Yes. Their security review will go deep on that, I'm sure."],
    [
      "aisha",
      "The other one I want to mention is Kestrel Logistics. Mid-market, about four hundred employees, I did discovery with them last week. They're not blocked on anything, they just really, really want the themes view. Grace, their VP of operations, would be a perfect design partner.",
      "kestrel-mention",
    ],
    ["tom", "~Oh, nice. Put her on my list."],
    [
      "aisha",
      "And one competitive data point. The competitor that beat us twice is charging fifteen dollars per seat per month for their AI add-on. Customers are grumbling about that model, so there might be an opening for us on pricing.",
      "competitor-price",
    ],
    ["maya", "Interesting. Let's hold that for the pricing discussion at the end."],
  ],

  // After Priya: "I didn't know it had made it in." - how the model fails today.
  "priya-nice": [
    [
      "priya",
      "Can I show a couple of the failure cases? I think it helps to see what seventy-nine percent actually looks like, rather than just the number.",
    ],
    ["maya", "Please."],
    { pause: 4000 },
    [
      "priya",
      "Okay, so this is the most common failure. The model merged a theme about 'invoices are confusing' with a theme about 'billing failed.' To the model they look the same, it's all billing words. But to a product team those are completely different problems, one is a design issue and one is an outage.",
      "failure-billing",
    ],
    ["raj", "~Yeah, those should never be together."],
    [
      "priya",
      "Right. The second failure is themes that are too broad. Like, 'the app is slow.' It's technically correct, but it has four hundred comments in it, and nobody can act on it. Inside that theme there are really three things: slow search, slow exports, and the mobile app on older phones.",
      "failure-broad",
    ],
    ["marcus", "That's exactly what the split interaction is for."],
    [
      "priya",
      "Exactly. And the third thing, which I care about a lot, is the theme summaries. The model writes a short paragraph for each theme. I built a check that verifies each sentence in the summary is actually supported by the comments in the theme. Right now about four percent of summary sentences make a claim that isn't supported.",
      "summary-check",
    ],
    ["elena", "Four percent of sentences, or four percent of summaries?"],
    [
      "priya",
      "Sentences. So on a typical theme page you might see one shaky sentence every few themes. We drop anything the check flags before it's shown, so users don't see them. But it's why I don't want to rush GA.",
      "summary-drop",
    ],
    [
      "elena",
      "On the labels themselves. Some of the pilot labels read a bit robotic. Like 'Negative sentiment regarding onboarding process.' Could they sound more like how a person would write them?",
      "label-tone",
    ],
    [
      "marcus",
      "Agreed. We've been saying labels should be short noun phrases, like 'Confusing invoice layout,' not sentences. Priya and I talked about putting examples right into the prompt.",
    ],
    ["priya", "Yes, that's easy to change. I'll add label style examples to the prompt this sprint."],
    [
      "priya",
      "And Tom, for your team's labeling days, I'll write up labeling guidelines with examples before they start, so everyone labels the same way.",
      "labeling-guidelines",
    ],
    ["tom", "That would help a lot, thank you."],
  ],

  // After Marcus's "theme-card" line - Elena drops and rejoins.
  "theme-card": [
    ["elena", "Sorry, I think I dropped for a few seconds there. My internet is doing its evening thing. Did I miss anything on the cards?"],
    ["marcus", "Just that each card shows three representative quotes. We tested five and people stopped reading after two."],
    ["elena", "Got it, thanks. I'm back."],
  ],

  // After Priya: "That's exactly the data I need." - Slack sharing and digest debate.
  "priya-love": [
    [
      "marcus",
      "Two more things on this screen, and they connect to what Tom said about Slack. First, every theme has a 'share' button. You can send the theme, with its summary and top quotes, straight into a Slack channel. It's a one-off share, not a subscription.",
      "share-slack",
    ],
    ["tom", "~Oh, that's great. That's exactly the Harbor and Pine use case."],
    [
      "marcus",
      "And second, we explored a weekly digest email. Every Monday, you get your top five themes, what's growing, what's new. We had it going to Slack as well.",
      "digest",
    ],
    [
      "tom",
      "I'll be honest, the digest is the thing I'm most excited about. Half our churn risk is people who just stop logging in. A digest brings them back without them having to remember.",
      "tom-digest",
    ],
    [
      "raj",
      "I like the idea, but I want to flag it's not free. We don't have any scheduled email infrastructure today. We'd need notification preferences, unsubscribe handling, deliverability, time zones. It's a real project, not a feature.",
      "raj-digest",
    ],
    ["daniel", "~And the Slack version needs the Slack app rebuilt, basically. The current one can't post rich messages."],
    [
      "maya",
      "Okay. Here's what I'd suggest. The one-off 'share to Slack' is in scope for the beta, because it's small and it directly addresses the Monday-morning-slides problem. The weekly digest waits until after the beta, and we use the beta to learn what people would actually want in it.",
      "digest-decision",
    ],
    ["tom", "I can live with that, as long as it doesn't disappear."],
    ["maya", "It won't. Marcus, can you capture the digest as a follow-on in the roadmap doc, so it doesn't get lost?"],
    ["marcus", "Yep. And I'll spec the share to Slack flow for the beta.", "marcus-slack-commit"],
  ],

  // After Maya: "Great. That's decided." - SAML details.
  decided: [
    [
      "daniel",
      "Before I write the requirements, let me check a few SAML details with the group, because they affect the estimate. First, just-in-time provisioning. When someone logs in through Okta for the first time, we create their Driftwood account automatically. I think that's a must.",
      "jit",
    ],
    ["raj", "Agreed, JIT is a must. SCIM, for automatic deprovisioning, can come later."],
    [
      "daniel",
      "Second, an 'enforce SSO' setting, so admins can require SSO for everyone in the workspace. And a break-glass admin account that can still log in with a password, in case their identity provider goes down.",
      "enforce-sso",
    ],
    ["aisha", "~Globex asked about exactly that. Victor wants enforcement, no exceptions except break-glass."],
    [
      "daniel",
      "Third, audit logs. My proposed event list is logins, exports, role changes, settings changes, and data deletion. Retained for one year, viewable in the admin panel.",
      "audit-events",
    ],
    [
      "aisha",
      "Globex also asked if they can send audit logs to their SIEM. They use Splunk, I believe.",
      "splunk-ask",
    ],
    [
      "daniel",
      "Let's do CSV export and an API endpoint for audit logs at launch. A native Splunk connector can come later. If they have an API, their security team can pull it into Splunk themselves.",
      "audit-export",
    ],
    ["aisha", "I think Victor will be fine with that. I'll check with him."],
    [
      "raj",
      "One more thing. I'd like Lena to pair on the SAML work. She did the auth rewrite last year, and she knows where the sharp edges are. And we should get a security review of the design before we build, not after.",
      "lena-pair",
    ],
    ["maya", "Yes to both. Daniel, can you set up the security review once the requirements doc is drafted?"],
    ["daniel", "Will do. I'll schedule a security design review as soon as the draft is ready.", "security-review-commit"],
  ],

  // After Tom's design-partner commitment - enablement.
  "tom-commit": [
    [
      "aisha",
      "Can I ask for something for the sales team? If we're going to talk about Insights 2.0 with prospects during the beta, I need a demo script and a battlecard against the AI insights competitor. Otherwise everyone will pitch it differently.",
      "enablement-ask",
    ],
    [
      "elena",
      "Yes. I'd like to do those after we test the messaging with design partners, so we don't train the team on a story we then change. Say, about two weeks after the invite goes out?",
    ],
    ["aisha", "That works. Just not later than that, please. Q4 deals are moving."],
    [
      "elena",
      "Understood. I'll have the demo script and the battlecard ready about two weeks after the beta invite.",
      "elena-enablement-commit",
    ],
    [
      "tom",
      "And on my side, I'll put together an FAQ for existing customers about the Themes default and the feed toggle, so my team has consistent answers.",
      "tom-faq-commit",
    ],
    ["marcus", "~We should also do an in-app announcement the first time people see Themes. I'll add it to the prototype."],
    ["maya", "Great. Thanks all."],
  ],

  // After Maya's pricing instinct - cost numbers.
  "pricing-instinct": [
    ["maya", "Priya, do you have a rough sense of what the AI actually costs us per workspace?"],
    [
      "priya",
      "Roughly. At current volumes, the median workspace costs us about a dollar eighty a month in model costs. The largest pilot workspace is about fourteen dollars a month. Almost all of that is the theme summaries, not the clustering itself.",
      "ai-costs",
    ],
    ["elena", "~So caps on summaries really are where the leverage is."],
    [
      "maya",
      "Right. Something like, Pro includes summaries for up to fifty thousand comments a month, and above that you move to Business. That covers almost everyone except the very largest accounts.",
      "cap-idea",
    ],
    [
      "aisha",
      "From a sales point of view, that's a much easier story than fifteen dollars per seat. Buyers hate per-seat AI add-ons.",
      "aisha-caps",
    ],
    ["maya", "Okay. Good input. But again, none of this leaves the room until Helen and I have run the numbers."],
  ],

  // After Maya's go/no-go commitment - closing chatter.
  "maya-go-no-go": [
    ["priya", "Where does Daniel's one-pager live, by the way? I want to link it from the eval report."],
    ["daniel", "I'll post it in the Insights project channel right after this, along with the SAML notes."],
    [
      "maya",
      "And I'll post the recording and the notes there too. For anyone who missed something, the SSO part starts about halfway through.",
    ],
    ["daniel", "Could you also drop the timestamps for the decisions in the channel? Half my team will only watch the SSO part, and that's fine."],
    ["maya", "Yes, I'll clip the SSO decision and the beta gate so people can watch just those. Two minutes each, tops."],
    ["aisha", "~Look at us, finishing on time."],
    ["raj", "~Mark the calendar."],
  ],

  // After Priya's path-to-85 - how long until 85%.
  "path-to-85": [
    ["maya", "Do you have a feel for how long the merge and split data would take to move the number?"],
    [
      "priya",
      "Rough guess. If twenty design partners each do something like thirty merges or splits a week, that's six hundred corrections a week. In the pilot, a few hundred corrections moved precision by two or three points. So, four to six weeks of beta usage to get from seventy-nine to eighty-five, if the partners are active.",
      "timeline-85",
    ],
    ["tom", "~They'll be active. I'll make that part of the design partner deal."],
    ["priya", "That would really help. Inactive partners are the risk, not the model."],
  ],

  // After Raj's estimates - confidence and unknowns.
  estimates: [
    ["maya", "How confident are you in those numbers, Raj? Like, plus or minus what?"],
    [
      "raj",
      "The Insights work, pretty confident, maybe plus or minus a week. SAML, less so. The protocol part is well understood, but every identity provider has quirks, and Azure AD in particular has surprised people. We also need real test tenants, not just mocks.",
      "saml-unknowns",
    ],
    ["daniel", "I can get us an Okta developer tenant today, and I'll ask Arcadia if they'd give us a sandbox Azure AD app. They offered to help with testing."],
    ["raj", "That would take a lot of risk out of it. Real tenants are the difference between five weeks and eight."],
  ],

  // After Marcus's empty state - why 200.
  "empty-state": [
    ["maya", "Where does the two hundred number come from, by the way?"],
    [
      "priya",
      "From the pilot. Below about two hundred comments, most workspaces ended up with a handful of giant themes and a long tail of themes with one or two comments. Above two hundred, the structure starts to look like something a human would recognize.",
      "why-200",
    ],
    ["marcus", "And the progress bar makes it feel like a goal instead of an error. That was the idea, anyway."],
  ],

  // After Tom's partner mix - what a design partner commits to.
  "partner-mix": [
    [
      "tom",
      "And I want to be clear about what a design partner signs up for, so we don't end up with twenty logos who never log in. My proposal is a thirty minute check-in every week, a shared Slack channel with our team, and a commitment to actually use the themes view for at least four weeks.",
      "partner-commitments",
    ],
    ["elena", "~And a quote or a case study at GA if it goes well?"],
    ["tom", "Yes, optional, but we ask up front. People are much more likely to say yes if they know from day one."],
    ["maya", "I like that. It's a real program, not just early access."],
  ],

  // After Elena's messaging proposal - a skeptical engineer.
  messaging: [
    [
      "raj",
      "Can I push back a little? 'From feedback to decisions' is a big promise. If precision is at seventy-nine during the beta, and a customer makes a decision based on a theme that's actually two themes glued together, that promise hurts us.",
      "raj-pushback",
    ],
    [
      "elena",
      "That's fair. The way I think about it, the promise is the direction, not a guarantee. And the merge and split controls are the honest part. We're saying you stay in control of the themes.",
    ],
    ["priya", "~And the dropped summary sentences help. We're not showing anything we can't support."],
    ["raj", "Okay. As long as the beta invite doesn't oversell accuracy, I'm fine."],
  ],

  // After Elena's GA plan - launch shape.
  "ga-plan": [
    [
      "elena",
      "For GA I'd like at least three customer stories, ideally one enterprise, one mid-market, and one retail. And a live webinar where Priya walks through how the themes are built. People trust AI features more when they see the humans behind them.",
      "ga-stories",
    ],
    ["priya", "~Oh no. I mean, yes. Happily."],
    ["maya", "Priya on a webinar. I love it."],
  ],

  // After Elena's competitive note - what the competitor's demo looks like.
  competitive: [
    ["maya", "Elena, what does their demo actually look like? Have you seen it?"],
    [
      "elena",
      "I watched the recording from their last webinar. It opens on a single screen that says 'here are the five things your customers are upset about this week,' with a big number next to each one. That's it. No filters, no dashboards, no setup. It's very simple, and honestly, it lands.",
      "competitor-demo",
    ],
    ["marcus", "~That's almost exactly our Themes home screen. Just with less in it."],
    [
      "elena",
      "Right. Which is why I think we can win this. The difference is what happens when you click in. From what customers tell us, their themes are hard to correct, and there's no way to trace a theme back to the actual comments. We have both.",
      "our-edge",
    ],
    ["aisha", "~Traceability is a big deal for enterprise buyers. They always ask 'where did this come from.'"],
    ["maya", "Good. Hold that thought, it's going to matter for the launch story."],
  ],

  // After Aisha relays Globex's ask - why their timing is tight.
  "globex-ask": [
    ["maya", "Is there a reason Victor needs the date in writing now? Is something forcing their timeline?"],
    [
      "aisha",
      "Yes, their fiscal year ends in about eight weeks, and the budget for this is use it or lose it. If procurement doesn't start in the next few weeks, the deal slides into next year and gets re-approved from scratch. Which, at Globex, means another four months.",
      "globex-fiscal",
    ],
    ["raj", "~Okay, that's a real forcing function."],
    [
      "aisha",
      "It is. And to be clear, they don't need SSO live to sign. They need a committed date and the questionnaire answers. They'll accept a contract that says SSO within a set number of weeks of signature.",
      "globex-terms",
    ],
    ["daniel", "That's really helpful. So the date is what unblocks them, not the feature itself."],
  ],

  // After Tom asks for the feed toggle - existing saved views.
  "feed-toggle": [
    [
      "daniel",
      "Related question. What happens to saved filters and scheduled reports that people built on top of the feed? Some admins have dozens of them.",
      "saved-views",
    ],
    [
      "marcus",
      "They keep working, they just live under the feed view. We're not migrating anything. We did look at converting saved filters into pinned themes, but it's messy, and it's not worth it for the beta.",
    ],
    ["tom", "~Good. Honestly the scheduled reports are the thing people would scream about if they broke."],
    ["raj", "Nothing changes in the reporting pipeline, so they won't break. I'll double check that the toggle doesn't touch them."],
  ],

  // After Raj's six-week estimate - what if it slips.
  "six-weeks": [
    ["maya", "And if it starts slipping, what's the plan? I don't want Aisha finding out the week it's due."],
    [
      "raj",
      "We'll know by the end of week three. The spike covers the risky part, and by week three we'll have Okta login working end to end with a real tenant. If we're behind at that point, I'll tell you and Aisha that day, not at the end.",
      "slip-plan",
    ],
    ["aisha", "That's all I need. Victor can handle a heads-up. He can't handle a surprise."],
  ],

  // After Maya's latency decision - how progress shows up in the UI.
  "latency-decision": [
    [
      "marcus",
      "From a design side, can we show when the themes were last fully refreshed? Something like 'themes updated overnight, new comments are added as they arrive.' People get suspicious if numbers move and they don't know why.",
      "refresh-label",
    ],
    ["priya", "~Yes, and we can show a small badge on themes that grew a lot since the last full refresh."],
    ["maya", "Nice. Let's include that in the prototype."],
  ],
};
