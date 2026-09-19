import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed session cookie: "<userId>.<hmac>". The id alone is not a credential,
 * since user ids appear in URLs and payloads; only the server can mint the signature.
 */
function key() {
  const secret = process.env.PARLEY_SECRET_KEY;
  if (secret && secret.length >= 32) return `session:${secret}`;
  if (process.env.NODE_ENV === "production") throw new Error("PARLEY_SECRET_KEY must be set (32+ chars) to sign sessions");
  return "session:parley-dev-only-secret-not-for-production";
}

const mac = (uid: string) => createHmac("sha256", key()).update(uid).digest("base64url");

export const signSession = (uid: string) => `${uid}.${mac(uid)}`;

export function readSession(value: string | undefined | null) {
  const m = value?.match(/^([0-9a-f-]{36})\.([\w-]{43})$/);
  if (!m) return null;
  const [want, got] = [Buffer.from(mac(m[1]!)), Buffer.from(m[2]!)];
  return want.length === got.length && timingSafeEqual(want, got) ? m[1]! : null;
}
