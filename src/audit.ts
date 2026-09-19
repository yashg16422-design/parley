import { desc, eq } from "drizzle-orm";
import type { Database } from "./db";
import * as s from "./db/schema";

/** Record a security-relevant action. Never throws: auditing must not break the action itself. */
export async function audit(db: Database, userId: string | null, action: string, target?: string | null, meta?: Record<string, unknown>, ip?: string | null) {
  await db.insert(s.auditEvents).values({ userId, action, target: target ?? null, meta: meta ?? null, ip: ip ?? null }).catch((e) => console.error("audit:", e));
}

export const recentAudit = (db: Database, userId: string, limit = 50) =>
  db.query.auditEvents.findMany({ where: eq(s.auditEvents.userId, userId), orderBy: desc(s.auditEvents.createdAt), limit });
