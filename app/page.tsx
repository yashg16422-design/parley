import Link from "next/link";
import { ArrowRight, Bot, CalendarDays, FileText, KeyRound, ListChecks, Lock, MessageSquareText, Radio, Scissors, Search, Sparkles, Waves } from "lucide-react";
import { enterDemo, startFresh } from "@app/actions/workspace";
import { JoinByLink } from "@/components/join-by-link";
import { AskMock, CallMock, SlackMock } from "@/components/landing/mockups";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { currentUserId, findUser } from "@/session";

const FEATURES = [
  [Radio, "AI notetaker", "Live transcript from your mic and the meeting tab, with every speaker labelled."],
  [Sparkles, "Live notes during the call", "Decisions, action items and open questions appear while people are still talking."],
  [FileText, "Summaries you can check", "Seven templates. Every line cites the moment it came from, one click to hear it."],
  [ListChecks, "Action items with owners", "Who promised what, by when, pulled from what was actually said."],
  [Lock, "Private scratchpad", "Your own notes beside the call, timestamped with ⌘↵. Only you can see them."],
  [Scissors, "Clips and sharing", "Cut the 40 seconds that matter and share a link, no login needed."],
  [Search, "Search every call", "“SSO” also finds “single sign-on” and “SAML” across all your meetings."],
  [CalendarDays, "Your real calendar", "Paste a private iCal link. Meetings appear with agenda, files and a Record button."],
] as const;

const INTEGRATIONS = [
  ["Zoom", "from-sky-400 to-blue-600"], ["Google Meet", "from-emerald-400 to-green-600"], ["Teams", "from-indigo-400 to-violet-600"],
  ["Slack", "from-fuchsia-400 to-purple-600"], ["Claude", "from-orange-300 to-amber-600"], ["ChatGPT", "from-teal-300 to-emerald-600"],
  ["Hugging Face", "from-yellow-300 to-amber-500"], ["Deepgram", "from-lime-300 to-green-600"], ["iCal", "from-rose-300 to-red-500"],
] as const;

export default async function Landing({ searchParams }: { searchParams: Promise<{ limited?: string }> }) {
  const [me, { limited }] = await Promise.all([currentUserId().then(findUser), searchParams]);
  return (
    <div className="dark min-h-dvh overflow-x-clip bg-[oklch(0.12_0.015_260)] text-foreground">
      {/* Sky: slow-drifting stars and two soft light sources */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="starfield starfield-drift absolute inset-x-0 top-0 h-[200%] opacity-70" />
        <div className="glow-pulse absolute -left-40 top-40 size-[520px] rounded-full bg-[radial-gradient(circle,rgb(34_211_238/0.22),transparent_65%)] blur-2xl" />
        <div className="glow-pulse absolute -right-32 top-[55%] size-[460px] rounded-full bg-[radial-gradient(circle,rgb(99_102_241/0.18),transparent_65%)] blur-2xl [animation-delay:-4s]" />
      </div>

      <header className="relative z-10 mx-auto flex max-w-6xl items-center gap-6 px-6 py-5">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <span className="flex size-8 items-center justify-center rounded-[10px] bg-gradient-to-br from-cyan-300 to-sky-500 text-slate-900"><Waves className="size-4" /></span>Parley
        </Link>
        <nav className="hidden gap-6 text-sm text-white/60 md:flex">
          <a href="#features" className="hover:text-white">Features</a>
          <a href="#briefings" className="hover:text-white">Briefings</a>
          <a href="#integrations" className="hover:text-white">Integrations</a>
          <a href="#open" className="hover:text-white">Open core</a>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {me ? (
            <Link href="/home" className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-medium text-slate-900 transition-transform hover:-translate-y-px">Continue as {me.name.split(" ")[0]}</Link>
          ) : (
            <form action={enterDemo}><SubmitButton className="rounded-full bg-cyan-300 px-4 text-slate-900 hover:bg-cyan-200">Open the demo</SubmitButton></form>
          )}
        </div>
      </header>

      <main className="relative z-10">
        {/* Hero */}
        <section id="join" className="mx-auto max-w-6xl scroll-mt-10 px-6 pb-16 pt-14 text-center sm:pt-20">
          <p className="mx-auto mb-5 w-fit rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">Live notes · Ask Parley · Slack briefings · Scratchpad</p>
          <h1 className="mx-auto max-w-4xl text-[clamp(2.5rem,6vw,4.5rem)] font-semibold leading-[1.02] tracking-[-0.035em] text-white">
            Meeting notes that <span className="bg-gradient-to-r from-cyan-200 via-sky-300 to-indigo-300 bg-clip-text text-transparent">cite their sources.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-white/65 sm:text-lg">Record Zoom, Meet and Teams calls from your browser. Parley writes the summary and action items while you talk, briefs your team in Slack, and links every claim to the moment it was said.</p>

          <div className="mx-auto mt-10 max-w-xl rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left backdrop-blur">
            <p className="mb-3 text-sm font-medium text-white">Paste a meeting link to record it</p>
            <JoinByLink signedIn={!!me} />
            {limited && <p className="mt-2 text-sm text-amber-300">Too many new workspaces from this network. Try again in an hour, or open the demo.</p>}
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-sm">
            <form action={enterDemo}><SubmitButton variant="ghost" className="text-white/80 hover:text-white">Enter Reviewer Demo Workspace<ArrowRight /></SubmitButton></form>
            <span className="text-white/20">·</span>
            <form action={startFresh} className="flex items-center gap-2">
              <Input name="name" placeholder="Your name" maxLength={60} className="h-9 w-36 border-white/15 bg-white/5" />
              <SubmitButton variant="ghost" className="text-white/80 hover:text-white">Start a Live New Meeting<ArrowRight /></SubmitButton>
            </form>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-6"><CallMock /></section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-6xl px-6 pt-28">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="lg:sticky lg:top-24 lg:self-start">
              <p className="text-sm font-medium text-cyan-300">The notetaker</p>
              <h2 className="mt-3 text-4xl font-semibold leading-tight tracking-[-0.03em] text-white">Everything after the call, done before you close the tab.</h2>
              <p className="mt-4 max-w-md text-white/60">No bot joins your meeting. Parley listens from your browser, so it works on any call you can open in a tab.</p>
            </div>
            <div className="grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2">
              {FEATURES.map(([Icon, title, body]) => (
                <div key={title} className="bg-[oklch(0.14_0.015_260)] p-6 transition-colors hover:bg-[oklch(0.16_0.02_255)]">
                  <Icon className="size-5 text-cyan-300" />
                  <h3 className="mt-4 font-medium text-white">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-white/55">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Briefings */}
        <section id="briefings" className="mx-auto max-w-6xl space-y-24 px-6 pt-32">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium text-cyan-300"><MessageSquareText className="size-4" />Slack briefing</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.025em] text-white">Your team knows what happened before you&apos;ve left the call.</h2>
              <p className="mt-4 max-w-md text-white/60">The moment notes are ready, Parley posts a briefing to Slack: the summary, the agenda, who talked how much, and every action item with its owner.</p>
            </div>
            <SlackMock />
          </div>
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <AskMock />
            <div className="lg:order-first">
              <p className="flex items-center gap-2 text-sm font-medium text-cyan-300"><Bot className="size-4" />AI briefings with Ask Parley</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.025em] text-white">Ask across every meeting. Every answer shows its receipts.</h2>
              <p className="mt-4 max-w-md text-white/60">Parley answers only from your transcripts and cites the exact moments. Sentences it can&apos;t back up are dropped, not guessed.</p>
            </div>
          </div>
        </section>

        {/* Integrations */}
        <section id="integrations" className="mx-auto max-w-6xl px-6 pt-32">
          <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-transparent p-8 sm:p-12">
            <div className="grid gap-6 lg:grid-cols-2">
              <h2 className="text-4xl font-semibold leading-tight tracking-[-0.03em] text-white">Works with the tools you already use.</h2>
              <p className="self-end text-white/60">Record on Zoom, Meet or Teams. Transcribe with Deepgram. Write notes with Claude, ChatGPT or free Hugging Face models, with your own keys if you like. Brief the team in Slack.</p>
            </div>
            <div className="mt-12 flex flex-wrap gap-3">
              {INTEGRATIONS.map(([name, grad]) => (
                <span key={name} className="flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.04] py-1.5 pl-1.5 pr-4 text-sm text-white/85">
                  <span className={`flex size-7 items-center justify-center rounded-full bg-gradient-to-br ${grad} text-xs font-bold text-slate-900`}>{name[0]}</span>{name}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Open core */}
        <section id="open" className="mx-auto grid max-w-6xl gap-10 px-6 pt-32 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium text-cyan-300"><KeyRound className="size-4" />Open core</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.025em] text-white">Bring your own keys. Keep your costs and your data.</h2>
            <p className="mt-4 max-w-lg text-white/60">Save your own Deepgram, Claude, ChatGPT or Hugging Face keys, encrypted in your workspace. Scripts and extensions can send transcripts with scoped access tokens.</p>
          </div>
          <ul className="space-y-3 text-sm text-white/70">
            {["Keys encrypted with AES-256-GCM, never sent to the browser", "Access tokens with scopes for ingest and calendar", "Two-stream capture engine ready for a browser extension", "Runs on Vercel and Neon, no servers to babysit"].map((t) => (
              <li key={t} className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-cyan-300" />{t}</li>
            ))}
          </ul>
        </section>

        {/* Closing CTA */}
        <section className="mx-auto max-w-3xl px-6 py-32 text-center">
          <h2 className="text-4xl font-semibold tracking-[-0.03em] text-white">Take your next call with Parley.</h2>
          <p className="mt-4 text-white/60">Look around the demo workspace first, or record a real meeting now.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <form action={enterDemo}><SubmitButton className="h-11 rounded-full bg-cyan-300 px-6 text-slate-900 hover:bg-cyan-200">Open the demo<ArrowRight /></SubmitButton></form>
            <Link href={me ? "/live/mic" : "#join"} className="flex h-11 items-center rounded-full border border-white/15 px-6 text-sm text-white/85 transition-colors hover:border-white/30">{me ? "Record a meeting" : "Paste a link above"}</Link>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/10 py-8 text-center text-xs text-white/40">
        Parley stores transcripts and notes in your workspace only. Audio for transcription goes from your browser straight to Deepgram.
      </footer>
    </div>
  );
}
