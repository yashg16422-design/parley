import type { Line } from "../dsl";

/** Fourth and final pass, closing the last slot-fill shortfalls. */
export const round4Scenes: Record<string, Record<string, Line[]>> = {
  "pricing-ai-usage-caps": {
    "maya-writeup": [
      ["helen", "Can the write-up include what we'd say to existing Pro customers? They'll get AI features they didn't pay for, which is great, but they'll ask whether their price is changing."],
      ["maya", "Yes. The message is simple: nothing changes on your price, and you get Insights included, within the cap. I'll put the exact wording in the proposal."],
      ["elena", "~That's a nice message to send, honestly. Good news for once."],
    ],
  },
  "globex-security-review": {
    "victor-data": [
      ["noah", "Before I answer, is there a particular concern behind the AI question? It helps me be specific."],
      ["victor", "Mostly that our customers' complaints could end up training someone else's model. That's the scenario my board asks about."],
    ],
  },
  "design-crit-dashboard-v3": {
    "marcus-card": [
      ["raj", "What's the order of the cards? By size?"],
      [
        "marcus",
        "By a mix of size and growth. A big theme that isn't changing ranks below a smaller theme that doubled this week. The idea is to surface what's new, not what's always been there.",
        "marcus-ranking",
      ],
      ["maya", "~I like that. The big stable themes are usually things the team already knows about."],
      ["elena", "Could people pin a theme they care about, so it stays at the top regardless?"],
      ["marcus", "Good idea. Pinning is easy. I'll add it to the prototype."],
    ],
  },
  "interview-backend-jordan": {
    "priya-twist": [
      ["jordan", "Before I answer, how many themes does a typical workspace have? And how fast do new comments arrive?"],
      [
        "priya",
        "Usually between thirty and two hundred themes. Most workspaces get a few hundred comments a day, the big ones a few thousand an hour during incidents.",
        "priya-scale",
      ],
      ["jordan", "Okay, that's small enough that comparing a new comment against every theme is cheap. That shapes the answer."],
    ],
    "jordan-migration": [
      ["priya", "How would you roll back if a migration goes wrong halfway through the backfill?"],
      [
        "jordan",
        "With expand and contract, you mostly don't need to. The old column is still there and still being read until the very end. If the backfill has a bug, you stop it, fix it, and restart. Nothing user-facing has changed yet.",
        "jordan-rollback",
      ],
      ["raj", "~That's the part people forget. The safety comes from not switching reads until you're sure."],
    ],
  },
  "launch-planning-insights": {
    "ivy-stories": [
      ["maya", "How long does a good customer story take to produce?"],
      [
        "ivy",
        "About three weeks from interview to published, if the customer's approvals are quick. Enterprise approvals can take longer. So for GA, we'd want interviews to start about a month before.",
        "ivy-lead-time",
      ],
      ["elena", "~That's useful for the calendar. It means stories need to start during the beta, not after."],
    ],
    "tom-list": [
      ["elena", "Great. I think we have what we need. Thanks everyone, and Ivy, I'll send you the brand guidelines after this."],
      ["ivy", "Perfect. Looking forward to it."],
    ],
  },
  "1on1-maya-raj": {
    "maya-sync-commit": [
      ["raj", "Should I bring anything to the first roadmap sync?"],
      ["maya", "Just your current capacity picture. Aisha will bring the deals that need engineering input. The goal is that no commitment goes to a customer without you seeing it first."],
    ],
  },
  "1on1-maya-daniel": {
    "maya-tom": [
      ["daniel", "What will you tell Tom, exactly?"],
      [
        "maya",
        "The truth. That the revenue case for SSO is overwhelming this quarter, that Jira is coming in Q1 with a real date, and that we're offering a small one-way button in the meantime. And I'll ask for his help with the customers who've been waiting.",
        "maya-tom-message",
      ],
      ["daniel", "That's much better than him hearing it cold in the meeting. Thank you."],
      ["maya", "~That's what previews are for. Nobody likes surprises in a big meeting."],
    ],
  },
  "leadership-sync-weekly": {
    "helen-costs": [
      ["chris", "Maya, is there a risk that pricing slows down the beta?"],
      [
        "maya",
        "No. The beta is free for design partners, so pricing doesn't block it. It only matters for general availability, and that's gated on model accuracy anyway, which will take longer than the pricing work.",
        "maya-pricing-not-blocking",
      ],
      ["chris", "Good. Then there's no reason to rush pricing. Get it right."],
      ["helen", "~Music to my ears."],
    ],
  },
  "interview-designer-sofia": {
    "sofia-powerusers": [
      ["marcus", "Did anyone complain loudly when the charts disappeared?"],
      [
        "sofia",
        "One team did, the finance analysts. They used four specific charts every month for a report. We rebuilt those four as a saved view just for them. It took a day, and they became some of our biggest fans.",
        "sofia-finance",
      ],
      ["maya", "~Listening to the loud minority without letting them drive everything. That's hard to do."],
    ],
  },
  "1on1-maya-elena": {
    "elena-ivy-commit": [
      ["maya", "And how are you doing, generally? Not just work."],
      [
        "elena",
        "Honestly, a bit tired. The time zone makes the evenings long, with calls until eight or nine. But this conversation helps. Knowing the booth is covered takes a lot off my mind.",
        "elena-tired",
      ],
      ["maya", "Let's try to keep your meetings before six your time where we can. I'll move our 1:1 earlier too."],
      ["elena", "~That would be lovely. Thank you."],
    ],
  },
  "kestrel-discovery": {
    "aisha-design-partner": [
      ["grace", "What would you need from us as a design partner?"],
      ["aisha", "Mostly honest feedback, a short weekly check-in with our team, and real usage. Our customer success lead would walk you through the details."],
    ],
  },
  "brightline-checkin": {
    "olivia-renewal": [
      ["tom", "Is there anything that would make the renewal conversation easier for you internally?"],
      [
        "olivia",
        "Evidence. If I can show my VP that the tags are better, or that the new themes found something real, that's all I need. Numbers beat promises.",
        "olivia-evidence",
      ],
    ],
  },
  "interview-csm-andre": {
    "andre-plan": [
      ["aisha", "Stepping out for a second. Why did you not offer a discount in the role play?"],
      [
        "andre",
        "Because the problem wasn't price. If I'd offered a discount, the customer would pay less for something that still doesn't work, and churn a year later anyway. I'd only bring up price if they told me it was the problem.",
        "andre-no-discount",
      ],
      ["tom", "~That's exactly our philosophy."],
    ],
  },
  "juniper-intro": {
    "hiro-company": [
      ["aisha", "How did you eventually find the cause?"],
      ["hiro", "A customer tagged us on social media with a photo of the ingredient label. That's how we found out about the supplier change. Not a great way to find out."],
    ],
  },
  "arcadia-discovery": {
    "imran-azure": [
      ["noah", "Imran, do you use conditional access policies in Azure AD? Some of our enterprise customers do."],
      ["imran", "Yes. Access is restricted to managed devices on our network or VPN. Whatever you build needs to respect that, which it will if it's standard SAML."],
    ],
  },
  "postmortem-ingest-delay": {
    "lena-online": [
      ["raj", "How long would the evaluation take, roughly?"],
      ["lena", "About a week. I want to test at least two tools against a realistic copy of the events table, including one while we're writing to it at peak rates."],
      ["raj", "~A week is fine. Better to pick the right one."],
    ],
  },
};
