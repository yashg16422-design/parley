"use client";

import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

export type Participant = { id: string; name: string; color: string; title?: string | null; company?: string | null; isExternal?: boolean };

const COLS = ["grid-cols-1", "grid-cols-1", "grid-cols-2", "grid-cols-2", "grid-cols-2", "grid-cols-3", "grid-cols-3", "grid-cols-4", "grid-cols-4"];

/** The simulated call "video": one tile per participant, the active speaker lit up. */
export function ParticipantGrid({ participants, activeId, className }: { participants: Participant[]; activeId?: string | null; className?: string }) {
  return (
    <div className={cn("grid gap-2", COLS[Math.min(participants.length, 8)], className)}>
      {participants.map((p) => {
        const active = p.id === activeId;
        return (
          <div key={p.id} className={cn("relative flex aspect-video min-h-0 items-center justify-center overflow-hidden rounded-xl bg-zinc-800 ring-2 ring-transparent transition-all", active && "ring-primary")}>
            <span className={cn("flex size-[28%] min-h-9 min-w-9 max-w-20 items-center justify-center rounded-full text-sm font-semibold text-white transition-transform sm:text-base", active && "scale-110")} style={{ backgroundColor: p.color }}>
              {initials(p.name)}
            </span>
            <div className="absolute bottom-1.5 left-2 flex max-w-[85%] items-center gap-1.5 rounded bg-black/50 px-1.5 py-0.5 text-[11px] text-white">
              {active && (
                <span className="flex h-2.5 items-end gap-px" aria-hidden>
                  {[0, 1, 2].map((i) => <span key={i} className="eq-bar w-0.5 rounded-full bg-green-400" style={{ height: "100%", animationDelay: `${i * 0.15}s` }} />)}
                </span>
              )}
              <span className="truncate">{p.name}</span>
            </div>
            {p.isExternal && <span className="absolute right-1.5 top-1.5 rounded bg-white/15 px-1 text-[10px] text-white/80">{p.company ?? "Guest"}</span>}
          </div>
        );
      })}
    </div>
  );
}
