"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createToken, revokeToken } from "@/auth";
import { connectIcs, disconnectIcs, FeedError, syncIcs } from "@/calendar/ics";
import { audit } from "@/audit";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { hubspotCheck, notionDatabaseId, notionTitleProp } from "@/notify/integrations";
import { slackWebhook } from "@/notify/slack";
import { checkKey, deleteKey, saveKey } from "@/keys";
import { currentUser } from "@/queries";
import { vaultReady } from "@/vault";

export type FormState = { ok?: string; error?: string; token?: string };
const kind = z.enum(["deepgram", "huggingface", "anthropic", "openai"]);
const done = (ok: string, extra: Partial<FormState> = {}): FormState => (revalidatePath("/settings"), { ok, ...extra });
const NO_VAULT = { error: "This server has no PARLEY_SECRET_KEY, so it can't store secrets." };
const GUEST = { error: "Sign up with Google to save keys, calendars and tokens. Try-now workspaces are deleted after 24 hours." };

export async function saveProviderKey(_: FormState, f: FormData): Promise<FormState> {
  const me = await currentUser();
  if (me.kind === "guest") return GUEST;
  if (!vaultReady()) return NO_VAULT;
  const k = kind.parse(f.get("kind"));
  const key = String(f.get("key") ?? "").trim();
  if (key.length < 20) return { error: "That doesn't look like a full key." };
  const bad = await checkKey(k, key);
  if (bad) return { error: bad };
  await saveKey(getDb(), me.id, k, key);
  await audit(getDb(), me.id, "key.saved", k, { last4: key.slice(-4) });
  return done("Key verified and saved. Your meetings now use it.");
}

export async function removeProviderKey(f: FormData) {
  const me = await currentUser();
  const k = kind.parse(f.get("kind"));
  await deleteKey(getDb(), me.id, k);
  await audit(getDb(), me.id, "key.removed", k);
  revalidatePath("/settings");
}

export async function connectFeed(_: FormState, f: FormData): Promise<FormState> {
  const me = await currentUser();
  if (me.kind === "guest") return GUEST;
  if (!vaultReady()) return NO_VAULT;
  try {
    const url = String(f.get("url") ?? "");
    const r = url ? await connectIcs(getDb(), me.id, url) : await syncIcs(getDb(), me.id);
    revalidatePath("/", "layout");
    return done(`Synced ${r.synced} video-call event(s)${r.skippedNoLink ? `, skipped ${r.skippedNoLink} without a meeting link` : ""}.`);
  } catch (e) {
    return { error: e instanceof FeedError ? e.message : "Couldn't sync the calendar feed." };
  }
}

export async function disconnectFeed() {
  const me = await currentUser();
  await disconnectIcs(getDb(), me.id);
  revalidatePath("/", "layout");
}

export async function newToken(_: FormState, f: FormData): Promise<FormState> {
  const me = await currentUser();
  if (me.kind === "guest") return GUEST;
  const scopes = z.array(z.enum(["ingest", "calendar", "read"])).min(1).safeParse(f.getAll("scopes"));
  if (!scopes.success) return { error: "Pick at least one scope." };
  const { token } = await createToken(me.id, String(f.get("name") || "Capture extension").slice(0, 60), scopes.data);
  await audit(getDb(), me.id, "token.created", token.slice(0, 15), { scopes: scopes.data });
  return done("Copy this token now; it won't be shown again.", { token });
}

export async function revoke(f: FormData) {
  const me = await currentUser();
  await revokeToken(me.id, z.uuid().parse(f.get("id")));
  await audit(getDb(), me.id, "token.revoked", String(f.get("id")));
  revalidatePath("/settings");
}

// ---------------------------------------------------------------- integrations

const integration = z.enum(["slack", "notion", "hubspot"]);

/** Connect Slack (webhook), Notion (token + database) or HubSpot (private app token). Each is checked live before saving. */
export async function saveIntegration(_: FormState, f: FormData): Promise<FormState> {
  const me = await currentUser();
  if (me.kind === "guest") return GUEST;
  if (!vaultReady()) return NO_VAULT;
  const k = integration.parse(f.get("kind"));
  const field = (n: string) => String(f.get(n) ?? "").trim();
  let value: string;
  try {
    if (k === "slack") {
      const url = slackWebhook(field("url"));
      if (!url) return { error: "Paste a Slack incoming-webhook URL (https://hooks.slack.com/services/…)." };
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "✅ Parley is connected. Meeting briefings will post here when notes are ready." }) });
      if (!r.ok) return { error: `Slack refused the webhook (${r.status}).` };
      value = url;
    } else if (k === "notion") {
      const databaseId = notionDatabaseId(field("database"));
      if (!databaseId) return { error: "Paste the Notion database link or id." };
      await notionTitleProp({ token: field("token"), databaseId });
      value = JSON.stringify({ token: field("token"), databaseId });
    } else {
      await hubspotCheck(field("token"));
      value = field("token");
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't verify that connection." };
  }
  await saveKey(getDb(), me.id, k, value);
  await audit(getDb(), me.id, "integration.connected", k);
  return done(k === "slack" ? "Connected. A test message was posted to the channel." : "Connected. New meetings will be sent here when their notes are ready.");
}

export async function removeIntegration(f: FormData) {
  const me = await currentUser();
  const k = integration.parse(f.get("kind"));
  await deleteKey(getDb(), me.id, k);
  await audit(getDb(), me.id, "integration.removed", k);
  revalidatePath("/settings");
}

// ---------------------------------------------------------------- your data

export async function setRetention(f: FormData) {
  const me = await currentUser();
  const days = z.enum(["forever", "30", "90", "365"]).parse(f.get("days"));
  await getDb().update(s.users).set({ retentionDays: days === "forever" ? null : Number(days) }).where(eq(s.users.id, me.id));
  await audit(getDb(), me.id, "retention.changed", days);
  revalidatePath("/settings");
}

/** Permanently delete the signed-in user and everything they own. The shared demo can't be deleted. */
export async function deleteAccount(_: FormState, f: FormData): Promise<FormState> {
  const me = await currentUser();
  if (me.kind === "demo") return { error: "The shared demo workspace can't be deleted." };
  if (String(f.get("confirm") ?? "").trim() !== "DELETE") return { error: "Type DELETE to confirm." };
  const db = getDb();
  await audit(db, me.id, "account.deleted", me.email);
  await db.delete(s.users).where(eq(s.users.id, me.id));
  (await cookies()).delete("parley_uid");
  redirect("/?deleted=1");
}
