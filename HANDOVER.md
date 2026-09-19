# Parley handover

**Live app:** https://parley-smoky.vercel.app · **Code and setup:** [README.md](README.md)

Part 1 covers how to use Parley and set up each plugin. Part 2 compares it with Fathom and explains the choices behind the differences.

---

## Part 1: Using Parley

### 1. Pick a way in (landing page)

| Mode | For | Data |
|---|---|---|
| **Try now** | A quick test, no signup | Private workspace, deleted after 24 hours unless you sign in |
| **Sign in with Google** | Real use | Kept until you delete it, on every device. Try-now recordings carry over |
| **Reviewer demo** | Exploring with sample data | Maya Chen's 20 meetings, shared by all visitors |

**Take the 60-second tour** walks the landing page with a gradient cursor, then continues on the dashboard. **Tour** on the dashboard replays it.

### 2. Record a call

1. Paste a Zoom/Meet/Teams link on the landing page or dashboard, or press **Record** (on an upcoming calendar event to keep its attendees and agenda).
2. Choose **share tab audio**, pick the meeting's tab and turn on **Also share tab audio**. Your mic is added automatically.
3. Tick the consent box (paste the provided notice into the meeting chat), then **Record**.
4. During the call:
   - The transcript streams in with speakers.
   - **Live notes** fill with decisions, action items and questions.
   - **Scratchpad** keeps your private notes, stamped to the minute.
   - **Pause** stops recording; **Leave** lets you end or discard.
5. **End** the call: the summary, action items and clips are ready in seconds to a minute, depending on the model.

No meeting to hand? **Replay a sample** plays a real recorded call at up to 60× speed.

### 3. After the call

- **Meeting page:**
  - Summary in your template, action items with owners and due dates, highlights, clips and the full transcript.
  - Every item links to the line it came from.
  - Clips have shareable links.
- **Action items:** everything from all calls, ticked off in one place.
- **Search (⌘K):** every call, synonym-aware ("single sign-on" finds SSO and SAML).
- **Ask Parley:**
  - Questions across all meetings and your calendar, e.g. "What did customers say about pricing?" or "What's on this week?".
  - Every sentence is cited. Claims it can't back up are removed.

### 4. Plugin setup (Settings)

Each key or token is checked live before it's saved and stored encrypted. Only signed-in accounts can save them.

| Plugin | Where to get it | What it does |
|---|---|---|
| **Claude / ChatGPT / Hugging Face** | console.anthropic.com, platform.openai.com, huggingface.co → Access Tokens | Writes your notes, summaries and answers on your own key. Without one, the server's default model is used |
| **Deepgram** | console.deepgram.com → API Keys (Member role) | Live transcription on your own key |
| **Slack** | api.slack.com/apps → Create app → Incoming Webhooks → Add to channel | Posts a briefing when notes are ready: summary, agenda, talk time, action items with owners |
| **Notion** | notion.so/profile/integrations → new integration. Then in your database, **⋯ → Connections → add it** | One page per meeting, with action items as checkboxes |
| **HubSpot** | Settings → Integrations → Private apps, contacts read + write scopes | A note on every attendee who is a HubSpot contact. Record from a calendar event so attendee emails are known |
| **Calendar** | Google Calendar → Settings → your calendar → *Secret address in iCal format* (Outlook: *Publish calendar* → ICS) | Upcoming meetings with join-and-record, agendas and attendees |
| **API + MCP** | Settings → Access tokens → scope **read** | REST API and MCP server for Claude, Cursor or scripts. Command below |

```bash
claude mcp add --transport http parley https://parley-smoky.vercel.app/api/mcp --header "Authorization: Bearer parley_pat_…"
```

Then ask Claude things like "What action items came out of today's call?"

**Your data:**
- **Export everything** as one JSON file.
- **Auto-delete** meetings after 30, 90 or 365 days.
- **Delete your account.**
- Review sign-ins, key changes and deliveries under **Security activity**.

### 5. Running it (owner)

- **Deploy:** `npx vercel deploy --prod`
- **Environment variables:** listed in the [README](README.md#environment-variables). Keep `PARLEY_SECRET_KEY` unchanged forever.
- **Tests:** `npm run typecheck && npm run db:verify` needs no keys or network.
- **Google sign-in:** the OAuth client must list `https://parley-smoky.vercel.app/api/auth/google/callback`. Publish the consent screen so any Gmail account can sign in.
- **Speed:**
  - The default model is Hugging Face's free Qwen 72B. The first live notes take about 45 seconds and summaries can take a minute.
  - Adding `ANTHROPIC_API_KEY` in Vercel makes Claude the default, which is faster and cites more reliably.

---

## Part 2: Parley vs Fathom

### Where Parley matches Fathom

| Fathom | Parley |
|---|---|
| Records Zoom, Meet, Teams | Yes, from the browser tab (no bot) |
| Transcript with speakers | Yes, Deepgram nova-3 with diarization |
| AI summary with templates | Yes, template-driven, each point cited |
| Action items with owners | Yes, with due dates and a link to the moment |
| Highlights and clips | Yes (audio + transcript clips) |
| Ask Fathom | **Ask Parley**, across meetings *and* calendar |
| Search across calls | Yes, synonym-aware |
| Slack, Notion, HubSpot | Yes, per-user tokens |
| Calendar integration | Yes, via iCal link |

### Where Parley goes further

- **Every claim is traceable.** The model sees numbered transcript lines and must cite them. Invented citations and uncited sentences are removed, not shown.
- **Notes during the call,** not just after it.
- **Bring your own model:** Claude, ChatGPT or free Hugging Face, and Deepgram, on your own keys and bill.
- **Developer access:** REST API plus an MCP server, so AI assistants can read your meetings.
- **Private scratchpad,** and **no bot** in the call.
- **Open core:** self-hostable on Vercel and Postgres.

### What Fathom has that Parley doesn't, and why

| Missing | Why (the step back) |
|---|---|
| **A bot that joins calls** | Google Meet has no public API for a bot to hear a live call; its live-audio API is a developer preview that requires enrollment. Zoom bots need Zoom's app review and run a full client on a server. Teams media bots are Windows-only on Azure. A bot also stays in an hour-long call, which serverless functions can't host. Services like Recall.ai solve this but charge per meeting hour. Browser capture works on any call today, at no extra cost. |
| **Video recording** | Notes come from what people say, and the transcript carries nearly all of it. Audio is about 15-20 MB an hour; 720p video is about 600-700 MB, which would fill the free 0.5 GB database in one call. Video also needs a paid video service, heavier browser capture that phones can't do, and more sensitive data. Vision models cost far more per minute than text, and most free models are text-only, which would break bring-your-own-model. |
| **Google Calendar / Outlook sign-in** | Calendar read access is a "sensitive" Google permission that needs app verification: domain, privacy policy, demo video and review, taking days to weeks. Until then, users see an "unverified app" warning and only 100 test users can sign in. A secret iCal address gives the same events today with no review. The trade-off is periodic sync instead of instant push. Sign-in itself uses only name, email and photo, which need no review. |
| **Deep CRM sync (Salesforce, deal fields)** | Marketplace apps need partner review. Parley writes notes to HubSpot contacts with the user's own private-app token instead. |
| **Teams, admin, SSO, SOC 2, HIPAA** | These are organisation features and outside audits, not a 24-hour build. Parley ships the controls those audits look for (export, retention, deletion, audit log, encrypted secrets, consent notice) but no certification. |

### Next steps, if continued

1. A meeting bot through Recall.ai, behind a per-hour cost switch.
2. Move audio to Vercel Blob or R2 and enable the Mux video pipeline that's already designed.
3. Complete Google's app verification for true calendar sync.
4. Team workspaces with shared meetings and roles.
5. Store Ask Parley chat history in the database. Today it lives in the browser tab session.
