"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Guided walkthrough: a gradient cursor glides to each `[data-tour=…]` element,
 * a spotlight frames it and a caption explains it. Steps whose element is
 * missing or hidden (e.g. the sidebar on phones) are skipped. Arrow keys / Esc
 * work; reduced-motion users get instant moves.
 */
export type TourStep = { target: string; title: string; body: string };
type Finish = { label: string; href?: string; action?: (form: FormData) => void | Promise<void>; next?: string };
/** Page (document) coordinates, so scrolling moves the overlay with the page instead of making it chase. */
type Box = { top: number; left: number; width: number; height: number };
const CARD_H = 230;

const PAD = 8;
const seenKey = (id: string) => `parley_tour:${id}`;

function findTarget(target: string) {
  // First visible match: phones and desktops show different copies of the nav.
  return [...document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`)].find((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }) ?? null;
}

export function Tour({ id, steps, autoStart = false, finish, label = "Take the tour", className }: {
  id: string; steps: TourStep[]; autoStart?: boolean; finish?: Finish; label?: string; className?: string;
}) {
  const [i, setI] = useState<number | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  /** Where the element sits on screen once scrolling finishes, to decide caption above/below. */
  const [viewTop, setViewTop] = useState(0);
  const card = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const titleId = useId();

  const close = useCallback(() => {
    setI(null), setBox(null);
    try { localStorage.setItem(seenKey(id), "1"); } catch {}
  }, [id]);

  /** Nearest step from `from` in direction `dir` whose element is on the page. */
  const go = useCallback((from: number, dir: 1 | -1) => {
    for (let n = from; n >= 0 && n < steps.length; n += dir) if (findTarget(steps[n]!.target)) return setI(n);
    if (dir === 1) close();
  }, [steps, close]);

  const goRef = useRef(go);
  goRef.current = go;

  // Start: ?tour=1 (hand-off from the landing tour) or the first visit when autoStart.
  useEffect(() => {
    if (started.current) return;
    const url = new URL(window.location.href);
    let seen = false;
    try { seen = !!localStorage.getItem(seenKey(id)); } catch {}
    if (url.searchParams.get("tour") === "1") {
      url.searchParams.delete("tour");
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    } else if (!autoStart || seen) return;
    started.current = true;
    setTimeout(() => goRef.current(0, 1), 600); // let the page settle first; survives re-renders
  }, [id, autoStart]);

  // Bring the step's element into view, then follow it every frame (smooth scroll, resizes, late layout).
  useEffect(() => {
    if (i === null) return;
    const el = findTarget(steps[i]!.target);
    if (!el) return go(i, 1);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const next = { top: r.top + window.scrollY, left: r.left + window.scrollX, width: r.width, height: r.height };
      setBox((b) => (b && b.top === next.top && b.left === next.left && b.width === next.width && b.height === next.height ? b : next));
      return next;
    };
    // Scroll so the element and its caption fit together (tall ones show their top, clear of a
    // sticky header). Sticky/fixed elements are always on screen, so they're never scrolled to.
    const b = measure();
    const room = b.height + PAD * 2 + CARD_H;
    let pinned = false;
    for (let n: HTMLElement | null = el; n && !pinned; n = n.parentElement) pinned = /sticky|fixed/.test(getComputedStyle(n).position);
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const to = Math.min(maxScroll, Math.max(0, b.top - PAD - (room < window.innerHeight ? (window.innerHeight - room) / 2 : 72)));
    if (!pinned) window.scrollTo({ top: to, behavior: reduce ? "auto" : "smooth" });
    setViewTop(b.top - (pinned ? window.scrollY : to));
    card.current?.focus({ preventScroll: true });
    // Layout can still shift (fonts, images, resizes); pinned elements also move with scrolling.
    const ro = new ResizeObserver(measure);
    ro.observe(el), ro.observe(document.body);
    window.addEventListener("resize", measure);
    if (pinned) window.addEventListener("scroll", measure, { passive: true });
    return () => (ro.disconnect(), window.removeEventListener("resize", measure), window.removeEventListener("scroll", measure));
  }, [i, steps, go]);

  useEffect(() => {
    if (i === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") go(i + 1, 1);
      else if (e.key === "ArrowLeft") go(i - 1, -1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [i, go, close]);

  const trigger = (
    <button type="button" onClick={() => go(0, 1)} className={cn("group inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors", className)}>
      <CursorGlyph className="size-4 transition-transform group-hover:-translate-y-0.5" />{label}
    </button>
  );
  if (i === null || !box) return trigger;

  const step = steps[i]!;
  const last = (() => { for (let n = i + 1; n < steps.length; n++) if (findTarget(steps[n]!.target)) return false; return true; })();
  const vw = document.documentElement.clientWidth, vh = window.innerHeight;
  const cw = Math.min(340, vw - 32);
  // Cursor rests just inside the element's lower-left third, like a hand pointing at it.
  const cx = Math.min(vw - 24, Math.max(8, box.left + Math.min(box.width * 0.35, 160)));
  const cy = box.top + Math.min(box.height * 0.6, 120);
  // Caption below the element if there's room on screen, else above it, else inside a tall one.
  const below = viewTop + box.height + PAD + 14 + CARD_H < vh;
  const above = !below && viewTop - PAD - 14 - CARD_H > 0;
  const cardTop = below ? box.top + box.height + PAD + 14 : above ? box.top - PAD - 14 : box.top + Math.min(box.height, vh - 24) - CARD_H;
  const cardLeft = Math.min(vw - cw - 16, Math.max(16, cx - 40));
  const move = "transition-all duration-700 ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none";

  return (
    <>
      {trigger}
      {createPortal(
        <div className="absolute left-0 top-0 z-[100] w-full">
          {/* Blocks clicks on the page while touring; the spotlight's shadow dims everything else. */}
          <div className="fixed inset-0" onClick={(e) => e.stopPropagation()} />
          <div
            className={cn("pointer-events-none absolute rounded-xl ring-2 ring-cyan-300/80 shadow-[0_0_0_9999px_rgb(2_6_23/0.62),0_0_40px_8px_rgb(34_211_238/0.25)]", move)}
            style={{ top: box.top - PAD, left: box.left - PAD, width: box.width + PAD * 2, height: box.height + PAD * 2 }}
          />
          <div className={cn("pointer-events-none absolute left-0 top-0", move)} style={{ transform: `translate(${cx}px, ${cy}px)` }}>
            <span key={i} className="absolute -left-3 -top-3 size-6 animate-[tour-ping_1.2s_ease-out_0.6s_2] rounded-full bg-cyan-300/60 opacity-0 motion-reduce:hidden" />
            <CursorGlyph className="relative size-8 drop-shadow-[0_4px_14px_rgb(99_102_241/0.7)]" />
          </div>
          <div
            ref={card} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId}
            className={cn("absolute rounded-2xl border border-white/10 bg-slate-950/95 p-4 text-white shadow-2xl outline-none backdrop-blur", above && "-translate-y-full", move)}
            style={{ top: cardTop, left: cardLeft, width: cw }}
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 rounded-full bg-gradient-to-r from-cyan-300 to-indigo-400 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-slate-950">{i + 1}/{steps.length}</span>
              <h2 id={titleId} className="flex-1 font-semibold leading-snug">{step.title}</h2>
              <button type="button" onClick={close} aria-label="End the tour" className="-m-1 rounded-md p-1 text-white/50 hover:bg-white/10 hover:text-white"><X className="size-4" /></button>
            </div>
            <p aria-live="polite" className="mt-2 text-sm leading-relaxed text-white/70">{step.body}</p>
            <div className="mt-4 flex items-center gap-2">
              <div className="mr-auto flex min-w-0 flex-1 gap-1 overflow-hidden">
                {steps.map((_, n) => <span key={n} className={cn("h-1 shrink-0 rounded-full transition-all", n === i ? "w-4 bg-cyan-300" : "w-1 bg-white/25")} />)}
              </div>
              {i > 0 && <button type="button" onClick={() => go(i - 1, -1)} className="inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-lg px-2.5 text-sm text-white/70 hover:bg-white/10 hover:text-white"><ArrowLeft className="size-3.5" />Back</button>}
              {last && finish ? (
                finish.action ? (
                  <form action={finish.action} onSubmit={close} className="shrink-0">
                    {finish.next && <input type="hidden" name="next" value={finish.next} />}
                    <button className="inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-lg bg-gradient-to-r from-cyan-300 to-indigo-400 px-3 text-sm font-medium text-slate-950">{finish.label}<ArrowRight className="size-3.5" /></button>
                  </form>
                ) : (
                  <a href={finish.href} onClick={close} className="inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-lg bg-gradient-to-r from-cyan-300 to-indigo-400 px-3 text-sm font-medium text-slate-950">{finish.label}<ArrowRight className="size-3.5" /></a>
                )
              ) : (
                <button type="button" onClick={() => go(i + 1, 1)} className="inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-lg bg-white px-3 text-sm font-medium text-slate-950 hover:bg-white/90">{last ? "Done" : "Next"}{!last && <ArrowRight className="size-3.5" />}</button>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

/** Pointer arrow with a cyan → indigo → pink gradient. */
function CursorGlyph({ className }: { className?: string }) {
  const g = useId();
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#67e8f9" /><stop offset="0.55" stopColor="#818cf8" /><stop offset="1" stopColor="#f472b6" />
        </linearGradient>
      </defs>
      <path d="M3.5 2.5 20 10.2l-7.1 2.1-3.3 7.2L3.5 2.5Z" fill={`url(#${g})`} stroke="white" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}
