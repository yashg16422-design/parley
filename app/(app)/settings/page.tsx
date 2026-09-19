import { and, desc, eq, isNull } from "drizzle-orm";
import { disconnectFeed, removeIntegration, removeProviderKey, revoke, setRetention } from "@app/actions/settings";
import { setTheme } from "@app/actions/workspace";
import { cookies } from "next/headers";
import { DeleteAccountForm, FeedForm, IntegrationForm, KeyForm, TokenForm } from "@/components/settings-forms";
import { recentAudit } from "@/audit";
import { GuestNotice } from "@/components/mode-badge";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/submit-button";
import { Card } from "@/components/ui/card";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { fmtDay, fmtTime } from "@/lib/format";
import { currentUser } from "@/queries";
import { vaultReady } from "@/vault";

const INTEGRATIONS = [
  { kind: "slack", name: "Slack", hint: "Briefing with summary, talk time and action items. Slack → Apps → Incoming Webhooks → Add to a channel. Overrides the server's webhook." },
  { kind: "notion", name: "Notion", hint: "A page per meeting in a database of yours. Create an internal integration at notion.so/profile/integrations, then add it to the database (⋯ → Connections)." },
  { kind: "hubspot", name: "HubSpot", hint: "A note with the summary and action items on every attendee who's a HubSpot contact. Private app with crm.objects.contacts.read/write." },
] as const;

const PROVIDERS = [
  { kind: "deepgram", name: "Deepgram", env: "DEEPGRAM_API_KEY", hint: "Live transcription. Needs the Member role so it can issue browser tokens.", placeholder: "Deepgram API key" },
  { kind: "anthropic", name: "Claude (Anthropic)", env: "ANTHROPIC_API_KEY", hint: "AI notes and Ask Parley. Tried first when saved.", placeholder: "sk-ant-…" },
  { kind: "openai", name: "ChatGPT (OpenAI)", env: "OPENAI_API_KEY", hint: "AI notes and Ask Parley. Tried after Claude.", placeholder: "sk-…" },
  { kind: "huggingface", name: "Hugging Face", env: "HF_TOKEN", hint: "Free open models. Fine-grained token with “Make calls to Inference Providers”. Tried last.", placeholder: "hf_…" },
] as const;

/** Bring-your-own keys, the no-OAuth iCal calendar, and access tokens for scripts and the capture extension. */
export default async function Settings() {
  const me = await currentUser();
  const db = getDb();
  const [secrets, feed, tokens, activity] = await Promise.all([
    db.query.userSecrets.findMany({ where: eq(s.userSecrets.userId, me.id), columns: { kind: true, last4: true, updatedAt: true } }),
    db.query.calendarConnections.findFirst({ where: and(eq(s.calendarConnections.userId, me.id), eq(s.calendarConnections.provider, "ics")) }),
    db.query.apiTokens.findMany({ where: and(eq(s.apiTokens.userId, me.id), isNull(s.apiTokens.revokedAt)), orderBy: desc(s.apiTokens.createdAt) }),
    recentAudit(db, me.id, 20),
  ]);
  const vault = vaultReady();
  const canSave = vault && me.kind !== "guest";
  const theme = (await cookies()).get("parley_theme")?.value === "light" ? "light" : "dark";
  return (
    <>
      <PageHeader title="Settings" subtitle="Your own provider keys, calendar feed and API access." />
      <div className="max-w-3xl space-y-6 p-6">
        <GuestNotice me={me} />
        {!vault && <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">This server has no <code>PARLEY_SECRET_KEY</code>, so keys and calendar feeds can&apos;t be stored yet.</p>}

        <Card className="flex-row flex-wrap items-center gap-3 p-5">
          <div className="flex-1"><h2 className="font-semibold">Appearance</h2><p className="text-sm text-muted-foreground">Dark is the default. Also in the ⌘K menu.</p></div>
          <form action={setTheme.bind(null, "dark")}><SubmitButton size="sm" variant={theme === "dark" ? "default" : "outline"}>Dark</SubmitButton></form>
          <form action={setTheme.bind(null, "light")}><SubmitButton size="sm" variant={theme === "light" ? "default" : "outline"}>Light</SubmitButton></form>
        </Card>

        <Card className="gap-5 p-5">
          <div><h2 className="font-semibold">Your API keys</h2><p className="text-sm text-muted-foreground">Your key is used for your meetings instead of the server&apos;s. Stored encrypted; never shown again or sent to your browser.</p></div>
          {PROVIDERS.map((p) => {
            const mine = secrets.find((x) => x.kind === p.kind);
            return (
              <div key={p.kind} className="space-y-2 border-t pt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-medium">{p.name}</h3>
                  {mine ? <Badge>Your key ····{mine.last4}</Badge> : <Badge variant="secondary">{process.env[p.env] ? "Using server key" : "Not configured"}</Badge>}
                  {mine && <form action={removeProviderKey} className="ml-auto"><input type="hidden" name="kind" value={p.kind} /><SubmitButton size="sm" variant="ghost">Remove</SubmitButton></form>}
                </div>
                <p className="text-xs text-muted-foreground">{p.hint}</p>
                {canSave && <KeyForm kind={p.kind} placeholder={p.placeholder} />}
              </div>
            );
          })}
        </Card>

        <Card className="gap-3 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">Calendar via iCal (no Google sign-in)</h2>
            {feed && <Badge variant={feed.lastSyncError ? "destructive" : "secondary"}>{feed.lastSyncError ? "Sync failed" : feed.lastSyncedAt ? `Synced ${fmtDay(feed.lastSyncedAt)} ${fmtTime(feed.lastSyncedAt)}` : "Connected"}</Badge>}
            {feed && <form action={disconnectFeed} className="ml-auto"><SubmitButton size="sm" variant="ghost">Disconnect</SubmitButton></form>}
          </div>
          <p className="text-sm text-muted-foreground">Google Calendar → Settings → your calendar → <b>Secret address in iCal format</b>. Read-only; video calls from the last week and next 30 days appear on your calendar. Treat the address like a password; reset it in Google to revoke access.</p>
          {feed?.lastSyncError && <p className="text-sm text-destructive">{feed.lastSyncError}</p>}
          {canSave && <FeedForm connected={!!feed} />}
        </Card>

        <Card className="gap-3 p-5">
          <div><h2 className="font-semibold">Access tokens</h2><p className="text-sm text-muted-foreground">For the capture extension and your own scripts: <code>Authorization: Bearer parley_pat_…</code> on <code>/api/ingest</code>, <code>/api/deepgram/token</code> (ingest) and <code>/api/calendar/ics</code> (calendar).</p></div>
          {me.kind !== "guest" && <TokenForm />}
          {tokens.map((t) => (
            <div key={t.id} className="flex items-center gap-2 border-t pt-2 text-sm">
              <code className="text-xs">{t.prefix}…</code><span className="font-medium">{t.name}</span>
              {t.scopes.map((x) => <Badge key={x} variant="outline">{x}</Badge>)}
              <span className="text-xs text-muted-foreground">{t.lastUsedAt ? `used ${fmtDay(t.lastUsedAt)}` : "never used"}</span>
              <form action={revoke} className="ml-auto"><input type="hidden" name="id" value={t.id} /><SubmitButton size="sm" variant="ghost">Revoke</SubmitButton></form>
            </div>
          ))}
        </Card>
        <Card className="gap-4 p-5">
          <div><h2 className="font-semibold">Integrations</h2><p className="text-sm text-muted-foreground">When a meeting&apos;s notes are ready, Parley sends them to the tools you connect here, using your own tokens.</p></div>
          {INTEGRATIONS.map((i) => {
            const on = secrets.some((x) => x.kind === i.kind);
            return (
              <div key={i.kind} className="space-y-2 border-t pt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-medium">{i.name}</h3>
                  <Badge variant={on ? "default" : "secondary"}>{on ? "Connected" : "Not connected"}</Badge>
                  {on && <form action={removeIntegration} className="ml-auto"><input type="hidden" name="kind" value={i.kind} /><SubmitButton size="sm" variant="ghost">Disconnect</SubmitButton></form>}
                </div>
                <p className="text-xs text-muted-foreground">{i.hint}</p>
                {canSave && !on && <IntegrationForm kind={i.kind} />}
              </div>
            );
          })}
        </Card>

        <Card className="gap-4 p-5">
          <div><h2 className="font-semibold">Your data</h2><p className="text-sm text-muted-foreground">Stored in Parley&apos;s Postgres database (Neon). <a href="/privacy" className="text-primary hover:underline">What we store and where</a>.</p></div>
          <form action={setRetention} className="flex flex-wrap items-center gap-2 text-sm">
            Delete recorded meetings older than
            <select name="days" defaultValue={me.retentionDays ? String(me.retentionDays) : "forever"} className="h-9 rounded-md border bg-background px-2">
              <option value="forever">never (keep them)</option><option value="30">30 days</option><option value="90">90 days</option><option value="365">1 year</option>
            </select>
            <SubmitButton size="sm" variant="outline">Save</SubmitButton>
          </form>
          <div className="flex flex-wrap items-center gap-3 border-t pt-4 text-sm">
            <a href="/api/me/export" className="rounded-md border px-3 py-1.5 font-medium hover:bg-muted">Download all my data (JSON)</a>
            <span className="text-muted-foreground">Transcripts, notes, action items, clips, scratchpads and calendar. Never your key values.</span>
          </div>
          {me.kind !== "demo" && <div className="border-t pt-4"><p className="mb-2 text-sm text-muted-foreground">Delete your account, every recording and every note, permanently.</p><DeleteAccountForm /></div>}
        </Card>

        <Card className="gap-3 p-5">
          <h2 className="font-semibold">Security activity</h2>
          {!activity.length && <p className="text-sm text-muted-foreground">Nothing yet.</p>}
          <ul className="divide-y text-sm">
            {activity.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-x-3 py-2">
                <span className="font-mono text-xs text-muted-foreground">{fmtDay(a.createdAt)} {fmtTime(a.createdAt)}</span>
                <span className="font-medium">{a.action.replace(/[._]/g, " ")}</span>
                {a.target && <span className="truncate text-muted-foreground">{a.target}</span>}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
