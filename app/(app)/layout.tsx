import { CalendarDays, CheckSquare, Home, LogOut, Search, Waves, Settings, Sparkles } from "lucide-react";
import { leaveWorkspace } from "@app/actions/workspace";
import { CommandBar } from "@/components/command-bar";
import { GuestNotice, ModeBadge } from "@/components/mode-badge";
import { NavLink } from "@/components/nav-link";
import { SubmitButton } from "@/components/submit-button";
import { PersonAvatar } from "@/components/person";
import { currentUser } from "@/queries";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await currentUser();
  return (
    <div className="flex min-h-dvh">
      <a href="#main" className="sr-only z-50 rounded-md bg-background px-3 py-2 text-sm shadow focus:not-sr-only focus:fixed focus:left-3 focus:top-3">Skip to content</a>
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r bg-muted/30 p-3 md:flex">
        <div className="flex items-center gap-2 px-3 py-3 text-lg font-semibold tracking-tight">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Waves className="size-4" /></span>
          Parley
        </div>
        <div className="mt-3 px-1"><CommandBar /></div>
        <nav className="mt-4 flex flex-col gap-1">
          <NavLink href="/home"><Home />Home</NavLink>
          <NavLink href="/ask"><Sparkles />Ask Parley</NavLink>
          <NavLink href="/calendar"><CalendarDays />Calendar</NavLink>
          <NavLink href="/action-items"><CheckSquare />Action items</NavLink>
          <NavLink href="/search"><Search />Search</NavLink>
          <NavLink href="/settings"><Settings />Settings</NavLink>
        </nav>
        <div className="mt-auto space-y-2">
        <GuestNotice me={me} compact />
        <div className="flex items-center gap-2 rounded-lg border bg-background p-2">
          {me.avatarUrl ? <img src={me.avatarUrl} alt="" referrerPolicy="no-referrer" className="size-8 rounded-full" /> : <PersonAvatar name={me.name} color="#0F766E" className="size-8" />}
          <div className="min-w-0 flex-1 text-xs">
            <div className="flex items-center gap-1.5"><span className="truncate font-medium">{me.name}</span><ModeBadge me={me} /></div>
            <div className="truncate text-muted-foreground">{me.kind === "account" ? me.email : me.title}</div>
          </div>
          <form action={leaveWorkspace}>
            <SubmitButton variant="ghost" size="icon" title={me.kind === "account" ? "Sign out" : "Leave this workspace"} className="size-7 text-muted-foreground"><LogOut className="size-4" /></SubmitButton>
          </form>
        </div>
        </div>
      </aside>
      <main id="main" className="min-w-0 flex-1">
        <nav className="sticky top-0 z-20 flex items-center justify-around border-b bg-background/95 p-1.5 backdrop-blur md:hidden">
          <NavLink href="/home"><Home />Home</NavLink>
          <NavLink href="/calendar"><CalendarDays />Calendar</NavLink>
          <NavLink href="/action-items"><CheckSquare />Tasks</NavLink>
          <NavLink href="/search"><Search />Search</NavLink>
        </nav>
        {children}
      </main>
    </div>
  );
}
