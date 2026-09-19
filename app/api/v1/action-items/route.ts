import { apiUser } from "@/api-guard";
import { apiActionItems } from "@/public-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/action-items?status=open|done */
export async function GET(req: Request) {
  const a = await apiUser(req);
  if ("error" in a) return a.error;
  const status = new URL(req.url).searchParams.get("status");
  return Response.json({ actionItems: await apiActionItems(a.me.id, status === "open" || status === "done" ? status : undefined) });
}
