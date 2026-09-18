export interface Seg {
  seq: number;
  participantId: string;
  speakerName: string;
  startMs: number;
  endMs: number;
  text: string;
}

export interface Window {
  idx: number;
  firstSeq: number;
  lastSeq: number;
  /** First line shown to the model: a few lines of lead-in from the previous window. */
  contextSeq: number;
  startMs: number;
  endMs: number;
}

export const WINDOW_MS = 10 * 60_000;

const mmss = (ms: number) => `${String(Math.floor(ms / 60_000)).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;

/** Compact line format the model cites: `[#412 23:14 Raj Patel] text`. */
export const formatLine = (s: Seg) => `[#${s.seq} ${mmss(s.startMs)} ${s.speakerName}] ${s.text}`;

/**
 * Slice a transcript (ordered by seq) into ~10-minute windows. Boundaries snap
 * forward to the next speaker change so no turn is cut in half, and each window
 * carries `overlap` lines of lead-in so context isn't lost at the seam.
 */
export function planWindows(segs: readonly Seg[], windowMs = WINDOW_MS, overlap = 3): Window[] {
  const out: Window[] = [];
  let boundary = windowMs;
  let first = 0;
  for (let i = 1; i <= segs.length; i++) {
    const s = segs[i];
    const cut = !s || (s.startMs >= boundary && s.participantId !== segs[i - 1]!.participantId);
    if (!cut) continue;
    const a = segs[first]!;
    const b = segs[i - 1]!;
    out.push({
      idx: out.length,
      firstSeq: a.seq,
      lastSeq: b.seq,
      contextSeq: segs[Math.max(0, first - overlap)]!.seq,
      startMs: a.startMs,
      endMs: b.endMs,
    });
    first = i;
    if (s) boundary = (Math.floor(s.startMs / windowMs) + 1) * windowMs;
  }
  return out;
}

/**
 * For a live call: windows that can be processed now. The newest window is
 * still filling up, so it's held back until the call ends.
 */
export const closedWindows = (segs: readonly Seg[], callEnded: boolean, windowMs = WINDOW_MS) => {
  const all = planWindows(segs, windowMs);
  return callEnded ? all : all.slice(0, -1);
};

export const windowLines = (segs: readonly Seg[], w: Window) => segs.filter((s) => s.seq >= w.contextSeq && s.seq <= w.lastSeq);
