"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, CheckSquare, CornerDownLeft, Home, Link2, Mic, Search, Settings, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { JOIN_KEY, JOIN_PATH } from "@/components/join-by-link";
import { findMeetingLink } from "@/lib/meeting-links";
import { cn } from "@/lib/utils";

type Item = { label: string; hint?: string; icon: typeof Search; go: (q: string) => string };
const PAGES: Item[] = [
  { label: "Home", icon: Home, go: () => "/home" },
  { label: "Record a meeting", icon: Mic, go: () => "/live/mic" },
  { label: "Calendar", icon: CalendarDays, go: () => "/calendar" },
  { label: "Action items", icon: CheckSquare, go: () => "/action-items" },
  { label: "Settings: keys, calendar feed, tokens", icon: Settings, go: () => "/settings" },
];

/** ⌘K anywhere: search every transcript, ask Parley, or jump to a page. */
export function CommandBar({ variant = "sidebar" }: { variant?: "sidebar" | "hero" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);

  useEffect(() => {
    if (variant !== "sidebar") return; // one global shortcut, owned by the sidebar instance
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") e.preventDefault(), setOpen((o) => !o);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [variant]);

  const items = useMemo<Item[]>(() => {
    const t = q.trim();
    const pages = PAGES.filter((p) => !t || p.label.toLowerCase().includes(t.toLowerCase()));
    if (!t) return pages;
    const link = /zoom\.us\/|meet\.google\.com\/|teams\.(microsoft|live)\.com\//i.test(t);
    return [
      ...(link ? [{ label: "Join & record this call", hint: t, icon: Link2, go: (x) => {
        const found = findMeetingLink(x);
        try { if (found) sessionStorage.setItem(JOIN_KEY, JSON.stringify(found)); } catch { /* private mode */ }
        return JOIN_PATH;
      } } as Item] : []),
      { label: `Ask Parley: “${t}”`, hint: "Cited answer across all meetings", icon: Sparkles, go: (x) => `/ask?q=${encodeURIComponent(x)}` },
      { label: `Search transcripts for “${t}”`, hint: "Every moment it was said", icon: Search, go: (x) => `/search?q=${encodeURIComponent(x)}` },
      ...pages,
    ];
  }, [q]);

  const run = (i: Item) => {
    setOpen(false), setQ(""), setSel(0);
    router.push(i.go(q.trim()));
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") e.preventDefault(), setSel((x) => Math.min(items.length - 1, x + 1));
    else if (e.key === "ArrowUp") e.preventDefault(), setSel((x) => Math.max(0, x - 1));
    else if (e.key === "Enter" && items[sel]) e.preventDefault(), run(items[sel]!);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg border bg-background text-left text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground",
          variant === "hero" ? "h-12 px-4 text-sm shadow-[0_1px_2px_rgb(0_0_0/0.04)]" : "h-9 px-3 text-xs",
        )}
      >
        <Search className={variant === "hero" ? "size-4" : "size-3.5"} />
        <span className="flex-1 truncate">{variant === "hero" ? "Search every call, or ask Parley a question…" : "Search or ask…"}</span>
        <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
      </button>
      <Dialog open={open} onOpenChange={(o) => (setOpen(o), o || setQ(""))}>
        <DialogContent showCloseButton={false} className="top-[12%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl">
          <DialogTitle className="sr-only">Search or ask</DialogTitle>
          <div className="flex items-center gap-2 border-b px-4">
            <Search className="size-4 text-muted-foreground" />
            <input autoFocus value={q} onChange={(e) => (setQ(e.target.value), setSel(0))} onKeyDown={onKey} placeholder="Search transcripts, ask a question, or jump to…" className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
          </div>
          <ul className="max-h-80 overflow-y-auto p-1.5" role="listbox">
            {items.map((it, i) => (
              <li key={it.label} role="option" aria-selected={i === sel}>
                <button onMouseEnter={() => setSel(i)} onClick={() => run(it)} className={cn("flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm", i === sel && "bg-muted")}>
                  <it.icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{it.label}{it.hint && <span className="ml-2 text-xs text-muted-foreground">{it.hint}</span>}</span>
                  {i === sel && <CornerDownLeft className="size-3.5 text-muted-foreground" />}
                </button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
