import { cn } from "@/lib/utils";

/** The one waiting indicator: three soft pulsing dots, optionally with a label. */
export function LoadingDots({ label, className }: { label?: string; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={cn("flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground", className)}>
      <div className="flex gap-1.5" aria-hidden>
        {[0, 1, 2].map((i) => <span key={i} className="loading-dot size-2 rounded-full bg-primary/70" />)}
      </div>
      {label ? <span>{label}</span> : <span className="sr-only">Loading</span>}
    </div>
  );
}

/** Full-area loader, centred in whatever region it fills. */
export const PageLoading = ({ label }: { label?: string }) => <LoadingDots label={label} className="min-h-[60dvh] w-full" />;

/** Blocks the screen while something important finishes (ending a call, writing notes). */
export const OverlayLoading = ({ label }: { label: string }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-[2px]">
    <div className="rounded-xl border bg-background px-8 py-6 shadow-sm"><LoadingDots label={label} /></div>
  </div>
);
