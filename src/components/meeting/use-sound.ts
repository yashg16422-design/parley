"use client";

import { useEffect, useRef, useState } from "react";
import { lineAt, type Player, type Seg } from "./player";

/** macOS ships joke voices; never give one to a speaker. */
const NOVELTY = /\b(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Good News|Jester|Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox|Deranged|Hysterical|Pipe Organ|Grandma|Grandpa|Eddy|Flo|Reed|Rocko|Sandy|Shelley)\b/i;
const GOOD = /Google|Enhanced|Premium|Natural|Neural|Samantha|Daniel|Karen|Moira|Tessa|Alex|Aaron|Nicky|Microsoft (Aria|Guy|Jenny)/i;

export type SoundMode = "loading" | "recording" | "voice" | "none";
type Opts = { meetingId?: string; recording: { startMs: number } | null; segments: readonly Seg[]; speakerOrder: readonly string[] };

/**
 * Sound for the playback timeline. The player clock stays the single source of
 * truth; this follows it.
 *  - recording: the meeting's own audio, fetched once, kept within 0.4 s of the clock
 *  - voice: no recording exists (seeded or typed calls), so each line is read
 *    aloud with the browser's speech synthesis, one voice per speaker
 */
export function useMeetingSound(player: Player, { meetingId, recording, segments, speakerOrder }: Opts) {
  const [mode, setMode] = useState<SoundMode>(recording && meetingId ? "loading" : "voice");
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  // Recorded audio.
  useEffect(() => {
    if (!recording || !meetingId) return;
    let url = "", audio: HTMLAudioElement | null = null, cancelled = false;
    (async () => {
      const r = await fetch(`/api/recordings/${meetingId}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      url = URL.createObjectURL(await r.blob());
      const a = new Audio(url);
      a.preload = "auto";
      await new Promise<void>((done, fail) => ((a.onloadedmetadata = () => done()), (a.onerror = () => fail(new Error("unplayable")))));
      // Browser-recorded webm has no duration header; seeking to the end once makes it seekable.
      if (!Number.isFinite(a.duration)) {
        await new Promise<void>((done) => ((a.ontimeupdate = () => ((a.ontimeupdate = null), done())), (a.currentTime = 1e9)));
        a.currentTime = 0;
      }
      if (cancelled) return;
      audio = a;
      setMode("recording");
    })().catch(() => !cancelled && setMode("voice"));

    const sync = () => {
      if (!audio) return;
      const st = player.get();
      const t = (st.ms - recording.startMs) / 1000;
      if (!st.playing || mutedRef.current || t < 0 || t >= audio.duration) return void (audio.paused || audio.pause());
      audio.playbackRate = st.rate;
      if (Math.abs(audio.currentTime - t) > 0.4) audio.currentTime = t;
      if (audio.paused) void audio.play().catch(() => {});
    };
    const off = player.subscribe(sync);
    return () => {
      cancelled = true;
      off(), audio?.pause();
      if (url) URL.revokeObjectURL(url);
    };
  }, [player, meetingId, recording]);

  // Synthesized voice fallback.
  useEffect(() => {
    if (mode !== "voice" || typeof speechSynthesis === "undefined") return;
    const synth = speechSynthesis;
    let voices: SpeechSynthesisVoice[] = [], last = -1;
    const load = () => {
      const all = synth.getVoices();
      const lang = navigator.language.slice(0, 2);
      const usable = all.filter((v) => (v.lang.startsWith(lang) || v.lang.startsWith("en")) && !NOVELTY.test(v.name));
      // Natural-sounding voices first (Chrome's Google voices, macOS/Windows enhanced ones), then the rest.
      voices = [...usable].sort((a, b) => Number(GOOD.test(b.name)) - Number(GOOD.test(a.name)) || Number(b.lang.startsWith(lang)) - Number(a.lang.startsWith(lang)));
      if (!voices.length) voices = all;
    };
    load();
    synth.addEventListener("voiceschanged", load);
    const sync = () => {
      const st = player.get();
      if (!st.playing || mutedRef.current || st.rate > 2) {
        if (last !== -1) synth.cancel(), (last = -1);
        return;
      }
      const i = lineAt(segments, st.ms);
      const seg = segments[i];
      if (i === last || !seg || st.ms > seg.endMs + 1_500) return;
      last = i;
      const u = new SpeechSynthesisUtterance(seg.text);
      const who = Math.max(0, speakerOrder.indexOf(seg.participantId));
      if (voices.length) u.voice = voices[who % voices.length]!;
      u.pitch = 0.85 + (who % 4) * 0.1;
      // Fit the line into its real duration (~2.6 words/s at rate 1), within a natural range.
      const need = seg.text.split(/\s+/).length / 2.6 / Math.max(0.5, (seg.endMs - Math.max(st.ms, seg.startMs)) / 1000);
      u.rate = Math.min(2, Math.max(0.9, need)) * st.rate;
      synth.cancel();
      synth.speak(u);
    };
    const off = player.subscribe(sync);
    return () => {
      off(), synth.cancel();
      synth.removeEventListener("voiceschanged", load);
    };
  }, [mode, player, segments, speakerOrder]);

  return { mode, muted, setMuted };
}
