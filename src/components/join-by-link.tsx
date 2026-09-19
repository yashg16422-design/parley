"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Link2 } from "lucide-react";
import { startFresh } from "@app/actions/workspace";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { findMeetingLink, PLATFORM_NAME } from "@/lib/meeting-links";

/** Where the mic room picks the link up. Kept out of the URL so Zoom passcodes don't land in history or logs. */
export const JOIN_KEY = "parley:join-link";
export const JOIN_PATH = "/live/mic?join=1";

/**
 * Paste a Zoom / Meet / Teams link → the recording room, set up for that call.
 * Signed in: goes straight there. Signed out: creates a fresh workspace first.
 */
export function JoinByLink({ signedIn, compact }: { signedIn: boolean; compact?: boolean }) {
  const router = useRouter();
  const [link, setLink] = useState("");
  const [error, setError] = useState<string | null>(null);
  const found = findMeetingLink(link.trim());

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (!found) return e.preventDefault(), setError("Paste a Zoom, Google Meet or Teams join link.");
    try {
      sessionStorage.setItem(JOIN_KEY, JSON.stringify(found));
    } catch { /* private mode: the room will ask for the link again */ }
    if (signedIn) e.preventDefault(), router.push(JOIN_PATH);
  };

  return (
    <form action={startFresh} onSubmit={onSubmit} className={compact ? "flex w-full max-w-md gap-2" : "space-y-2"}>
      <input type="hidden" name="next" value={JOIN_PATH} />
      <div className="relative flex-1">
        <Link2 className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={link} onChange={(e) => (setLink(e.target.value), setError(null))} placeholder="https://zoom.us/j/… or meet.google.com/…" className="pl-8" aria-label="Meeting link" />
      </div>
      {!signedIn && !compact && <Input name="name" placeholder="Your name" maxLength={60} />}
      <SubmitButton className={compact ? "" : "w-full"} disabled={!link.trim()}>
        {found ? `Record this ${PLATFORM_NAME[found.platform]} call` : "Join & record"}<ArrowRight />
      </SubmitButton>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </form>
  );
}
