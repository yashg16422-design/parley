import { and, desc, eq, isNull } from "drizzle-orm";
import { disconnectFeed, removeProviderKey, revoke } from "@app/actions/settings";
import { setTheme } from "@app/actions/workspace";
import { cookies } from "next/headers";
import { FeedForm, KeyForm, TokenForm } from "@/components/settings-forms";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/submit-button";
import { Card } from "@/components/ui/card";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { fmtDay, fmtTime } from "@/lib/format";
import { currentUser } from "@/queries";
import { vaultReady } from "@/vault";

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
  const [secrets, feed, tokens] = await Promise.all([
    db.query.userSecrets.findMany({ where: eq(s.userSecrets.userId, me.id), columns: { kind: true, last4: true, updatedAt: true } }),
    db.query.calendarConnections.findFirst({ where: and(eq(s.calendarConnections.userId, me.id), eq(s.calendarConnections.provider, "ics")) }),
    db.query.apiTokens.findMany({ where: and(eq(s.apiTokens.userId, me.id), isNull(s.apiTokens.revokedAt)), orderBy: desc(s.apiTokens.createdAt) }),
  ]);
  const vault = vaultReady();
  const theme = (await cookies()).get("parley_theme")?.value === "light" ? "light" : "dark";
  return (
    <>
      <PageHeader title="Settings" subtitle="Your own provider keys, calendar feed and API access." />
      <div className="max-w-3xl space-y-6 p-6">
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
                {vault && <KeyForm kind={p.kind} placeholder={p.placeholder} />}
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
          {vault && <FeedForm connected={!!feed} />}
        </Card>

        <Card className="gap-3 p-5">
          <div><h2 className="font-semibold">Access tokens</h2><p className="text-sm text-muted-foreground">For the capture extension and your own scripts: <code>Authorization: Bearer parley_pat_…</code> on <code>/api/ingest</code>, <code>/api/deepgram/token</code> (ingest) and <code>/api/calendar/ics</code> (calendar).</p></div>
          <TokenForm />
          {tokens.map((t) => (
            <div key={t.id} className="flex items-center gap-2 border-t pt-2 text-sm">
              <code className="text-xs">{t.prefix}…</code><span className="font-medium">{t.name}</span>
              {t.scopes.map((x) => <Badge key={x} variant="outline">{x}</Badge>)}
              <span className="text-xs text-muted-foreground">{t.lastUsedAt ? `used ${fmtDay(t.lastUsedAt)}` : "never used"}</span>
              <form action={revoke} className="ml-auto"><input type="hidden" name="id" value={t.id} /><SubmitButton size="sm" variant="ghost">Revoke</SubmitButton></form>
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}
