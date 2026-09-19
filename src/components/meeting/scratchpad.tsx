"use client";

import { useEffect, useRef, useState } from "react";
import { Clock3, Lock } from "lucide-react";
import { LoadingDots } from "@/components/loading-dots";
import { clock } from "@/lib/format";

const STAMP = /\[(\d{1,3}):(\d{2})\]/g;

/**
 * Private notes next to the meeting, like a paper pad. Autosaves as you type.
 * `now` gives the call clock for "Add timestamp"; `onJump` turns [mm:ss] stamps
 * into links back into the recording.
 */
export function Scratchpad({ meetingId, now, onJump }: { meetingId: string; now?: () => number; onJump?: (ms: number) => void }) {
  const [body, setBody] = useState<string | null>(null);
  const [state, setState] = useState<"saved" | "saving" | "error">("saved");
  const area = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let off = false;
    fetch(`/api/meetings/${meetingId}/scratchpad`).then((r) => r.json()).then((j) => !off && setBody(j.body ?? ""), () => !off && setBody(""));
    return () => void (off = true);
  }, [meetingId]);

  const save = (text: string) => {
    setState("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const r = await fetch(`/api/meetings/${meetingId}/scratchpad`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ body: text }) }).catch(() => null);
      setState(r?.ok ? "saved" : "error");
    }, 700);
  };
  const change = (text: string) => (setBody(text), save(text));

  const stamp = () => {
    const el = area.current;
    if (!el || body === null || !now) return;
    const at = `[${clock(now())}] `;
    const pos = el.selectionStart ?? body.length;
    const lead = pos > 0 && body[pos - 1] !== "\n" ? "\n" : "";
    change(body.slice(0, pos) + lead + at + body.slice(pos));
    requestAnimationFrame(() => (el.focus(), el.setSelectionRange(pos + lead.length + at.length, pos + lead.length + at.length)));
  };

  if (body === null) return <LoadingDots className="py-8" />;
  const stamps = onJump ? [...body.matchAll(STAMP)].map((m) => ({ label: `${m[1]}:${m[2]}`, ms: (Number(m[1]) * 60 + Number(m[2])) * 1000 })) : [];
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <Lock className="size-3" />Only you can see this
        <span className="ml-auto">{state === "saving" ? "Saving…" : state === "error" ? <span className="text-destructive">Not saved, retrying on next edit</span> : "Saved"}</span>
      </div>
      <textarea
        ref={area}
        value={body}
        onChange={(e) => change(e.target.value)}
        onKeyDown={(e) => now && (e.metaKey || e.ctrlKey) && e.key === "Enter" && (e.preventDefault(), stamp())}
        placeholder={now ? "Jot down anything. ⌘↵ adds the current time." : "Your private notes on this meeting…"}
        className="min-h-56 w-full resize-y rounded-lg border bg-background p-3 font-mono text-[13px] leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        maxLength={20_000}
      />
      {now && <button onClick={stamp} className="inline-flex items-center gap-1 text-xs text-primary hover:underline"><Clock3 className="size-3.5" />Add timestamp</button>}
      {stamps.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {stamps.map((s, i) => <button key={i} onClick={() => onJump!(s.ms)} className="rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] text-primary hover:bg-primary hover:text-primary-foreground">▶ {s.label}</button>)}
        </div>
      )}
    </div>
  );
}
