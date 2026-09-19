"use client";

import { Volume2, VolumeX } from "lucide-react";
import type { SoundMode } from "./use-sound";

const LABEL: Record<SoundMode, string> = {
  loading: "Loading audio…",
  recording: "Call recording",
  voice: "Synthesized voice · no recording for this call",
  none: "No audio",
};

/** Mute button plus an honest label for what the viewer is hearing. */
export function SoundToggle({ mode, muted, setMuted }: { mode: SoundMode; muted: boolean; setMuted: (m: boolean) => void }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <button onClick={() => setMuted(!muted)} aria-label={muted ? "Unmute" : "Mute"} className="rounded-md p-1 hover:bg-muted hover:text-foreground">
        {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
      </button>
      <span className="truncate">{muted ? "Muted" : LABEL[mode]}</span>
    </div>
  );
}
