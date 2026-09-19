import { Clock3 } from "lucide-react";

type Me = { kind: "demo" | "guest" | "account"; expiresAt: Date | null };

export const hoursLeft = (me: Me) => (me.expiresAt ? Math.max(0, Math.ceil((me.expiresAt.getTime() - Date.now()) / 3_600_000)) : 0);

/** Which mode this workspace is: shown wherever the user could forget. */
export function ModeBadge({ me }: { me: Me }) {
  const cls = "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide";
  if (me.kind === "account") return <span className={`${cls} bg-primary/15 text-primary`}>Saved</span>;
  if (me.kind === "guest") return <span className={`${cls} bg-amber-500/15 text-amber-600 dark:text-amber-300`}>Try now</span>;
  return <span className={`${cls} bg-muted text-muted-foreground`}>Demo</span>;
}

/** "Your data disappears in N hours" with the one-click way to keep it. */
export function GuestNotice({ me, compact }: { me: Me; compact?: boolean }) {
  if (me.kind !== "guest") return null;
  return (
    <div className={compact ? "rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs" : "flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm"}>
      <p className={compact ? "mb-2 flex items-center gap-1.5 text-amber-700 dark:text-amber-200" : "flex flex-1 items-center gap-2 text-amber-800 dark:text-amber-200"}>
        <Clock3 className="size-3.5 shrink-0" />Try-now workspace: deleted in {hoursLeft(me)}h.
      </p>
      <a href="/api/auth/google?next=/home" className={compact ? "block rounded-md bg-foreground px-2 py-1.5 text-center font-medium text-background" : "rounded-md bg-foreground px-3 py-1.5 font-medium text-background"}>Keep it: sign up with Google</a>
    </div>
  );
}
