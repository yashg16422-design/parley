import { defineMeeting } from "../dsl";
import { D, staff } from "../workspace";

/** The morning of the alignment call - the "date in writing" ask comes from here. */
export const globexSecurity = defineMeeting({
  key: "globex-security-review",
  title: "Globex: security & roadmap review",
  meetingType: "sales",
  defaultTemplate: "sales_discovery",
  platform: "zoom",
  owner: D("aisha"),
  startedAt: "D-2@13:30",
  scheduledMin: 30,
  participants: {
    aisha: staff("aisha"),
    daniel: staff("daniel"),
    noah: staff("noah"),
    victor: { name: "Victor Hale", email: "victor.hale@globex.example", title: "CISO", company: "Globex", external: true },
    nadia: { name: "Nadia Simmons", email: "nadia.simmons@globex.example", title: "IT Security Manager", company: "Globex", external: true },
  },
  script: [
    ["aisha", "Victor, Nadia, thanks for making time. I know security reviews aren't anyone's favorite meeting. I brought Daniel, who owns our integrations and identity roadmap, and Noah from solutions engineering."],
    ["victor", "Thanks Aisha. I'll be direct, because I think that's the most useful thing. Your product did very well in our evaluation. My team likes it. The only thing standing between us and procurement is identity and auditability.", "victor-direct"],
    ["aisha", "That's really good to hear. Walk us through what you need."],
    [
      "victor",
      "Three things. First, SAML single sign-on through Okta, and we need to be able to enforce it. No local passwords for our employees. Second, audit logs. Who logged in, who exported data, who changed permissions. Retained for at least a year. Third, a committed date for both, in writing.",
      "victor-three",
    ],
    ["nadia", "~And ideally SCIM, so accounts are removed automatically when someone leaves. But that's a nice-to-have, not a blocker.", "nadia-scim"],
    [
      "daniel",
      "That's very clear, thank you. On SAML, we're building it with Okta and Azure AD as the first two providers, with an 'enforce SSO' setting for admins. On audit logs, the events you listed are exactly the ones in our draft. SCIM would come after the first release.",
      "daniel-plan",
    ],
    ["victor", "And the date?"],
    [
      "aisha",
      "Honest answer: we have our quarterly planning session later today, where we're making the final call on sequencing. I'd rather give you a date that comes out of that than guess now. I'll come back to you with a written date by end of next week.",
      "aisha-date",
    ],
    ["victor", "I can work with that. If I have a date in writing by end of next week, we can start procurement this quarter. If it slips past that, we're into next fiscal year, and that means a full re-approval.", "victor-fiscal"],
    ["aisha", "Understood. That's exactly why I don't want to guess."],
    [
      "nadia",
      "Can I ask about the audit logs? We send everything to Splunk. Is there a native integration, or an API we can pull from?",
      "nadia-splunk",
    ],
    [
      "daniel",
      "At launch there'll be a CSV export and an API endpoint for audit logs. A native Splunk app is on the list, but not in the first release. Most teams we talk to pull from the API on a schedule.",
    ],
    ["nadia", "The API is fine. We do that for a dozen other vendors."],
    [
      "victor",
      "A few other questions from the questionnaire. Where is our data stored, is it encrypted at rest, and does any of our customer feedback get sent to a third party AI provider?",
      "victor-data",
    ],
    [
      "noah",
      "Data is stored in the US, encrypted at rest and in transit. For the AI features, feedback text is sent to our model provider for processing, under an agreement that it isn't used for training and isn't retained. We also redact emails and phone numbers before anything is sent.",
      "noah-data",
    ],
    ["victor", "Can you put that in a data flow diagram? My team will want to see exactly where the text goes."],
    ["daniel", "Yes. I'll send you a data flow diagram for the AI features, including what's redacted and where.", "daniel-diagram"],
    [
      "nadia",
      "One more practical thing. Could we get a sandbox workspace, so my team can test the admin settings and the audit log export ourselves once they exist?",
    ],
    ["noah", "Absolutely. I'll set up a sandbox workspace for your team this week and send over the credentials.", "noah-sandbox"],
    ["aisha", "Let me recap. Written SSO and audit log date from me by end of next week. The data flow diagram from Daniel. A sandbox from Noah. And we'll update the security questionnaire answers with everything we discussed."],
    ["victor", "That's right. Thank you, this was a productive conversation. Better than most vendor security reviews, honestly."],
    ["aisha", "We'll take that. Thanks both, talk soon."],
  ],
  actionItems: [
    { text: "Send Globex a written date for SAML SSO and audit logs", owner: "aisha", at: "aisha-date", quote: "I'll come back to you with a written date by end of next week", due: "D+5", dueText: "by end of next week" },
    { text: "Send Globex a data flow diagram for the AI features, including redaction", owner: "daniel", at: "daniel-diagram", quote: "I'll send you a data flow diagram for the AI features", due: "D+3" },
    { text: "Set up a sandbox workspace for Globex's security team", owner: "noah", at: "noah-sandbox", quote: "I'll set up a sandbox workspace for your team this week", due: "D+2", dueText: "this week", status: "done" },
  ],
  highlights: [
    { at: "victor-three", label: "Globex requirements: enforced SAML, 1-year audit logs, written date" },
    { at: "victor-fiscal", label: "Date needed by end of next week or the deal slips a fiscal year" },
  ],
  clips: [{ slug: "globex-requirements", title: "Globex CISO: what it takes to sign", from: "victor-direct", to: "victor-three", views: 23, by: "aisha" }],
  knowledge: {
    overview: "Globex's CISO confirmed the product passed evaluation; procurement is blocked only on enforced SAML SSO (Okta), one-year audit logs, and a written delivery date, which Aisha will send after the internal planning session.",
    topics: [
      { title: "Requirements", summary: "Enforced SAML via Okta, audit logs retained 1+ year, a written date; SCIM is a nice-to-have.", from: "victor-direct", to: "nadia-scim" },
      { title: "Roadmap and timing", summary: "Okta and Azure AD first, enforce-SSO, SCIM later. A date by end of next week keeps procurement in this fiscal year.", from: "daniel-plan", to: "victor-fiscal" },
      { title: "Audit log export", summary: "CSV and API at launch; a native Splunk app later. The API is acceptable.", from: "nadia-splunk", to: "nadia-splunk" },
      { title: "Data handling", summary: "US storage, encryption at rest and in transit; AI provider doesn't train on or retain data; emails and phone numbers redacted.", from: "victor-data", to: "daniel-diagram" },
    ],
    decisions: [["Globex will accept audit log access via API instead of a native Splunk integration.", "nadia-splunk"]],
    openQuestions: [["What exact SSO and audit log date can Driftwood commit to in writing?", "aisha-date"]],
    speakerContributions: {
      victor: "Set the three requirements and the fiscal-year deadline.",
      nadia: "Asked about SCIM, Splunk export and a sandbox.",
      aisha: "Committed to a written date after internal planning.",
      daniel: "Explained the SAML and audit log roadmap; owns the data flow diagram.",
      noah: "Answered data handling questions; owns the sandbox.",
    },
  },
  summaries: {
    sales_discovery: {
      company: ["Globex: late-stage enterprise evaluation (~$260K ACV); the product passed their evaluation."],
      pain: [["The security team won't approve any tool without enforced SSO and audit trails.", "victor-direct", "victor-three"]],
      current_solution: ["Not discussed; the evaluation is already complete."],
      requirements: [
        ["Enforced SAML SSO via Okta; no local passwords.", "victor-three"],
        ["Audit logs (logins, exports, permission changes) kept for at least one year; API access for Splunk.", "victor-three", "nadia-splunk"],
        ["A data flow diagram for the AI features.", "victor-data"],
        ["SCIM deprovisioning (nice-to-have).", "nadia-scim"],
      ],
      budget_timeline: [["Budget is use-it-or-lose-it this fiscal year; a written date is needed by end of next week to start procurement.", "victor-fiscal"]],
      decision_process: [["Victor (CISO) is the gate; procurement follows his sign-off.", "victor-fiscal"]],
      next_steps: [
        ["Aisha: written SSO and audit log date by end of next week.", "aisha-date"],
        ["Daniel: data flow diagram.", "daniel-diagram"],
        ["Noah: sandbox workspace this week.", "noah-sandbox"],
      ],
    },
    exec_brief: {
      tldr: [["Globex (~$260K) is ready to buy once we commit in writing to SAML SSO and audit logs.", "victor-direct", "victor-three"]],
      decisions: [["An API for audit logs is acceptable; no Splunk app needed at launch.", "nadia-splunk"]],
      risks: [["Missing the end-of-next-week date pushes the deal into next fiscal year (full re-approval).", "victor-fiscal"]],
      asks: [["Leadership to confirm an SSO date that Aisha can put in writing.", "aisha-date"]],
    },
  },
});

/** Mid-market discovery; Grace becomes a design-partner candidate. */
export const kestrelDiscovery = defineMeeting({
  key: "kestrel-discovery",
  title: "Kestrel Logistics: discovery call",
  meetingType: "sales",
  defaultTemplate: "sales_discovery",
  platform: "teams",
  owner: D("aisha"),
  startedAt: "D-9@17:00",
  scheduledMin: 30,
  participants: {
    aisha: staff("aisha"),
    noah: staff("noah"),
    grace: { name: "Grace Liu", email: "grace.liu@kestrel.example", title: "VP of Operations", company: "Kestrel Logistics", external: true },
    ben: { name: "Ben Carter", email: "ben.carter@kestrel.example", title: "IT Manager", company: "Kestrel Logistics", external: true },
  },
  script: [
    ["aisha", "Grace, Ben, thanks for joining. I'd love to spend most of this call understanding how you work today, and then Noah can show you anything that's relevant. Grace, maybe start with your team?"],
    [
      "grace",
      "Sure. Kestrel is a regional logistics company, about four hundred people. I run operations, which includes our customer support team, about sixty people. We deal with two kinds of customers, the shippers who pay us, and the people receiving deliveries, who don't pay us but definitely complain to us.",
      "grace-company",
    ],
    ["aisha", "Ha. Where does the feedback come from today?"],
    [
      "grace",
      "Everywhere. Support tickets in Zendesk, reviews of our driver and tracking apps, an NPS survey we send shippers every quarter, and a lot of notes our account managers write after calls.",
      "grace-sources",
    ],
    ["aisha", "And what happens with it?"],
    [
      "grace",
      "Honestly, that's the problem. Every week we have an operations review, and one of our analysts spends almost two full days pulling tickets and reviews into a spreadsheet so we can see what's going on. By the time we see a trend, it's two weeks old.",
      "grace-pain",
    ],
    [
      "grace",
      "Last spring we had a spike in complaints about missed delivery windows in one region. It was right there in the tickets. We didn't catch it for almost a month, and we lost one of our bigger shippers over it.",
      "grace-lost-shipper",
    ],
    ["aisha", "That's painful. How big was that shipper, roughly?"],
    ["grace", "Around four hundred thousand a year in revenue for us. So it got the CEO's attention."],
    ["noah", "~I can imagine."],
    [
      "aisha",
      "What have you tried so far? Any tools?",
    ],
    [
      "grace",
      "We built a BI dashboard on top of Zendesk tags. But the tags are inconsistent, every agent tags differently, so the dashboard is only as good as the tagging. And it doesn't cover app reviews or NPS at all.",
      "grace-current",
    ],
    [
      "ben",
      "From the IT side, I'll add that we looked at one of the AI insights tools a couple of months ago. The demo was impressive, but it's priced per seat, and we'd want most of the support team to have access. That got expensive fast.",
      "ben-competitor",
    ],
    ["aisha", "That's helpful to know. What would good look like, if you could wave a wand?"],
    [
      "grace",
      "Monday morning, I open one screen and it tells me the top five things customers are unhappy about, whether they're getting worse, and I can click through to the actual tickets. And I want my regional managers to see the same thing for their region.",
      "grace-wand",
    ],
    [
      "noah",
      "That's very close to what we're building with our themes view. It groups feedback from every source into themes, ranks them by volume and growth, and every theme links back to the underlying comments. Let me show you a quick version on sample data.",
      "noah-demo",
    ],
    { pause: 15000 },
    ["grace", "Oh, that's exactly it. The growth arrows especially."],
    ["ben", "What do you need from us technically to set this up? Do you need SSO or anything like that?"],
    [
      "noah",
      "For a team your size, Google sign-in is usually enough. Zendesk connects with an API token, and we can backfill ninety days of history. App store reviews are just a public connector.",
      "noah-setup",
    ],
    ["ben", "Google sign-in is fine for us. That's easy."],
    ["aisha", "Can I ask about budget and timing? Is there a budget set aside for this?"],
    [
      "grace",
      "Not formally. I think we could spend thirty to forty thousand a year if the value is clear. Anything over twenty-five thousand needs our CFO to sign off, and he'll want to see numbers.",
      "grace-budget",
    ],
    ["aisha", "That's very reasonable. And timing?"],
    ["grace", "I'd like something running by early next quarter, before our peak season. That's when the complaints really spike."],
    [
      "aisha",
      "One more thing. We're about to start an early access program for the new themes view, with a small group of customers. It's free during the program, and you'd work closely with our product team. Based on what you've described, you'd be a great fit.",
      "aisha-design-partner",
    ],
    ["grace", "~I'd be very interested in that."],
    [
      "aisha",
      "Great. So, next steps from our side. Noah will run a trial with your real Zendesk data so you can see your own themes. I'll send a proposal, and I'll check with our product team about the early access program.",
    ],
    ["noah", "I'll set up a trial workspace with your Zendesk export by end of week.", "noah-trial"],
    ["aisha", "And I'll send a proposal with pricing for the CFO conversation, and get back to you about early access.", "aisha-proposal"],
    ["grace", "Perfect. Thank you both, this is the most useful call I've had with a vendor this year."],
  ],
  actionItems: [
    { text: "Set up a Kestrel trial workspace from their Zendesk export", owner: "noah", at: "noah-trial", quote: "I'll set up a trial workspace with your Zendesk export by end of week", due: "D-6", dueText: "by end of week", status: "done" },
    { text: "Send Kestrel a proposal for the CFO and follow up on early access", owner: "aisha", at: "aisha-proposal", quote: "I'll send a proposal with pricing for the CFO conversation", due: "D-5", status: "done" },
  ],
  highlights: [
    { at: "grace-lost-shipper", label: "Missed trend cost Kestrel a ~$400K shipper" },
    { at: "grace-wand", label: "Grace's 'one screen on Monday morning' wish" },
  ],
  clips: [{ slug: "kestrel-monday-morning", title: "Kestrel: what good looks like", from: "grace-pain", to: "grace-wand", views: 12, by: "aisha" }],
  knowledge: {
    overview: "Discovery with Kestrel Logistics (400 people, 60-person support team). Their analyst spends two days a week compiling feedback by hand, and a missed trend cost them a ~$400K shipper. The Themes view matches their need closely; budget is $30-40K, and Grace is a strong design-partner candidate.",
    topics: [
      { title: "Company and feedback sources", summary: "Regional logistics; Zendesk, app reviews, shipper NPS and account manager notes.", from: "grace-company", to: "grace-sources" },
      { title: "Pain", summary: "Two days per week compiling a spreadsheet; trends seen two weeks late; lost a ~$400K shipper.", from: "grace-pain", to: "grace-lost-shipper" },
      { title: "Current solution and competition", summary: "BI dashboard on inconsistent Zendesk tags; a per-seat AI competitor was too expensive.", from: "grace-current", to: "ben-competitor" },
      { title: "Desired outcome and demo", summary: "One Monday screen of top themes with growth and click-through; the themes demo landed.", from: "grace-wand", to: "noah-setup" },
      { title: "Budget and timing", summary: "$30-40K per year; CFO sign-off above $25K; live before peak season next quarter.", from: "grace-budget", to: "aisha-design-partner" },
    ],
    decisions: [["Google sign-in is sufficient; no SAML needed.", "noah-setup"]],
    openQuestions: [["Will the CFO approve above $25K, and on what ROI numbers?", "grace-budget"]],
    speakerContributions: {
      grace: "Described operations, the pain and the ideal outcome; champion.",
      ben: "IT view: per-seat competitor pricing concern; setup requirements.",
      aisha: "Ran discovery; offered early access.",
      noah: "Demoed themes; owns the trial.",
    },
  },
  summaries: {
    sales_discovery: {
      company: [["Kestrel Logistics: regional logistics, ~400 employees, 60-person support team under Grace (VP Ops).", "grace-company"]],
      pain: [
        ["An analyst spends almost two days every week building a feedback spreadsheet; trends arrive two weeks late.", "grace-pain"],
        ["Missed a regional spike in 'missed delivery window' complaints and lost a ~$400K/year shipper.", "grace-lost-shipper"],
      ],
      current_solution: [
        ["BI dashboard on Zendesk tags; tagging is inconsistent, and app reviews and NPS aren't covered.", "grace-current"],
        ["Evaluated an AI insights competitor; per-seat pricing was too expensive.", "ben-competitor"],
      ],
      requirements: [
        ["A top-5 themes view with trend and click-through to tickets, including per-region views.", "grace-wand"],
        ["Sources: Zendesk, app reviews, NPS, account manager notes.", "grace-sources"],
        ["Google sign-in is enough.", "noah-setup"],
      ],
      budget_timeline: [["$30-40K per year if value is clear; live by early next quarter, before peak season.", "grace-budget"]],
      decision_process: [["Grace is the champion; the CFO signs above $25K and will want numbers.", "grace-budget"]],
      next_steps: [
        ["Noah: trial workspace with their Zendesk export.", "noah-trial"],
        ["Aisha: proposal for the CFO; follow up on early access.", "aisha-proposal", "aisha-design-partner"],
      ],
    },
  },
});

/** Enterprise healthcare discovery; Azure AD and PHI come up immediately. */
export const arcadiaDiscovery = defineMeeting({
  key: "arcadia-discovery",
  title: "Arcadia Health: discovery call",
  meetingType: "sales",
  defaultTemplate: "sales_discovery",
  platform: "zoom",
  owner: D("aisha"),
  startedAt: "D-13@16:00",
  scheduledMin: 30,
  participants: {
    aisha: staff("aisha"),
    noah: staff("noah"),
    rosa: { name: "Rosa Delgado", email: "rosa.delgado@arcadiahealth.example", title: "Director of Patient Experience", company: "Arcadia Health", external: true },
    imran: { name: "Imran Qureshi", email: "imran.qureshi@arcadiahealth.example", title: "IT Lead, Enterprise Applications", company: "Arcadia Health", external: true },
  },
  script: [
    ["aisha", "Rosa, Imran, thank you for the time. I'd like to understand your world first. Rosa, tell me about patient experience at Arcadia."],
    [
      "rosa",
      "Of course. Arcadia runs eleven hospitals and about ninety clinics. Patient services is roughly three thousand people, including our call centers. My team is responsible for understanding what patients are telling us and making sure it reaches the people who can fix it.",
      "rosa-company",
    ],
    [
      "imran",
      "Before we go too far, I want to put one thing on the table, just so nobody wastes time. Anything we buy has to support SAML single sign-on through Azure AD. That's non-negotiable for our security committee.",
      "imran-azure",
    ],
    ["aisha", "Thank you for saying that up front, I really appreciate it. SAML SSO is on our roadmap now. I'll get you specifics on timing. What else does the security committee look for?"],
    [
      "imran",
      "A business associate agreement, because some of this feedback will contain patient information. Clear data retention. And a detailed security questionnaire, it's about forty pages.",
      "imran-baa",
    ],
    ["noah", "~We've done a few of those. Send it over whenever you're ready."],
    ["aisha", "Rosa, what does the feedback look like today? Where does it come from?"],
    [
      "rosa",
      "Three main places. Comments from our patient portal, notes from the call center, and reviews of our mobile app. Plus surveys after visits. It's a huge amount of text, tens of thousands of comments a month.",
      "rosa-sources",
    ],
    ["aisha", "And how do you make sense of it today?"],
    [
      "rosa",
      "Mostly by sampling. My analysts read a few hundred comments a month and write a report. It's thoughtful, but it's a tiny fraction. I'm always worried about what we're missing, especially anything related to safety or access to care.",
      "rosa-pain",
    ],
    [
      "rosa",
      "For example, last year there was a problem with appointment reminders not being sent in one region. Patients were complaining about it in the portal for weeks. We only found out when a clinic manager escalated it.",
      "rosa-example",
    ],
    ["aisha", "That's exactly the kind of thing we want to surface. Noah, maybe a quick look at the themes view?"],
    [
      "noah",
      "Sure. The idea is simple. We take every comment, from every source, and group them into themes. Each theme has a label, a count, a trend, and representative quotes, and you can always click through to the actual comments.",
      "noah-themes",
    ],
    { pause: 12000 },
    ["rosa", "This is exactly what I've been trying to build with spreadsheets. Can it separate by hospital?"],
    ["noah", "Yes, any field on the feedback, like location or department, can be used as a filter on themes."],
    [
      "imran",
      "My question is where the text goes. If a comment includes a patient's name or a medical record number, and you send that to an AI model, that's a problem for us.",
      "imran-phi",
    ],
    [
      "noah",
      "That's a fair concern. Today we redact emails and phone numbers before any text reaches the model. For healthcare customers, we'd want to extend that to names and record numbers. I'll confirm the plan with our product team and follow up in writing.",
      "noah-phi",
    ],
    ["imran", "That would need to be in place before we send real patient data. I'd want to see it."],
    ["aisha", "Understood. Rosa, can I ask about budget and timing?"],
    [
      "rosa",
      "We have budget approved for a patient feedback platform this year, a bit over one hundred and fifty thousand. We'd want to go live in the first quarter. The decision goes through our CIO and the security committee, and then procurement.",
      "rosa-budget",
    ],
    ["aisha", "Is anyone else in the running?"],
    ["rosa", "Our current survey vendor is pitching an add-on. Honestly, it's not great, but it's the easy option because they're already approved."],
    [
      "aisha",
      "That's helpful context. So next steps. I'll send the SSO timeline and our BAA template. Imran, if you can send the security questionnaire, we'll start on it. And let's schedule a technical deep dive with your team and our integrations lead.",
      "aisha-next",
    ],
    ["imran", "I'll send the questionnaire today.", "imran-questionnaire"],
    ["rosa", "Thank you both. This is the first tool I've seen that could actually replace the sampling."],
  ],
  actionItems: [
    { text: "Send Arcadia the SSO timeline and BAA template; schedule a technical deep dive", owner: "aisha", at: "aisha-next", quote: "I'll send the SSO timeline and our BAA template", status: "done" },
    { text: "Confirm PII redaction plan (names, record numbers) for healthcare in writing", owner: "noah", at: "noah-phi", quote: "I'll confirm the plan with our product team and follow up in writing" },
    { text: "Send the 40-page security questionnaire", owner: "imran", at: "imran-questionnaire", quote: "I'll send the questionnaire today", due: "D-13", dueText: "today", status: "done" },
  ],
  highlights: [
    { at: "imran-azure", label: "Azure AD SAML is non-negotiable" },
    { at: "rosa-example", label: "Missed appointment-reminder issue for weeks" },
  ],
  clips: [{ slug: "arcadia-phi-concern", title: "Arcadia IT on patient data and AI", from: "imran-phi", to: "noah-phi", views: 15, by: "aisha" }],
  knowledge: {
    overview: "Discovery with Arcadia Health (11 hospitals, ~3,000 patient services staff). They need themes across tens of thousands of monthly patient comments; the gates are Azure AD SAML, a BAA, and PII redaction before real patient data. Budget is ~$160K for a Q1 go-live.",
    topics: [
      { title: "Company", summary: "11 hospitals, ~90 clinics, ~3,000 patient services staff.", from: "rosa-company", to: "rosa-company" },
      { title: "Security gates", summary: "Azure AD SAML (non-negotiable), BAA, retention policy, 40-page questionnaire.", from: "imran-azure", to: "imran-baa" },
      { title: "Feedback today", summary: "Portal, call center, app reviews, surveys; analysts sample a few hundred comments a month and miss issues.", from: "rosa-sources", to: "rosa-example" },
      { title: "Themes demo and PHI", summary: "Themes with per-hospital filters resonated; PII redaction needed before patient data is sent.", from: "noah-themes", to: "noah-phi" },
      { title: "Budget and process", summary: "~$150K+ approved; Q1 go-live; CIO, security committee, procurement; incumbent survey vendor competing.", from: "rosa-budget", to: "aisha-next" },
    ],
    decisions: [],
    openQuestions: [["When can PII redaction for names and record numbers be in place?", "imran-phi", "noah-phi"]],
    speakerContributions: {
      rosa: "Explained the patient feedback problem; champion with approved budget.",
      imran: "Set the security gates: Azure AD SAML, BAA, redaction.",
      aisha: "Ran discovery and next steps.",
      noah: "Demoed themes; owns the redaction follow-up.",
    },
  },
  summaries: {
    sales_discovery: {
      company: [["Arcadia Health: 11 hospitals, ~90 clinics, ~3,000 patient services staff.", "rosa-company"]],
      pain: [
        ["Analysts sample only a few hundred of tens of thousands of monthly comments.", "rosa-sources", "rosa-pain"],
        ["Missed a regional appointment-reminder failure for weeks.", "rosa-example"],
      ],
      current_solution: [["Manual sampling and reports; the incumbent survey vendor is pitching an add-on.", "rosa-pain", "rosa-budget"]],
      requirements: [
        ["SAML SSO via Azure AD (non-negotiable).", "imran-azure"],
        ["BAA, data retention policy, 40-page security questionnaire.", "imran-baa"],
        ["Redaction of names and record numbers before any text reaches the AI model.", "imran-phi"],
        ["Filter themes by hospital and department.", "noah-themes"],
      ],
      budget_timeline: [["A bit over $150K approved this year; go-live in Q1.", "rosa-budget"]],
      decision_process: [["Rosa is the champion; CIO and security committee approve, then procurement.", "rosa-budget"]],
      next_steps: [
        ["Aisha: SSO timeline, BAA template, technical deep dive.", "aisha-next"],
        ["Noah: redaction plan in writing.", "noah-phi"],
        ["Imran: security questionnaire.", "imran-questionnaire"],
      ],
    },
  },
});

/** Short mid-market intro; Jira comes up, price-sensitive. */
export const juniperIntro = defineMeeting({
  key: "juniper-intro",
  title: "Juniper Foods: intro call",
  meetingType: "sales",
  defaultTemplate: "sales_discovery",
  platform: "teams",
  owner: D("aisha"),
  startedAt: "D-12@18:00",
  scheduledMin: 15,
  participants: {
    aisha: staff("aisha"),
    hiro: { name: "Hiro Tanaka", email: "hiro.tanaka@juniperfoods.example", title: "Head of Customer Experience", company: "Juniper Foods", external: true },
  },
  script: [
    ["aisha", "Hiro, thanks for reaching out after the webinar. What made you get in touch?"],
    [
      "hiro",
      "So, Juniper is a meal kit company, about a hundred and fifty people. We get a lot of feedback, mostly through app reviews and our support inbox. When something goes wrong, like a bad batch of an ingredient, reviews spike and we find out a few days too late.",
      "hiro-company",
    ],
    ["aisha", "How do you find out today?"],
    ["hiro", "Usually someone on the team notices the app rating dropping. By then it's already in the reviews, publicly, which is the worst place for it."],
    ["aisha", "What happens once you spot something?"],
    [
      "hiro",
      "That's the second problem. If it's a bug in the app, I have to write it up and put it in Jira for the product team. It's manual, and half the time the context gets lost. Being able to send a theme straight to Jira would save me a lot of time.",
      "hiro-jira",
    ],
    [
      "aisha",
      "That's a common request. I'll be transparent, a full two-way Jira integration isn't available yet. A simpler way to create a Jira issue from a theme is something the team is actively discussing.",
      "aisha-jira",
    ],
    ["hiro", "Even one way would be enough for me. I don't need it to sync back."],
    ["aisha", "That's really useful to hear. Can I ask about budget?"],
    [
      "hiro",
      "We're a small team, so it's tight. I'd guess ten to fifteen thousand a year at most. I'd need to see pricing before I can take it to our COO.",
      "hiro-budget",
    ],
    [
      "aisha",
      "Understood. Let me send you our pricing sheet and a short recorded demo you can share with your COO. Then let's do a proper follow-up discovery in a couple of weeks, once you've had a look.",
      "aisha-followup",
    ],
    ["hiro", "That works for me. Thanks, Aisha."],
  ],
  actionItems: [
    { text: "Send Juniper the pricing sheet and a recorded demo; book follow-up discovery", owner: "aisha", at: "aisha-followup", quote: "Let me send you our pricing sheet and a short recorded demo", status: "done" },
  ],
  highlights: [{ at: "hiro-jira", label: "Even a one-way Jira button would help" }],
  knowledge: {
    overview: "Intro with Juniper Foods (meal kits, ~150 people). Issues surface late in public app reviews, and routing bugs into Jira is manual. A one-way Jira button would satisfy them. Budget is tight at $10-15K.",
    topics: [
      { title: "Pain", summary: "Review spikes found days late; manual Jira write-ups lose context.", from: "hiro-company", to: "hiro-jira" },
      { title: "Jira", summary: "No full integration yet; Hiro only needs one-way issue creation.", from: "aisha-jira", to: "aisha-jira" },
      { title: "Budget", summary: "$10-15K per year; COO approval after seeing pricing.", from: "hiro-budget", to: "aisha-followup" },
    ],
    decisions: [],
    openQuestions: [["Can a one-way Jira button ship in time for Juniper's evaluation?", "hiro-jira", "aisha-jira"]],
    speakerContributions: {
      hiro: "Described late detection and the Jira handoff pain; price-sensitive.",
      aisha: "Set expectations on Jira; sending pricing and a demo.",
    },
  },
  summaries: {
    sales_discovery: {
      company: [["Juniper Foods: meal-kit company, ~150 people; feedback via app reviews and the support inbox.", "hiro-company"]],
      pain: [
        ["Ingredient or app problems surface days late, publicly in app reviews.", "hiro-company"],
        ["Manual bug write-ups into Jira lose context.", "hiro-jira"],
      ],
      current_solution: ["Watching the app rating and the support inbox by hand."],
      requirements: [["One-way 'create Jira issue' from a theme is enough; no sync needed.", "hiro-jira"]],
      budget_timeline: [["$10-15K per year at most; no hard timeline.", "hiro-budget"]],
      decision_process: [["Hiro takes pricing to the COO.", "hiro-budget"]],
      next_steps: [["Aisha: pricing sheet, recorded demo, follow-up discovery in two weeks.", "aisha-followup"]],
    },
  },
});
