"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const path = usePathname();
  const active = href === "/home" ? path === "/home" || path.startsWith("/meetings") : path.startsWith(href);
  return (
    <Link href={href} className={cn("flex items-center gap-3 rounded-lg px-3 py-2 max-md:gap-1.5 max-md:px-2 max-md:text-xs text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground [&_svg]:size-4", active && "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary")}>
      {children}
    </Link>
  );
}
