import Link from "next/link";
import { FileSpreadsheet, FileText, Link2, Presentation } from "lucide-react";
import type { Attachment } from "@/db/json-types";
import { cn } from "@/lib/utils";

const ICON = { pdf: FileText, doc: FileText, sheet: FileSpreadsheet, slides: Presentation, link: Link2 } as const;
export const PLATFORM = { zoom: "Zoom", google_meet: "Google Meet", teams: "Microsoft Teams" } as const;

/** Seeded briefs open in-app; real links open in a new tab. */
export const attachmentHref = (eventId: string, a: Attachment, i: number) => (a.url ? a.url : `/attachments/${eventId}/${i}`);

export function Attachments({ eventId, items, className }: { eventId: string; items: Attachment[]; className?: string }) {
  if (!items.length) return null;
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {items.map((a, i) => {
        const Icon = ICON[a.kind];
        return (
          <Link key={i} href={attachmentHref(eventId, a, i)} target={a.url ? "_blank" : undefined} rel="noopener noreferrer"
            className="inline-flex max-w-full items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs hover:border-primary hover:text-primary">
            <Icon className="size-3.5 shrink-0 text-primary" /><span className="truncate">{a.title}</span>
          </Link>
        );
      })}
    </div>
  );
}

export function Agenda({ text, clamp }: { text: string | null; clamp?: boolean }) {
  if (!text) return null;
  return <p className={cn("whitespace-pre-line text-xs leading-relaxed text-muted-foreground", clamp && "line-clamp-3")}>{text}</p>;
}
