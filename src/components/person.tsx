import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

/** Colored initials avatar; the app never loads external images. */
export function PersonAvatar({ name, color, className }: { name: string; color?: string | null; className?: string }) {
  return (
    <span
      title={name}
      className={cn("inline-flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white ring-2 ring-background", className)}
      style={{ backgroundColor: color ?? "#6366F1" }}
    >
      {initials(name)}
    </span>
  );
}

export function AvatarStack({ people, max = 4 }: { people: { name: string; color?: string | null }[]; max?: number }) {
  return (
    <div className="flex -space-x-2">
      {people.slice(0, max).map((p) => <PersonAvatar key={p.name} {...p} />)}
      {people.length > max && <span className="inline-flex size-7 items-center justify-center rounded-full bg-muted text-[11px] font-medium ring-2 ring-background">+{people.length - max}</span>}
    </div>
  );
}
