"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createToken, revokeToken } from "@/auth";
import { connectIcs, disconnectIcs, FeedError, syncIcs } from "@/calendar/ics";
import { getDb } from "@/db";
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
  return done("Key verified and saved. Your meetings now use it.");
}

export async function removeProviderKey(f: FormData) {
  const me = await currentUser();
  await deleteKey(getDb(), me.id, kind.parse(f.get("kind")));
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
  const scopes = z.array(z.enum(["ingest", "calendar"])).min(1).safeParse(f.getAll("scopes"));
  if (!scopes.success) return { error: "Pick at least one scope." };
  const { token } = await createToken(me.id, String(f.get("name") || "Capture extension").slice(0, 60), scopes.data);
  return done("Copy this token now; it won't be shown again.", { token });
}

export async function revoke(f: FormData) {
  const me = await currentUser();
  await revokeToken(me.id, z.uuid().parse(f.get("id")));
  revalidatePath("/settings");
}
