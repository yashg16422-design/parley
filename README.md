# Parley

AI meeting notes that cite their sources. An open-core clone of [Fathom](https://fathom.video), built in 24 hours on Next.js, Vercel and Neon Postgres.

- **Live:** https://parley-smoky.vercel.app
- **Handover guide (how to use it, and how it compares with Fathom):** [HANDOVER.md](HANDOVER.md) · [illustrated PDF](docs/Parley-Handover.pdf)

Parley records Zoom, Google Meet and Teams calls **from your browser**: your mic plus the meeting tab's audio, with no bot joining the call. It transcribes live with Deepgram and writes notes while you talk. When the call ends you get a summary, action items with owners, clips and a Slack briefing. Every note links to the exact line of the transcript it came from.

## Features

| Area | What it does |
|---|---|
| Recording | Mic + meeting-tab audio in the browser, pause/leave/discard, consent notice, audio archive with seekable playback |
| Transcription | Deepgram nova-3 streaming with speaker diarization; typed-line fallback without a key |
| Live notes | Decisions, action items and questions during the call: AI on closed 10-minute windows and on the open end (refreshed ~30s), rule-based for the newest lines |
| After the call | Summary in your template, action items with owners and due dates, highlights, shareable clips; every item cites its transcript line |
| Ask Parley | Chat across all meetings **and** your calendar; every sentence cited; uncited sentences are dropped |
| Search | Full-text across calls with synonyms (SSO = single sign-on = SAML), ⌘K command bar |
| Scratchpad | Private per-meeting notes, stamped to the minute, never sent to AI |
| Calendar | Google/Outlook/iCloud via a secret iCal address (no OAuth); join-and-record from upcoming events |
| Integrations | Slack briefing, Notion page per meeting, HubSpot note on matched contacts; each user's own tokens |
| Models (BYOK) | Claude, ChatGPT or Hugging Face, from the user's key or the server's, tried in that order with fallthrough |
| Developer | REST API (`/api/v1`) and a read-only MCP server (`/api/mcp`) with personal access tokens |
| Accounts | Try now (no signup, deleted after 24 h), Sign in with Google, shared reviewer demo |
| Data controls | Export everything (JSON), retention (30/90/365 days), delete account, security activity log |
| Onboarding | Guided tour with a gradient cursor on the landing page and dashboard |

## Quick start

```bash
npm install
cp .env.example .env.local     # set DATABASE_URL at minimum, or use pglite:./.pglite
npm run db:migrate
npm run db:seed                # demo workspace: Maya Chen, 20 meetings
npm run dev                    # http://localhost:3000
```

No cloud database needed locally: `DATABASE_URL=pglite:./.pglite` (also set `DATABASE_URL_UNPOOLED` to the same value for `db:migrate`) runs an embedded Postgres.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Neon **pooled** connection string (or `pglite:./.pglite`) |
| `DATABASE_URL_UNPOOLED` | yes | Neon direct connection, used by migrations |
| `PARLEY_SECRET_KEY` | yes | 32+ random chars (`openssl rand -base64 32`). Signs sessions, encrypts stored keys. **Never rotate after launch.** |
| `CRON_SECRET` | production | Protects `/api/cron/sweep` (`openssl rand -hex 32`) |
| `APP_URL` | production | Public base URL, no trailing slash. Used for links in Slack/Notion/HubSpot/API |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | for accounts | Google OAuth web client; redirect URI `<APP_URL>/api/auth/google/callback` |
| `DEEPGRAM_API_KEY` | recommended | Live transcription (key role Member or higher) |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | optional | Default model for everyone (`claude-opus-5`) |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | optional | Fallback model (`gpt-5-mini`) |
| `HF_TOKEN`, `HF_MODELS` | optional | Free Hugging Face models, tried in order |
| `SLACK_WEBHOOK_URL` | optional | Server-wide briefing channel, **demo workspace only** |

Users' own keys (Settings) always win over the server's. Notion and HubSpot have no server-wide key: they're per user.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js dev server / production build / serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:migrate` | Apply `drizzle/*.sql` to `DATABASE_URL_UNPOOLED` (or `DATABASE_URL`) |
| `npm run db:seed` | Load the demo fixtures (idempotent) |
| `npm run db:verify` | Schema, AI pipeline and open-core suites against an in-memory Postgres. No network or keys needed |
| `npm run verify:routes` | HTTP-level suite against a running server (`BASE_URL`, default `http://localhost:3100`). Run the server without `HF_TOKEN`, on PGlite |

## API

Create a personal access token in **Settings → Access tokens** with the `read` scope and send `Authorization: Bearer parley_pat_…`. Limit: 300 requests per 5 minutes.

| Method | Path | Returns |
|---|---|---|
| GET | `/api/v1/meetings?limit=` | Recent meetings with overview, participants, action-item counts |
| GET | `/api/v1/meetings/:id?transcript=1` | Summary sections, action items, highlights, clips, optional transcript |
| GET | `/api/v1/action-items?status=open\|done` | Action items with owner, due date, source link |
| GET | `/api/v1/search?q=` | Transcript moments and calendar events (synonym-aware) |
| POST | `/api/v1/ask` `{"question": "…"}` | Cited answer across meetings and calendar |

## MCP server

Stateless Streamable HTTP at `/api/mcp` (protocol `2025-11-25`, also `2025-06-18`, `2025-03-26`, `2024-11-05`). Read-only tools: `search_meetings`, `ask_parley`, `list_meetings`, `get_meeting`, `list_action_items`.

```bash
claude mcp add --transport http parley https://parley-smoky.vercel.app/api/mcp --header "Authorization: Bearer parley_pat_…"
```

## Architecture

```
Browser ── mic + tab audio ──▶ Deepgram (WebSocket, 60s token from /api/deepgram/token)
   │                                   │ words + speakers
   ▼                                   ▼
/api/ingest (append lines) ──▶ Postgres (Neon) ◀── /api/streams/meetings (SSE to watchers)
   │ after(): job queue                 ▲
   ▼                                    │
AI pipeline: 10-min windows ▸ merge ▸ grounded summary ▸ Slack / Notion / HubSpot
   (Claude → ChatGPT → Hugging Face, user key first)
Vercel Cron (daily) ▸ /api/cron/sweep: stale calls, stuck jobs, iCal sync, retention, guest expiry
```

- **Stack:** Next.js 16 (App Router, `after()`), React 19, TypeScript, Tailwind v4, Drizzle ORM, Neon serverless (PGlite locally), Vercel.
- **Grounding:** the model only sees numbered transcript lines and must cite them. Citations that point nowhere, and quotes that don't match the line, are dropped or flagged.
- **Security:** HMAC-signed session cookies; AES-256-GCM for stored keys and feed URLs; SHA-256-hashed access tokens with scopes (`ingest`, `calendar`, `read`); Postgres sliding-window rate limits; owner checks on every write.
- **Storage:** everything lives in Postgres, including audio chunks (~15-20 MB per hour). Move audio to Vercel Blob or R2 before it outgrows Neon's free 0.5 GB.

## Project layout

```
app/                 routes: landing, (app) dashboard pages, api/*, server actions
src/ai/              LLM clients + pool, pipeline, prompts, grounding, Ask Parley
src/calendar/        iCal fetch/parse/sync
src/capture/         dual-stream (mic + tab) capture, recorder
src/notify/          Slack, Notion, HubSpot delivery
src/db/              schema, seed, client (Neon or PGlite)
src/components/      UI (shadcn), live call, tour, settings forms
drizzle/             SQL migrations 0000-0011
scripts/             migrate + verification suites
seed/                demo fixtures (20 meetings)
.agent-logs/         build session logs (kept in the repo on purpose)
```

## Deploy

```bash
npx vercel link
npx vercel env add DATABASE_URL production     # repeat for each variable above
npx vercel deploy --prod
```

`vercel.json` pins functions to `cle1` (next to Neon us-east-2) and schedules the daily sweep.

## Limits

No meeting bot, no video recording, no Google Calendar OAuth, no SSO/SOC 2/HIPAA. [HANDOVER.md](HANDOVER.md) explains why each was left out.
