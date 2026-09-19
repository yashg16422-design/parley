import { apiUser } from "@/api-guard";
import { apiMeetings } from "@/public-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/meetings?limit=25: your meetings, newest first. */
export async function GET(req: Request) {
  const a = await apiUser(req);
  if ("error" in a) return a.error;
  return Response.json({ meetings: await apiMeetings(a.me.id, Number(new URL(req.url).searchParams.get("limit") ?? 25) || 25) });
}
