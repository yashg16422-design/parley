import { z } from "zod";
import { apiUser, notFound } from "@/api-guard";
import { apiMeeting } from "@/public-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/meetings/:id?transcript=1: summary, action items, highlights, clips (and the transcript). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await apiUser(req);
  if ("error" in a) return a.error;
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return notFound();
  const m = await apiMeeting(a.me.id, id.data, { transcript: new URL(req.url).searchParams.get("transcript") === "1" });
  return m ? Response.json(m) : notFound();
}
