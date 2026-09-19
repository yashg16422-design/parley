import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { requestUser } from "@/auth";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { jsonError } from "@/http";
import { visibleMeeting } from "@/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function who(req: Request, { params }: Ctx) {
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return { error: jsonError(400, "bad meeting id") };
  const me = await requestUser(req, "ingest");
  if (!me) return { error: jsonError(401, "no workspace session") };
  if (!(await visibleMeeting(id.data, me.id))) return { error: jsonError(404, "meeting not found") };
  return { meetingId: id.data, userId: me.id };
}

/** Your private scratchpad for a meeting. Only you can read it. */
export async function GET(req: Request, ctx: Ctx) {
  const w = await who(req, ctx);
  if ("error" in w) return w.error;
  const row = await getDb().query.scratchpads.findFirst({ where: and(eq(s.scratchpads.meetingId, w.meetingId), eq(s.scratchpads.userId, w.userId)) });
  return Response.json({ body: row?.body ?? "", updatedAt: row?.updatedAt ?? null }, { headers: { "cache-control": "no-store" } });
}

export async function PUT(req: Request, ctx: Ctx) {
  const w = await who(req, ctx);
  if ("error" in w) return w.error;
  const b = z.object({ body: z.string().max(20_000) }).safeParse(await req.json().catch(() => null));
  if (!b.success) return jsonError(400, "body must be text up to 20,000 characters");
  const [row] = await getDb().insert(s.scratchpads).values({ ...w, body: b.data.body })
    .onConflictDoUpdate({ target: [s.scratchpads.meetingId, s.scratchpads.userId], set: { body: b.data.body, updatedAt: new Date() } })
    .returning({ updatedAt: s.scratchpads.updatedAt });
  return Response.json({ updatedAt: row!.updatedAt });
}
