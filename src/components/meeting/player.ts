"use client";

import { useSyncExternalStore } from "react";

export type PlayerState = { ms: number; playing: boolean; rate: number };
export type Seg = { seq: number; participantId: string; speakerName: string; startMs: number; endMs: number; text: string };

/** A tiny external store for the playback clock; components subscribe to just the slice they render. */
export function createPlayer(durationMs: number, startMs = 0) {
  let state: PlayerState = { ms: startMs, playing: false, rate: 1 };
  const subs = new Set<() => void>();
  let raf = 0;
  let last = 0;
  const set = (patch: Partial<PlayerState>) => {
    state = { ...state, ...patch };
    subs.forEach((f) => f());
  };
  const tick = (t: number) => {
    if (!state.playing) return;
    const ms = Math.min(durationMs, state.ms + (last ? t - last : 0) * state.rate);
    last = t;
    set({ ms, playing: ms < durationMs });
    raf = requestAnimationFrame(tick);
  };
  const player = {
    durationMs,
    get: () => state,
    subscribe: (f: () => void) => (subs.add(f), () => void subs.delete(f)),
    play() {
      if (state.playing) return;
      last = 0;
      set({ playing: true, ms: state.ms >= durationMs ? 0 : state.ms });
      raf = requestAnimationFrame(tick);
    },
    pause() {
      cancelAnimationFrame(raf);
      set({ playing: false });
    },
    toggle: () => (state.playing ? player.pause() : player.play()),
    seek: (ms: number) => set({ ms: Math.max(0, Math.min(durationMs, ms)) }),
    setRate: (rate: number) => set({ rate }),
  };
  return player;
}
export type Player = ReturnType<typeof createPlayer>;

export const usePlayer = <T,>(p: Player, select: (s: PlayerState) => T) => useSyncExternalStore(p.subscribe, () => select(p.get()), () => select(p.get()));

/** Index of the line being spoken at `ms` (last line that started at or before it). */
export function lineAt(segs: readonly Seg[], ms: number) {
  let lo = 0, hi = segs.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (segs[mid]!.startMs <= ms) (ans = mid), (lo = mid + 1);
    else hi = mid - 1;
  }
  return ans;
}

/** Seek and bring the line into view; used by citations, action items and search links. */
export function jumpTo(p: Player, ms: number, seq?: number) {
  p.seek(ms);
  if (seq !== undefined) document.getElementById(`line-${seq}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
}
