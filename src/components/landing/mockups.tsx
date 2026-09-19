import { Hash, Lock, Sparkles } from "lucide-react";

/** Illustrations for the landing page, drawn with the app's own components' look. Static, no images. */

const PEOPLE = [
  ["MC", "Maya Chen", "from-cyan-400 to-sky-600", true],
  ["RP", "Raj Patel", "from-emerald-400 to-teal-600", false],
  ["PN", "Priya Nair", "from-amber-300 to-orange-500", false],
  ["MJ", "Marcus Johnson", "from-rose-400 to-pink-600", false],
  ["DA", "Dana (Acme)", "from-indigo-300 to-violet-500", false],
] as const;

function Eq() {
  return (
    <span className="flex h-3 items-end gap-[2px]">
      {[0, 1, 2, 3].map((i) => <span key={i} className="eq-bar w-[3px] rounded-full bg-cyan-300" style={{ height: `${40 + i * 15}%`, animationDelay: `${i * 0.15}s` }} />)}
    </span>
  );
}

export function CallMock() {
  return (
    <div className="relative grid overflow-hidden rounded-2xl border border-white/10 bg-[oklch(0.13_0.015_255)] shadow-[0_40px_120px_-40px_rgb(34_211_238/0.35)] lg:grid-cols-[1fr_300px]">
      <div className="grid grid-cols-3 gap-2 p-3">
        {PEOPLE.map(([ini, name, grad, speaking], i) => (
          <div key={ini} className={`relative flex aspect-[4/3] items-center justify-center rounded-xl bg-white/[0.04] ${i === 0 ? "col-span-2 row-span-2 aspect-auto" : ""} ${speaking ? "ring-2 ring-cyan-300/80" : ""}`}>
            <span className={`flex items-center justify-center rounded-full bg-gradient-to-br ${grad} font-semibold text-white ${i === 0 ? "size-20 text-2xl" : "size-11 text-sm"}`}>{ini}</span>
            <span className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-md bg-black/50 px-1.5 py-0.5 text-[11px] text-white/90">{speaking && <Eq />}{name}</span>
          </div>
        ))}
      </div>
      <aside className="flex flex-col border-t border-white/10 bg-white/[0.03] p-4 lg:border-l lg:border-t-0">
        <div className="flex items-center justify-between">
          <p className="font-medium text-white">Weekly launch sync</p>
          <span className="rounded-md bg-red-500/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">REC 18:42</span>
        </div>
        <div className="mt-3 grid grid-cols-2 border-b border-white/10 text-xs">
          <span className="flex items-center justify-center gap-1 border-b-2 border-cyan-300 pb-2 text-cyan-200"><Sparkles className="size-3" />Live notes</span>
          <span className="flex items-center justify-center gap-1 pb-2 text-white/50"><Lock className="size-3" />Scratchpad</span>
        </div>
        <ul className="mt-3 space-y-2.5 text-[13px] text-white/75">
          <li><span className="mr-2 font-mono text-[11px] text-white/40">04:12</span>Decision: ship the beta Monday, keep GA gated.</li>
          <li><span className="mr-2 font-mono text-[11px] text-white/40">09:30</span><span className="text-cyan-200">@Raj</span> sends the pricing deck to Acme by Friday.</li>
          <li><span className="mr-2 font-mono text-[11px] text-white/40">15:05</span>Open question: do we need SAML before the pilot?</li>
        </ul>
        <p className="mt-auto flex items-center gap-2 pt-4 text-xs text-white/50"><Eq />Listening…</p>
      </aside>
    </div>
  );
}

export function SlackMock() {
  return (
    <div className="rounded-xl border border-white/10 bg-[oklch(0.17_0.01_300)] p-4 text-[13px] text-white/85 shadow-2xl">
      <p className="mb-3 flex items-center gap-1 text-xs text-white/50"><Hash className="size-3.5" />product-updates</p>
      <div className="flex gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-cyan-400 font-bold text-slate-900">P</span>
        <div className="min-w-0 space-y-2">
          <p><b className="text-white">Parley</b> <span className="text-[11px] text-white/40">APP 11:04</span></p>
          <p className="text-base font-semibold text-white">📝 Weekly launch sync</p>
          <p className="text-xs text-white/50">Sep 19 · 32m · Google Meet · 5 participants</p>
          <p>Team agreed to ship the beta Monday with GA gated on precision; Acme needs SAML before signing.</p>
          <pre className="font-mono text-[11px] leading-5 text-white/70">{"██████░░░░ 58%  Maya · 18m\n███░░░░░░░ 27%  Raj · 9m\n█░░░░░░░░░ 15%  Priya · 5m"}</pre>
          <p className="font-medium text-white">Action items (3)</p>
          <p>• Send pricing deck to Acme — <b>Raj Patel</b> · due Friday<br />• Rerun latency benchmark — <b>Priya Nair</b><br />• Draft beta announcement — <b>Maya Chen</b></p>
          <span className="inline-block rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white">Open notes in Parley</span>
        </div>
      </div>
    </div>
  );
}

export function AskMock() {
  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-[13px] shadow-2xl">
      <p className="ml-auto w-fit rounded-2xl rounded-br-md bg-white/10 px-3 py-1.5 text-white">What did customers say about SSO?</p>
      <p className="leading-relaxed text-white/80">
        Two enterprise deals are blocked on SAML SSO <Cite n={1} /><Cite n={2} />. Acme said they need it before they sign <Cite n={3} />, and Raj estimated six weeks for the first provider <Cite n={4} />.
      </p>
      <p className="text-[11px] text-white/40">Sources · 4 moments across 3 meetings</p>
    </div>
  );
}

const Cite = ({ n }: { n: number }) => <span className="mx-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded bg-cyan-300/15 px-1 align-text-top font-mono text-[10px] text-cyan-200">{n}</span>;
