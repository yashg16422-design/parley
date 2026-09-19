import type { TourStep } from "./tour";

/** Walkthrough copy. Each target is a `data-tour` attribute on the page. */
export const LANDING_TOUR: TourStep[] = [
  { target: "join", title: "Paste a meeting link", body: "Drop in a Zoom, Google Meet or Teams link. Parley opens the call and records it from your browser. No bot joins, so nobody has to admit one." },
  { target: "try", title: "Try now, no signup", body: "One click gives you a private workspace with everything switched on. It's deleted after 24 hours unless you sign in." },
  { target: "google", title: "Full version", body: "Sign in with Google to keep recordings, notes, scratchpads, API keys, your calendar and Slack briefings, on every device." },
  { target: "demo", title: "Reviewer demo", body: "Maya Chen's 20 recorded meetings, an hour-long 8-person call, clips and a busy calendar. Shared by every visitor." },
  { target: "modes", title: "What each mode keeps", body: "Side by side: how long data lives, whether you need to sign in, and what's yours alone." },
  { target: "call", title: "Notes while you talk", body: "The transcript streams in with speakers, live notes pick out decisions and action items, and the scratchpad keeps your own notes stamped to the minute." },
  { target: "features", title: "Everything after the call", body: "Summaries in your template, action items with owners, highlights and shareable clips, all linked to the exact moment." },
  { target: "slack", title: "Slack briefing", body: "When notes are ready, your channel gets the summary, the agenda, who talked how much, and every action item with its owner." },
  { target: "ask", title: "Ask Parley", body: "Ask across every meeting and your calendar. Each sentence cites its source, and anything it can't back up is dropped rather than guessed." },
  { target: "integrations", title: "Your tools", body: "Send notes to Notion and HubSpot, connect your calendar with an iCal link, and plug Parley into Claude or Cursor with the API and MCP server." },
  { target: "open", title: "Bring your own keys", body: "Use Claude, ChatGPT or free Hugging Face models, and Deepgram for transcription, on your own keys and bill if you like." },
  { target: "demo", title: "Now look inside", body: "Head into a workspace. The tour continues on the dashboard." },
];

export const APP_TOUR: TourStep[] = [
  { target: "stats", title: "Your meetings at a glance", body: "Calls recorded, hours captured and action items still open." },
  { target: "record", title: "Record a call", body: "Record from your mic, and add the meeting tab's audio to capture everyone. Or replay a sample call to watch notes build live." },
  { target: "command", title: "Search or ask anything", body: "Find any moment across your calls, or ask a question. Press ⌘K from anywhere." },
  { target: "link", title: "Record by link", body: "Paste a Zoom, Meet or Teams link. Parley opens the call next to a recording room." },
  { target: "upcoming", title: "Upcoming calls", body: "The next seven days from your calendar. Join and start recording in one click." },
  { target: "meetings", title: "Your meetings", body: "Each card shows the AI summary, who was there and action-item progress. Open one for the transcript, notes, clips and your private scratchpad." },
  { target: "nav-ask", title: "Ask Parley", body: "Chat with all your meetings and your calendar. Every answer links to the exact moment." },
  { target: "nav-calendar", title: "Calendar", body: "Connect Google or Outlook with a secret iCal address (no OAuth needed) and choose which calls to record." },
  { target: "nav-tasks", title: "Action items", body: "Every commitment from every call, with owner and due date. Tick them off here." },
  { target: "nav-settings", title: "Settings", body: "Your own model and Deepgram keys, Slack, Notion and HubSpot, API tokens for MCP, and data export, retention and deletion." },
  { target: "account", title: "Your workspace", body: "Shows which mode you're in (demo, try-now or account). Leave or sign out from here. You can replay this tour from the dashboard." },
];
