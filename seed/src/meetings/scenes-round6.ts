import type { Line } from "../dsl";

/** Final top-ups for meetings within a few words of the slot-fill floor. */
export const round6Scenes: Record<string, Record<string, Line[]>> = {
  "design-crit-dashboard-v3": {
    "marcus-ranking": [["raj", "~And pinned themes shouldn't count toward the ranking, or they'll push everything else down the page."], ["marcus", "Good point. Pinned themes get their own row at the top."]],
  },
  "launch-planning-insights": {
    "elena-internal": [
      ["tom", "Can the FAQ include what to say when a customer asks to join the beta and there's no room?"],
      [
        "elena",
        "Yes. Something like: we're keeping it small so we can work closely with each team, and we'll let you know the moment it opens up. And we add them to the waitlist, so nobody is forgotten.",
        "elena-no-room",
      ],
      ["tom", "~Perfect. That's the question my team will get most."],
    ],
  },
  "1on1-maya-daniel": {
    "maya-bar": [["maya", "~And ask me for help early if anything slips. Surprises are the only thing I really mind."]],
  },
  "leadership-sync-weekly": {
    "chris-recovery": [["helen", "I'd also approve budget for an alerting tool trial, if Raj finds one that reduces noise. That's much cheaper than burnout."], ["raj", "~I'll look at options this week."]],
  },
  "1on1-maya-elena": {
    "elena-panel": [
      ["maya", "How would you recruit the panel?"],
      [
        "elena",
        "Start with the design partners, then ask Tom's team for a few customers who give great feedback in support conversations. People who already like telling us things are the best research participants.",
        "elena-recruit",
      ],
    ],
    "elena-recruit": [["maya", "~Love it. Let's talk about it again in two weeks."], ["elena", "Sounds good. Thanks, Maya."]],
  
  },
  "kestrel-discovery": {
    "grace-users": [["aisha", "~Would the regional managers only see their own region, or everything?"], ["grace", "Their own region by default, but able to look at others. Operations is a team sport here."]],
  },
  "brightline-checkin": {
    "tom-audit-detail": [
      ["maya", "And Olivia, if the audit finds something embarrassing on our side, we'll tell you plainly. No spin."],
      ["olivia", "I appreciate that. Honestly, that's the difference between a vendor and a partner."],
      ["tom", "Then let's be a partner. I'll send the summary by the end of the week, and let's book the next check-in for after you've seen it."],
      ["olivia", "~Sounds good. Thanks both, this was genuinely helpful."],
    ],
    "maya-data-private": [
      ["olivia", "And if we join, how much time would it take from my analysts each week?"],
      ["tom", "About an hour. The thirty minute check-in, plus a bit of time using it for real. Honestly, if it works, it should save them far more than an hour."],
      ["olivia", "~That's an easy trade, if it works."],
    ],
    "olivia-evidence": [["maya", "~Then let's make sure you have numbers. Tom will include before and after accuracy in the audit summary."]],
  
  },
  "postmortem-ingest-delay": {
    "raj-progress-check": [["sam", "I can take the progress-based health check, since I'm already in that code for the lag alert."], ["raj", "~Great, thanks Sam. Add it to the doc as yours."]],
    "tom-requests": [["tom", "~I'll add both requests to the doc, with the customer names, so we can tell them when it ships."]],
  
  },

  "interview-backend-jordan": {
    "jordan-three-charts": [
      ["priya", "And for the ML side, would you add anything?"],
      ["jordan", "Probably the drift number we talked about, the share of fast-path assignments the nightly job disagrees with. If that climbs, the product is quietly getting worse, even if every system chart looks healthy."],
      ["priya", "~I'm stealing that for our dashboard."],
    ],
  },
  "interview-designer-sofia": {
    "sofia-label-test": [["maya", "~And we'd learn which style customers trust, which matters as much as which one they act on."], ["sofia", "Exactly. Trust and action are related, but they're not the same thing. I'd measure both."]],
  },
  "interview-csm-andre": {
    "andre-mistake": [
      ["aisha", "And from a sales point of view, how do you like to hear about deals that are coming your way?"],
      ["andre", "As early as possible. Even a quick note when a deal reaches the proposal stage. Then I can learn the account before they sign, instead of starting cold on day one."],
      ["aisha", "~We can definitely do that."],
    ],
  },
  "arcadia-discovery": {
    "rosa-pilot": [["imran", "~And a single hospital keeps the security review scope smaller, which helps us too."], ["aisha", "That's a great way to start. I'll put a pilot proposal together once we've been through the security questionnaire."]],
  },
};
