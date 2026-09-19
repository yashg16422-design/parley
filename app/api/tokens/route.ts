import { z } from "zod";
import { createToken, revokeToken } from "@/auth";
import { badRequest, jsonError } from "@/http";
import { currentUserId, findUser } from "@/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const body = z.object({ name: z.string().trim().min(1).max(60), scopes: z.array(z.enum(["ingest", "calendar", "read"])).min(1) });

/** Mint a personal access token (shown once). Browser session only: a token can't mint more tokens. */
export async function POST(req: Request) {
  const me = await findUser(await currentUserId());
  if (!me) return jsonError(401, "no workspace session");
  if (me.kind === "guest") return jsonError(403, "sign up to create access tokens");
  const b = body.safeParse(await req.json().catch(() => null));
  if (!b.success) return badRequest(b.error);
  return Response.json(await createToken(me.id, b.data.name, b.data.scopes), { status: 201, headers: { "cache-control": "no-store" } });
}

export async function DELETE(req: Request) {
  const me = await findUser(await currentUserId());
  if (!me) return jsonError(401, "no workspace session");
  const id = z.uuid().safeParse(new URL(req.url).searchParams.get("id"));
  if (!id.success) return badRequest(id.error);
  await revokeToken(me.id, id.data);
  return new Response(null, { status: 204 });
}
