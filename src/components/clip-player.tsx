"use client";

import { useMemo } from "react";
import { ParticipantGrid, type Participant } from "./meeting/participant-grid";
import { createPlayer, lineAt, type Seg, usePlayer } from "./meeting/player";
import { Scrubber } from "./meeting/scrubber";
import { SoundToggle } from "./meeting/sound-toggle";
import { useMeetingSound } from "./meeting/use-sound";
import { Transcript } from "./meeting/transcript";

/** Plays just the clip's range: the clock runs 0..length and is offset into the meeting. */
export function ClipPlayer({ participants, segments, startMs, endMs }: { participants: Participant[]; segments: Seg[]; startMs: number; endMs: number }) {
  const player = useMemo(() => createPlayer(endMs - startMs), [startMs, endMs]);
  const active = usePlayer(player, (s) => lineAt(segments, s.ms + startMs));
  const speakers = participants.filter((p) => segments.some((s) => s.participantId === p.id));
  // Public clips never expose the full recording, so they read their lines aloud instead.
  const local = useMemo(() => segments.map((s) => ({ ...s, startMs: Math.max(0, s.startMs - startMs), endMs: Math.max(0, s.endMs - startMs) })), [segments, startMs]);
  const order = useMemo(() => participants.map((p) => p.id), [participants]);
  const sound = useMeetingSound(player, { recording: null, segments: local, speakerOrder: order });
  return (
    <div className="overflow-hidden rounded-xl border bg-background">
      <div className="space-y-3 bg-zinc-950 p-3">
        <ParticipantGrid participants={speakers} activeId={segments[active]?.participantId} className="mx-auto max-w-2xl" />
        <div className="space-y-1 rounded-lg bg-background px-3 pt-2 pb-1"><Scrubber player={player} chapters={[]} markers={[]} /><SoundToggle {...sound} /></div>
      </div>
      <Transcript segments={segments} colors={Object.fromEntries(participants.map((p) => [p.id, p.color]))} activeIdx={active} onLine={(s) => player.seek(Math.max(0, s.startMs - startMs))} />
    </div>
  );
}
