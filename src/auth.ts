import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "./db";
import * as s from "./db/schema";
import { currentUserId, findUser } from "./session";

export type Scope = "ingest" | "calendar" | "read";
const PREFIX = "parley_pat_";
const hash = (t: string) => createHash("sha256").update(t).digest("hex");

/** Mint a personal access token. The plaintext is returned once and never stored. */
export async function createToken(userId: string, name: string, scopes: Scope[]) {
  const token = PREFIX + randomBytes(24).toString("base64url");
  const [row] = await getDb().insert(s.apiTokens).values({ userId, name, scopes, tokenHash: hash(token), prefix: token.slice(0, PREFIX.length + 4) }).returning({ id: s.apiTokens.id });
  return { id: row!.id, token };
}

export async function revokeToken(userId: string, id: string) {
  await getDb().update(s.apiTokens).set({ revokedAt: new Date() }).where(and(eq(s.apiTokens.id, id), eq(s.apiTokens.userId, userId)));
}

/**
 * Who is calling: `Authorization: Bearer parley_pat_…` (scripts, the capture
 * extension) or the browser session cookie. Tokens must carry `scope`.
 */
export async function requestUser(req: Request, scope: Scope) {
  const bearer = req.headers.get("authorization")?.match(/^Bearer (parley_pat_[\w-]+)$/)?.[1];
  if (!bearer) return findUser(await currentUserId());
  const db = getDb();
  const t = await db.query.apiTokens.findFirst({ where: and(eq(s.apiTokens.tokenHash, hash(bearer)), isNull(s.apiTokens.revokedAt)) });
  if (!t || !t.scopes.includes(scope)) return undefined;
  await db.update(s.apiTokens).set({ lastUsedAt: new Date() }).where(eq(s.apiTokens.id, t.id));
  return db.query.users.findFirst({ where: eq(s.users.id, t.userId) });
}
