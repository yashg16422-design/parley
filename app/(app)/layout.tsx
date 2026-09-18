import { CalendarDays, CheckSquare, Home, Search, Waves } from "lucide-react";
import { NavLink } from "@/components/nav-link";
import { PersonAvatar } from "@/components/person";
import { currentUser } from "@/queries";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await currentUser();
  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r bg-muted/30 p-3 md:flex">
        <div className="flex items-center gap-2 px-3 py-3 text-lg font-semibold tracking-tight">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Waves className="size-4" /></span>
          Parley
        </div>
        <nav className="mt-4 flex flex-col gap-1">
          <NavLink href="/"><Home />Home</NavLink>
          <NavLink href="/calendar"><CalendarDays />Calendar</NavLink>
          <NavLink href="/action-items"><CheckSquare />Action items</NavLink>
          <NavLink href="/search"><Search />Search</NavLink>
        </nav>
        <div className="mt-auto flex items-center gap-2 rounded-lg border bg-background p-2">
          <PersonAvatar name={me.name} color="#7C3AED" className="size-8" />
          <div className="min-w-0 text-xs">
            <div className="truncate font-medium">{me.name}</div>
            <div className="truncate text-muted-foreground">{me.title}</div>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        <nav className="sticky top-0 z-20 flex items-center justify-around border-b bg-background/95 p-1.5 backdrop-blur md:hidden">
          <NavLink href="/"><Home />Home</NavLink>
          <NavLink href="/calendar"><CalendarDays />Calendar</NavLink>
          <NavLink href="/action-items"><CheckSquare />Tasks</NavLink>
          <NavLink href="/search"><Search />Search</NavLink>
        </nav>
        {children}
      </main>
    </div>
  );
}
