import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Friendly dead end: say what happened and offer the two useful ways out. */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <p className="font-mono text-sm text-muted-foreground">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-[-0.02em]">We couldn&apos;t find that page.</h1>
      <p className="mt-2 text-sm text-muted-foreground">The meeting or clip may have been deleted, or it belongs to a workspace you&apos;re not signed in to.</p>
      <div className="mt-6 flex gap-2">
        <Button asChild><Link href="/home"><ArrowLeft />Back to your meetings</Link></Button>
        <Button asChild variant="ghost"><Link href="/">Switch workspace</Link></Button>
      </div>
    </main>
  );
}
