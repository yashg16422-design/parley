import { and, eq } from "drizzle-orm";
import type { Database } from "./db";
import * as s from "./db/schema";
import { open, seal } from "./vault";

export type SecretKind = (typeof s.secretKind.enumValues)[number];
const ENV: Record<SecretKind, string> = { deepgram: "DEEPGRAM_API_KEY", huggingface: "HF_TOKEN" };

/**
 * BYOK resolution: the tenant's own key wins, then the server's env key, else
 * none. Callers pass the user whose usage it is (for AI jobs, the meeting owner).
 */
export async function resolveKey(db: Database, userId: string | null | undefined, kind: SecretKind) {
  if (userId) {
    const row = await db.query.userSecrets.findFirst({ where: and(eq(s.userSecrets.userId, userId), eq(s.userSecrets.kind, kind)) });
    if (row) return { key: open(row.ciphertext), source: "tenant" as const };
  }
  const env = process.env[ENV[kind]];
  return env ? { key: env, source: "env" as const } : null;
}

export async function saveKey(db: Database, userId: string, kind: SecretKind, key: string) {
  const row = { userId, kind, ciphertext: seal(key), last4: key.slice(-4) };
  await db.insert(s.userSecrets).values(row).onConflictDoUpdate({ target: [s.userSecrets.userId, s.userSecrets.kind], set: { ciphertext: row.ciphertext, last4: row.last4, updatedAt: new Date() } });
}

export async function deleteKey(db: Database, userId: string, kind: SecretKind) {
  await db.delete(s.userSecrets).where(and(eq(s.userSecrets.userId, userId), eq(s.userSecrets.kind, kind)));
}

/** Live check before saving, so a bad key fails in settings, not mid-meeting. */
export async function checkKey(kind: SecretKind, key: string): Promise<string | null> {
  const r = kind === "deepgram"
    ? await fetch("https://api.deepgram.com/v1/auth/grant", { method: "POST", headers: { authorization: `Token ${key}`, "content-type": "application/json" }, body: JSON.stringify({ ttl_seconds: 30 }) }).catch(() => null)
    : await fetch("https://huggingface.co/api/whoami-v2", { headers: { authorization: `Bearer ${key}` } }).catch(() => null);
  if (!r) return "couldn't reach the provider";
  if (r.ok) return null;
  if (kind === "deepgram" && r.status === 403) return "Deepgram accepted the key but it can't issue browser tokens; create a key with the Member role";
  return `the provider rejected this key (HTTP ${r.status})`;
}
