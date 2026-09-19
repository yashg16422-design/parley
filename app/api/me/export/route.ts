import { eq, inArray } from "drizzle-orm";
import { audit } from "@/audit";
import { requestUser } from "@/auth";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { jsonError } from "@/http";
import { clientIp } from "@/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * "Download my data": everything this user owns, as one JSON file. Secrets are
 * listed by kind only (never their values); tokens by name and prefix.
 * Audio stays downloadable per meeting at /api/recordings/:id.
 */
export async function GET(req: Request) {
  const me = await requestUser(req, "read");
  if (!me) return jsonError(401, "no workspace session");
  const db = getDb();
  const owned = db.select({ id: s.meetings.id }).from(s.meetings).where(eq(s.meetings.ownerId, me.id));
  const [meetings, calendar, scratchpads, secrets, tokens, activity] = await Promise.all([
    db.query.meetings.findMany({
      where: eq(s.meetings.ownerId, me.id),
      with: { participants: true, segments: { orderBy: (t, { asc }) => asc(t.seq) }, summaries: true, actionItems: true, highlights: true, clips: true, knowledge: true },
    }),
    db.query.calendarEvents.findMany({ where: eq(s.calendarEvents.userId, me.id) }),
    db.query.scratchpads.findMany({ where: eq(s.scratchpads.userId, me.id) }),
    db.query.userSecrets.findMany({ where: eq(s.userSecrets.userId, me.id), columns: { kind: true, last4: true, updatedAt: true } }),
    db.query.apiTokens.findMany({ where: eq(s.apiTokens.userId, me.id), columns: { name: true, prefix: true, scopes: true, createdAt: true, revokedAt: true } }),
    db.query.auditEvents.findMany({ where: eq(s.auditEvents.userId, me.id) }),
  ]);
  const recordings = meetings.length
    ? await db.selectDistinct({ meetingId: s.recordingChunks.meetingId }).from(s.recordingChunks).where(inArray(s.recordingChunks.meetingId, owned))
    : [];
  const { email, name, kind, createdAt, retentionDays } = me;
  await audit(db, me.id, "data.exported", null, { meetings: meetings.length }, clientIp(req.headers));
  const body = JSON.stringify({
    exportedAt: new Date(), account: { email, name, kind, createdAt, retentionDays }, meetings,
    recordings: recordings.map((r) => `/api/recordings/${r.meetingId}`), calendar, scratchpads,
    connectedSecrets: secrets, accessTokens: tokens, activity,
  }, null, 2);
  return new Response(body, { headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="parley-export-${new Date().toISOString().slice(0, 10)}.json"`, "cache-control": "no-store" } });
}
