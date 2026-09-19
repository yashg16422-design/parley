"use client";

import { useActionState } from "react";
import { connectFeed, type FormState, newToken, saveProviderKey } from "@app/actions/settings";
import { InlineDots } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const Status = ({ s }: { s: FormState }) =>
  s.error ? <p className="text-sm text-destructive">{s.error}</p> : s.ok ? <p className="text-sm text-emerald-600">{s.ok}</p> : null;

export function KeyForm({ kind, placeholder }: { kind: "deepgram" | "huggingface"; placeholder: string }) {
  const [state, action, pending] = useActionState(saveProviderKey, {});
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="kind" value={kind} />
      <div className="flex gap-2">
        <Input name="key" type="password" autoComplete="off" placeholder={placeholder} className="flex-1" />
        <Button disabled={pending}>{pending ? <InlineDots /> : "Verify & save"}</Button>
      </div>
      <Status s={state} />
    </form>
  );
}

export function FeedForm({ connected }: { connected: boolean }) {
  const [state, action, pending] = useActionState(connectFeed, {});
  return (
    <form action={action} className="space-y-2">
      <div className="flex gap-2">
        <Input name="url" type="password" autoComplete="off" placeholder={connected ? "Paste a new address to replace it (optional)" : "https://calendar.google.com/calendar/ical/…/private-…/basic.ics"} className="flex-1" />
        <Button disabled={pending}>{pending ? <InlineDots /> : connected ? "Sync now" : "Connect"}</Button>
      </div>
      <Status s={state} />
    </form>
  );
}

export function TokenForm() {
  const [state, action, pending] = useActionState(newToken, {});
  return (
    <form action={action} className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <Input name="name" placeholder="Token name, e.g. Chrome extension" maxLength={60} className="max-w-xs" />
        {(["ingest", "calendar"] as const).map((s) => (
          <label key={s} className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="scopes" value={s} defaultChecked={s === "ingest"} className="accent-primary" />{s}</label>
        ))}
        <Button disabled={pending} variant="outline">{pending ? <InlineDots /> : "Create token"}</Button>
      </div>
      <Status s={state} />
      {state.token && <code className="block break-all rounded-md bg-muted p-2 text-xs select-all">{state.token}</code>}
    </form>
  );
}
