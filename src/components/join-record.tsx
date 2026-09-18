"use client";

import Link from "next/link";
import { ExternalLink, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PLATFORM } from "./event-details";

/** Fathom-style: join the call in its own app, and record it here from the mic. */
export function JoinRecord({ eventId, meetingUrl, platform, size = "sm" }: { eventId: string; meetingUrl: string; platform: keyof typeof PLATFORM; size?: "sm" | "default" }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <Button asChild size={size} variant="outline"><a href={meetingUrl} target="_blank" rel="noopener noreferrer"><ExternalLink />Join {PLATFORM[platform]}</a></Button>
      <Button asChild size={size}><Link href={`/live/mic?eventId=${eventId}`}><Mic />Record</Link></Button>
    </div>
  );
}
