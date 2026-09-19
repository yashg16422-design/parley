import "server-only";
import { requestUser } from "./auth";
import { getDb } from "./db";
import { jsonError } from "./http";
import { takeToken } from "./rate-limit";

/** Public API / MCP caller: a token with the `read` scope (or a browser session), 300 requests per 5 minutes. */
export async function apiUser(req: Request) {
  const me = await requestUser(req, "read");
  if (!me) return { error: new Response(JSON.stringify({ error: "send Authorization: Bearer <token with the read scope>" }), { status: 401, headers: { "content-type": "application/json", "www-authenticate": 'Bearer realm="parley"' } }) };
  const limit = await takeToken(getDb(), `api:user:${me.id}`, 300, 5 * 60_000);
  if (!limit.ok) return { error: Response.json({ error: "rate limited" }, { status: 429, headers: { "retry-after": String(limit.retryAfterSec) } }) };
  return { me };
}

export const notFound = () => jsonError(404, "not found");
