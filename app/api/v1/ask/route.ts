import { z } from "zod";
import { apiUser } from "@/api-guard";
import { badRequest, jsonError } from "@/http";
import { apiAsk } from "@/public-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST /api/v1/ask {question}: a cited answer across your meetings. */
export async function POST(req: Request) {
  const a = await apiUser(req);
  if ("error" in a) return a.error;
  const b = z.object({ question: z.string().trim().min(3).max(500) }).safeParse(await req.json().catch(() => null));
  if (!b.success) return badRequest(b.error);
  try {
    return Response.json(await apiAsk(a.me.id, b.data.question));
  } catch {
    return jsonError(502, "the AI models couldn't answer right now");
  }
}
