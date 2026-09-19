import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * AES-256-GCM for tenant secrets (provider keys, iCal feed addresses).
 * Format: v1.<iv>.<tag>.<ciphertext>, base64url. The key comes from
 * PARLEY_SECRET_KEY (any string of 32+ chars, hashed to 32 bytes); GCM's tag
 * makes tampering or a wrong key fail loudly instead of returning garbage.
 */
function masterKey(secret = process.env.PARLEY_SECRET_KEY) {
  if (!secret || secret.length < 32) throw new Error("PARLEY_SECRET_KEY must be set (32+ chars) to store tenant secrets");
  return createHash("sha256").update(secret).digest();
}

export const vaultReady = () => (process.env.PARLEY_SECRET_KEY?.length ?? 0) >= 32;

export function seal(plain: string, secret?: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", masterKey(secret), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv, c.getAuthTag(), ct].map((x) => (typeof x === "string" ? x : x.toString("base64url"))).join(".");
}

export function open(sealed: string, secret?: string) {
  const [v, iv, tag, ct] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("unrecognised secret format");
  const d = createDecipheriv("aes-256-gcm", masterKey(secret), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8");
}
