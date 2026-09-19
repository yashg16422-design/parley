import { z } from "zod";
import { ask } from "@/ai/ask";
import { llmForUser } from "@/ai/providers";
import { requestUser } from "@/auth";
import { getDb } from "@/db";
import { badRequest, jsonError } from "@/http";
import { takeToken } from "@/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const body = z.object({ question: z.string().trim().min(3).max(500) });

/** Ask Parley: a cited answer across every meeting the caller can see. */
export async function POST(req: Request) {
  const me = await requestUser(req, "ingest");
  if (!me) return jsonError(401, "no workspace session or valid token");
  const b = body.safeParse(await req.json().catch(() => null));
  if (!b.success) return badRequest(b.error);
  const db = getDb();
  const limit = await takeToken(db, `ask:user:${me.id}`, 30, 10 * 60_000);
  if (!limit.ok) return Response.json({ error: `too many questions; try again in ${limit.retryAfterSec}s` }, { status: 429, headers: { "retry-after": String(limit.retryAfterSec) } });
  try {
    return Response.json(await ask(db, me.id, b.data.question, await llmForUser(db, me.id)));
  } catch (e) {
    console.error("ask:", e);
    return jsonError(502, "the AI models couldn't answer right now; try again");
  }
}
