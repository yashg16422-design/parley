import Link from "next/link";

export const metadata = { title: "Privacy · Parley", description: "What Parley stores, where, for how long, and how to take it with you or delete it." };

const ROWS = [
  ["Account", "Name, email and photo from Google (no Google password or tokens).", "Neon Postgres"],
  ["Meetings", "Transcripts, AI notes, action items, highlights, clips, your private scratchpads.", "Neon Postgres"],
  ["Audio", "The call audio you record, in ~5-second chunks.", "Neon Postgres"],
  ["Keys & tokens", "API keys, Notion/HubSpot tokens, Slack webhook, calendar feed address: AES-256-GCM encrypted; access tokens stored only as hashes.", "Neon Postgres"],
  ["Live transcription", "Microphone and meeting-tab audio, streamed from your browser.", "Deepgram (not stored by Parley until transcribed)"],
  ["AI notes & Ask", "Transcript excerpts sent to write notes and answers.", "Claude, ChatGPT or Hugging Face, whichever keys are configured"],
  ["Integrations", "Summary and action items, only to tools you connect.", "Your Slack, Notion, HubSpot"],
] as const;

/** Plain-language data statement, linked from the landing page and Settings. */
export default function Privacy() {
  return (
    <main className="mx-auto max-w-3xl space-y-8 px-6 py-16">
      <Link href="/" className="text-sm text-primary hover:underline">← Parley</Link>
      <div>
        <h1 className="text-3xl font-semibold tracking-[-0.02em]">What Parley stores, and where</h1>
        <p className="mt-3 text-muted-foreground">Parley keeps your meetings in its Postgres database (Neon, US East). Nothing is sold or shared; data leaves only to the services below, to do the job you asked for.</p>
      </div>
      <div className="overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="p-3 font-medium">What</th><th className="p-3 font-medium">Details</th><th className="p-3 font-medium">Where</th></tr></thead>
          <tbody className="divide-y">{ROWS.map(([a, b, c]) => <tr key={a}><td className="p-3 font-medium">{a}</td><td className="p-3 text-muted-foreground">{b}</td><td className="p-3">{c}</td></tr>)}</tbody>
        </table>
      </div>
      <section className="space-y-2 text-sm leading-relaxed">
        <h2 className="text-lg font-semibold">How long</h2>
        <p className="text-muted-foreground">Try-now workspaces are deleted after 24 hours. Accounts keep data until you delete it, or for the retention period you choose in Settings (30 days, 90 days or a year).</p>
        <h2 className="pt-4 text-lg font-semibold">Your controls</h2>
        <p className="text-muted-foreground">Settings → Your data: download everything as JSON, set retention, or delete your account and all recordings permanently. Settings → Security activity lists sign-ins, key changes, exports and deliveries.</p>
        <h2 className="pt-4 text-lg font-semibold">Recording consent</h2>
        <p className="text-muted-foreground">Before recording, Parley asks you to confirm everyone knows, and offers a notice to paste in the meeting chat. You are responsible for the consent laws where you and your participants are.</p>
        <p className="pt-4 text-xs text-muted-foreground">Parley is not SOC 2 or HIPAA certified. Don&apos;t record protected health information.</p>
      </section>
    </main>
  );
}
