import { jsonError } from "@/http";
import { requestUser } from "@/auth";
import { getDb } from "@/db";
import { resolveKey } from "@/keys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Trades the server's Deepgram key for a short-lived JWT the browser uses to open
 * its own WebSocket to Deepgram. The key never leaves the server, and audio never
 * passes through it.
 */
export async function POST(req: Request) {
  const me = await requestUser(req, "ingest");
  if (!me) return jsonError(401, "no workspace session or valid ingest token");
  // BYOK: the user's own Deepgram key if they saved one, else the server's.
  const key = (await resolveKey(getDb(), me.id, "deepgram"))?.key;
  if (!key) return jsonError(503, "live transcription isn't configured (add your Deepgram key in Settings, or set DEEPGRAM_API_KEY)");
  const r = await fetch("https://api.deepgram.com/v1/auth/grant", {
    method: "POST",
    headers: { authorization: `Token ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ ttl_seconds: 60 }),
    cache: "no-store",
  }).catch(() => null);
  if (!r?.ok) {
    console.error(`deepgram grant: ${r ? `${r.status} ${await r.text()}` : "network error"}`);
    return jsonError(502, "couldn't get a transcription token from Deepgram");
  }
  const { access_token, expires_in } = (await r.json()) as { access_token: string; expires_in: number };
  return Response.json({ accessToken: access_token, expiresIn: expires_in }, { headers: { "cache-control": "no-store" } });
}
