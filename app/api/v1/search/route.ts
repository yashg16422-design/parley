import { apiUser } from "@/api-guard";
import { jsonError } from "@/http";
import { apiSearch } from "@/public-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/search?q=…: every moment it was said (synonym-aware), plus calendar matches. */
export async function GET(req: Request) {
  const a = await apiUser(req);
  if ("error" in a) return a.error;
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2 || q.length > 200) return jsonError(400, "q must be 2-200 characters");
  return Response.json(await apiSearch(a.me.id, q));
}
