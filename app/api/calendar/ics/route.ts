import { z } from "zod";
import { requestUser } from "@/auth";
import { connectIcs, disconnectIcs, FeedError, syncIcs } from "@/calendar/ics";
import { getDb } from "@/db";
import { badRequest, errorResponse, jsonError } from "@/http";
import { vaultReady } from "@/vault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const body = z.object({ url: z.string().trim().min(1).max(2000).optional() });

/**
 * iCal (no-OAuth) calendar: POST {url} connects a secret iCal address and syncs;
 * POST {} re-syncs. Session cookie or a token with the `calendar` scope, so a
 * user's own cron script can trigger syncs.
 */
export async function POST(req: Request) {
  const me = await requestUser(req, "calendar");
  if (!me) return jsonError(401, "no workspace session or valid calendar token");
  if (!vaultReady()) return jsonError(503, "server has no PARLEY_SECRET_KEY, so it can't store feed addresses");
  const b = body.safeParse(await req.json().catch(() => ({})));
  if (!b.success) return badRequest(b.error);
  try {
    return Response.json(b.data.url ? await connectIcs(getDb(), me.id, b.data.url) : await syncIcs(getDb(), me.id));
  } catch (e) {
    return e instanceof FeedError ? jsonError(e.status, e.message) : errorResponse(e);
  }
}

export async function DELETE(req: Request) {
  const me = await requestUser(req, "calendar");
  if (!me) return jsonError(401, "no workspace session or valid calendar token");
  await disconnectIcs(getDb(), me.id);
  return new Response(null, { status: 204 });
}
