import { createHash } from "node:crypto";

/**
 * Deterministic UUID (v5-style, SHA-1 over a fixed namespace) from a string key.
 * Seeding with stable ids means every re-seed, on every environment, yields the
 * same meeting/clip URLs - demo links never break.
 */
const NAMESPACE = "fathom-clone:v1:";

export function stableId(key: string): string {
  const h = createHash("sha1").update(NAMESPACE + key).digest();
  h[6] = (h[6]! & 0x0f) | 0x50; // version 5
  h[8] = (h[8]! & 0x3f) | 0x80; // RFC 4122 variant
  const hex = h.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
