import type { Line } from "../dsl";

/** Extra scenes for the sales calls, keyed by meeting key, then anchor tag. */
export const salesScenes: Record<string, Record<string, Line[]>> = {
  "globex-security-review": {
    "@start": [
      ["aisha", "Hi Victor, hi Nadia. Can you hear us okay?"],
      ["victor", "Loud and clear. Nadia's joining from the office, I'm at home today."],
      ["nadia", "Hi everyone. Sorry, I'm in a conference room with a very loud air conditioner. Let me know if it's too much."],
      ["noah", "~You sound fine from here."],
    ],
    "victor-direct": [
      ["aisha", "That's great to hear. Can I ask what stood out in the evaluation? It helps us to know what's landing."],
      [
        "victor",
        "Honestly, it was my product team that pushed for it. They ran a two week trial on our support tickets, and they found a billing issue in the first three days that had been sitting in the queue for a month. That got my attention.",
        "victor-trial",
      ],
      ["nadia", "~And the setup was easy. That's rare for us."],
    ],
    "daniel-plan": [
      ["victor", "How would enforcement work in practice? If someone at Globex tries to log in with a password, what happens?"],
      [
        "daniel",
        "Once an admin turns on enforcement, password login is disabled for everyone in the workspace, except one break-glass admin account. That account is there in case your identity provider has an outage, so you're never locked out of your own data. Every use of it is logged.",
        "daniel-breakglass",
      ],
      ["victor", "That's the right design. We'll want to know who holds the break-glass account and we'll rotate it ourselves."],
      ["daniel", "~Exactly. It's yours to control."],
    ],
    "noah-data": [
      ["nadia", "How long do you keep the feedback itself? And can we delete it on request?"],
      [
        "noah",
        "You control retention. By default we keep everything while you're a customer. You can set a retention window, like twenty four months, and anything older is deleted automatically. And admins can delete specific records or an entire source at any time.",
        "noah-retention",
      ],
      ["nadia", "And deletion would show up in the audit log?"],
      ["daniel", "Yes. Data deletion is one of the audit log events. Who did it, when, and what scope."],
      ["victor", "Good. That covers most of what our privacy team will ask."],
    ],
    "@end": [
      ["aisha", "One last thing from my side. Once you have the date, who else needs to be involved on your side to get to signature?"],
      [
        "victor",
        "Procurement and legal. Legal usually takes two weeks for a new vendor. If your paper is standard, it could be faster. I'll introduce you to our procurement lead once we have the date.",
        "victor-process",
      ],
      ["aisha", "Perfect. I'll send our standard terms ahead of time so legal can start early."],
    ],
  },

  "kestrel-discovery": {
    "grace-sources": [
      ["aisha", "Roughly how much feedback is that in a month?"],
      [
        "grace",
        "Zendesk is around nine thousand tickets a month. App reviews, maybe a few hundred. NPS is quarterly, a couple of thousand responses each time. And the account manager notes, honestly, no idea, they're scattered across people's documents.",
        "grace-volume",
      ],
      ["noah", "~The notes are usually the most valuable and the hardest to get at."],
    ],
    "grace-lost-shipper": [
      ["aisha", "When you looked back at it, how early could you have seen it?"],
      [
        "grace",
        "About three weeks earlier. The complaints started as a trickle in one region. If someone had seen 'missed delivery window, northeast' growing week over week, we'd have added drivers. Instead, we found out when the shipper's VP called our CEO.",
        "grace-hindsight",
      ],
    ],
    "noah-setup": [
      ["ben", "What about data security? Our shippers' names show up in tickets. Where does the data live?"],
      [
        "noah",
        "Everything is stored in the US, encrypted at rest and in transit. For the AI features, text is processed by our model provider under an agreement that it isn't used for training or retained. We can send you our security overview after the call.",
      ],
      ["ben", "That would be great. I'll need it for our vendor review, but it sounds standard."],
    ],
    "grace-budget": [
      ["aisha", "What numbers would your CFO want to see?"],
      [
        "grace",
        "Time saved, for sure. The analyst's two days a week is easy to calculate. But the real story is the shipper we lost. If this catches one of those a year, it pays for itself many times over.",
        "grace-roi",
      ],
      ["aisha", "That's a strong case. I can help you put together a one page business case for him, if that's useful."],
      ["grace", "That would be very useful."],
    ],
  },

  "arcadia-discovery": {
    "@start": [
      ["aisha", "Hi Rosa, hi Imran. Thanks for joining. Noah from our solutions team is here too."],
      ["rosa", "Hi everyone. Apologies in advance, I have a hard stop, there's a board prep meeting right after."],
      ["aisha", "Understood, we'll keep it focused."],
    ],
    "rosa-company": [
      ["aisha", "Who uses patient feedback today, beyond your team?"],
      [
        "rosa",
        "Clinic managers, hospital operations, and our quality and safety committee. The safety committee is the one that worries me most. They get a monthly summary, and it's only as good as the sample my analysts read.",
        "rosa-safety",
      ],
    ],
    "rosa-example": [
      ["noah", "How did that one eventually get fixed?"],
      [
        "rosa",
        "A configuration change in our scheduling system, it took an afternoon. That's what hurts. It was an afternoon of work, and it took five weeks for the signal to reach the right person.",
        "rosa-afternoon",
      ],
      ["aisha", "~That's a really powerful example."],
    ],
    "imran-phi": [
      ["imran", "And we'd want the option to keep certain sources out of AI processing entirely. The call center notes, for example, are the most sensitive."],
      [
        "noah",
        "That's supported per source. You can connect a source for search and reporting only, and exclude it from clustering and summaries. Many healthcare teams start that way and expand once they're comfortable.",
        "noah-exclude",
      ],
      ["imran", "Good. That gives us a way to start without the most sensitive data."],
    ],
    "rosa-budget": [
      ["aisha", "What would make this a clear win for your CIO?"],
      [
        "rosa",
        "Two things. Coverage, meaning we read every comment, not a sample. And speed, meaning a safety-related pattern reaches the committee in days, not months. If we can show both in a pilot, the CIO will support it.",
        "rosa-win",
      ],
    ],
  },

  "juniper-intro": {
    "hiro-company": [
      ["aisha", "How often does something like that happen?"],
      [
        "hiro",
        "A few times a quarter. Last month it was a supplier change that made one of our sauces taste different. We got two hundred reviews about it in a week. Our rating dropped from four point six to four point two.",
        "hiro-sauce",
      ],
      ["aisha", "~Ouch. That's a big drop for a week."],
      ["hiro", "It took about a month to recover. And app store rating directly affects how many new customers we get."],
    ],
    "hiro-budget": [
      ["aisha", "Is there a particular time you'd want to have something in place?"],
      [
        "hiro",
        "Not urgent. Ideally before our spring menu launch, because that's when we change the most recipes and the most things can go wrong.",
        "hiro-timing",
      ],
    ],
  },
};
