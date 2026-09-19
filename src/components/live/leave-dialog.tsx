"use client";

import { useEffect } from "react";
import { PhoneOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Warn before closing or reloading the tab while a call is recording. */
export function useLeaveGuard(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [active]);
}

/** The one way out of a live call: keep going, finish with notes, or throw it away. */
export function LeaveCallDialog({ open, onOpenChange, onEnd, onDiscard, hasContent }: {
  open: boolean; onOpenChange: (o: boolean) => void; onEnd: () => void; onDiscard: () => void; hasContent: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Leave this recording?</DialogTitle>
          <DialogDescription>
            {hasContent ? "End it to keep the transcript and get AI notes, or discard it to delete everything recorded so far." : "Nothing has been transcribed yet. Discarding deletes this recording."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Keep recording</Button>
          <div className="flex gap-2">
            <Button variant="outline" className="text-destructive hover:text-destructive" onClick={onDiscard}><Trash2 />Discard</Button>
            {hasContent && <Button onClick={onEnd}><PhoneOff />End & get notes</Button>}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
