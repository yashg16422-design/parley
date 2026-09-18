import Link from "next/link";
import { ArrowRight, Database, Mic, Waves } from "lucide-react";
import { enterDemo, startFresh } from "@app/actions/workspace";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { currentUserId, findUser } from "@/session";

export default async function Landing() {
  const me = await findUser(await currentUserId());
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-muted/30 p-6">
      <div className="mb-8 flex items-center gap-2 text-2xl font-semibold tracking-tight">
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Waves className="size-5" /></span>
        Parley
      </div>
      <p className="mb-8 max-w-md text-center text-muted-foreground">AI meeting notes: record, summarize, search and share your calls.</p>
      <div className="grid w-full max-w-3xl gap-4 md:grid-cols-2">
        <Card className="gap-4 p-6">
          <Database className="size-6 text-primary" />
          <div>
            <h2 className="text-lg font-semibold">Enter Reviewer Demo Workspace</h2>
            <p className="mt-1 text-sm text-muted-foreground">Sign in as Maya Chen, VP of Product: 20 recorded meetings including an 8-person hour-long alignment call, AI notes, action items, clips and a busy calendar.</p>
          </div>
          <form action={enterDemo} className="mt-auto"><Button className="w-full">Enter demo workspace<ArrowRight /></Button></form>
        </Card>
        <Card className="gap-4 p-6">
          <Mic className="size-6 text-primary" />
          <div>
            <h2 className="text-lg font-semibold">Start a Live New Meeting</h2>
            <p className="mt-1 text-sm text-muted-foreground">A fresh, empty workspace. Record a real conversation from your microphone, connect a (simulated) calendar, and watch notes build from scratch.</p>
          </div>
          <form action={startFresh} className="mt-auto flex gap-2">
            <Input name="name" placeholder="Your name" maxLength={60} className="flex-1" />
            <Button variant="outline">Start fresh<ArrowRight /></Button>
          </form>
        </Card>
      </div>
      {me && <Link href="/home" className="mt-6 text-sm text-primary hover:underline">Continue as {me.name} →</Link>}
    </div>
  );
}
