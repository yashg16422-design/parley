import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { requestUser } from "@/auth";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { jsonError } from "@/http";
import { visibleMeeting } from "@/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ meetingId: string }> };
const MAX_CHUNK = 2 * 1024 * 1024;
const MAX_TOTAL = 150 * 1024 * 1024;
const upload = z.object({ idx: z.coerce.number().int().min(0).max(20_000), startMs: z.coerce.number().int().min(0) });

/** Append one recorded chunk (owner only). Idempotent per idx, so the recorder can retry freely. */
export async function POST(req: Request, { params }: Ctx) {
  const meetingId = z.uuid().safeParse((await params).meetingId);
  const q = upload.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  const mime = req.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
  if (!meetingId.success || !q.success || !/^audio\/(webm|ogg|mp4)$/.test(mime)) return jsonError(400, "expected ?idx&startMs and an audio/webm|ogg|mp4 body");
  const me = await requestUser(req, "ingest");
  if (!me) return jsonError(401, "no workspace session or valid ingest token");
  const db = getDb();
  const m = await db.query.meetings.findFirst({ where: eq(s.meetings.id, meetingId.data), columns: { ownerId: true } });
  if (!m || m.ownerId !== me.id) return jsonError(404, "meeting not found");
  if (Number(req.headers.get("content-length") ?? 0) > MAX_CHUNK) return jsonError(413, "chunk too large");
  const data = Buffer.from(await req.arrayBuffer());
  if (!data.length || data.length > MAX_CHUNK) return jsonError(data.length ? 413 : 400, "chunk must be 1 byte to 2 MB");
  const [{ total }] = (await db.select({ total: sql<number>`coalesce(sum(octet_length(${s.recordingChunks.data})), 0)::bigint` }).from(s.recordingChunks).where(eq(s.recordingChunks.meetingId, meetingId.data))) as [{ total: number }];
  if (Number(total) + data.length > MAX_TOTAL) return jsonError(413, "recording is over the 150 MB limit");
  await db.insert(s.recordingChunks).values({ meetingId: meetingId.data, idx: q.data.idx, startMs: q.data.startMs, mime, data }).onConflictDoNothing();
  return Response.json({ stored: q.data.idx });
}

/** Stream the recording to anyone who can see the meeting, with Range support for seeking. */
export async function GET(req: Request, { params }: Ctx) {
  const meetingId = z.uuid().safeParse((await params).meetingId);
  if (!meetingId.success) return jsonError(400, "bad meeting id");
  const me = await requestUser(req, "ingest");
  if (!me) return jsonError(401, "no workspace session");
  if (!(await visibleMeeting(meetingId.data, me.id))) return jsonError(404, "meeting not found");
  const chunks = await getDb().select({ data: s.recordingChunks.data, mime: s.recordingChunks.mime }).from(s.recordingChunks)
    .where(and(eq(s.recordingChunks.meetingId, meetingId.data))).orderBy(asc(s.recordingChunks.idx));
  if (!chunks.length) return jsonError(404, "no recording for this meeting");
  const body = Buffer.concat(chunks.map((c) => c.data));
  const headers = { "content-type": chunks[0]!.mime, "accept-ranges": "bytes", "cache-control": "private, max-age=300" };
  const range = req.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  if (!range) return new Response(body, { headers: { ...headers, "content-length": String(body.length) } });
  const start = range[1] ? Number(range[1]) : Math.max(0, body.length - Number(range[2]));
  const end = range[1] && range[2] ? Math.min(Number(range[2]), body.length - 1) : body.length - 1;
  if (start > end || start >= body.length) return new Response(null, { status: 416, headers: { "content-range": `bytes */${body.length}` } });
  return new Response(body.subarray(start, end + 1), { status: 206, headers: { ...headers, "content-range": `bytes ${start}-${end}/${body.length}`, "content-length": String(end - start + 1) } });
}
