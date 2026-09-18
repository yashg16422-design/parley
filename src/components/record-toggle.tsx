"use client";

import { useOptimistic, useTransition } from "react";
import { setRecording } from "@app/actions/meetings";
import { cn } from "@/lib/utils";

export function RecordToggle({ eventId, enabled }: { eventId: string; enabled: boolean }) {
  const [on, set] = useOptimistic(enabled);
  const [, start] = useTransition();
  return (
    <button
      role="switch" aria-checked={on} aria-label="Record this meeting"
      onClick={() => start(async () => (set(!on), setRecording(eventId, !on)))}
      className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors", on ? "bg-primary" : "bg-muted-foreground/30")}
    >
      <span className={cn("absolute top-0.5 size-4 rounded-full bg-white shadow transition-all", on ? "left-[18px]" : "left-0.5")} />
    </button>
  );
}
