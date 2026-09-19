import Link from "next/link";
import { ArrowRight, Database, Link2, Mic, Waves } from "lucide-react";
import { enterDemo, startFresh } from "@app/actions/workspace";
import { JoinByLink } from "@/components/join-by-link";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { currentUserId, findUser } from "@/session";

const POINTS = [
  ["Every note cites the line it came from", "Click a citation and the call jumps there."],
  ["Hears everyone, not just you", "Mic plus the meeting tab's audio, labelled by speaker."],
  ["Search across every call", "“SSO” also finds “single sign-on” and “SAML”."],
] as const;

export default async function Landing({ searchParams }: { searchParams: Promise<{ limited?: string }> }) {
  const [me, { limited }] = await Promise.all([currentUserId().then(findUser), searchParams]);
  return (
    <main className="mx-auto grid min-h-dvh max-w-6xl items-center gap-12 px-6 py-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
      <section>
        <div className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <span className="flex size-8 items-center justify-center rounded-[10px] bg-primary text-primary-foreground"><Waves className="size-4" /></span>
          Parley
        </div>
        <h1 className="mt-10 max-w-xl text-4xl font-semibold leading-[1.05] tracking-[-0.03em] sm:text-5xl">Meeting notes you can check against the call.</h1>
        <p className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground">Record Zoom, Meet and Teams calls from your browser. Parley transcribes live, writes the summary and action items, and links every claim to the moment it was said.</p>
        <dl className="mt-10 space-y-4 border-l pl-5">
          {POINTS.map(([t, d]) => (
            <div key={t}>
              <dt className="text-sm font-medium">{t}</dt>
              <dd className="text-sm text-muted-foreground">{d}</dd>
            </div>
          ))}
        </dl>
        {me && <Link href="/home" className="mt-8 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">Continue as {me.name}<ArrowRight className="size-3.5" /></Link>}
      </section>

      <section className="space-y-4">
        {limited && <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">Too many new workspaces from this network. Try again in an hour, or use the demo workspace.</p>}
        <div className="rounded-2xl border border-primary/25 bg-primary/[0.04] p-6 shadow-[0_1px_0_0_oklch(0.5_0.09_195/0.08),0_12px_32px_-16px_oklch(0.5_0.09_195/0.35)]">
          <div className="flex items-center gap-2 text-sm font-medium text-primary"><Link2 className="size-4" />Join a Zoom, Meet or Teams call</div>
          <p className="mb-4 mt-1.5 text-sm text-muted-foreground">Paste the meeting link. Parley opens the call and records it live, including everyone else&apos;s voices, then writes the notes.</p>
          <JoinByLink signedIn={!!me} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col rounded-xl border bg-background p-5">
            <Database className="size-5 text-muted-foreground" />
            <h2 className="mt-3 font-medium">Enter Reviewer Demo Workspace</h2>
            <p className="mb-4 mt-1 text-sm text-muted-foreground">Maya Chen&apos;s workspace: 20 recorded meetings, an 8-person hour-long call, clips and a busy calendar.</p>
            <form action={enterDemo} className="mt-auto"><SubmitButton variant="outline" className="w-full">Open demo<ArrowRight /></SubmitButton></form>
          </div>
          <div className="flex flex-col rounded-xl border bg-background p-5">
            <Mic className="size-5 text-muted-foreground" />
            <h2 className="mt-3 font-medium">Start a Live New Meeting</h2>
            <p className="mb-4 mt-1 text-sm text-muted-foreground">An empty workspace of your own. Record from your mic and connect your real calendar.</p>
            <form action={startFresh} className="mt-auto flex gap-2">
              <Input name="name" placeholder="Your name" maxLength={60} className="min-w-0 flex-1" />
              <SubmitButton variant="outline">Start<ArrowRight /></SubmitButton>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
