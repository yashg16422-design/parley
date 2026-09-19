import "server-only";
import { eq } from "drizzle-orm";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "./db";
import * as s from "./db/schema";
import { readSession, signSession } from "./session-token";

/** Which workspace user this browser is: a signed cookie set by the demo, Try now or Google sign-in. */
export const UID_COOKIE = "parley_uid";

export async function currentUserId() {
  return readSession((await cookies()).get(UID_COOKIE)?.value);
}

type User = typeof s.users.$inferSelect;
const g = globalThis as { __parleyUsers?: Map<string, { user: User; at: number }> };
const known = (g.__parleyUsers ??= new Map());
const USER_TTL_MS = 5 * 60_000;

/**
 * The workspace user for a session id. Every page and layout asks, so the row is
 * memoised per request (React cache) and per server instance for 5 minutes:
 * user rows don't change after creation, and each database round trip is
 * expensive when the database is far away.
 */
export const findUser = cache(async (id: string | null) => {
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) return undefined;
  const hit = known.get(id);
  if (hit && Date.now() - hit.at < USER_TTL_MS) return hit.user;
  const user = await getDb().query.users.findFirst({ where: eq(s.users.id, id) });
  if (user) known.set(id, { user, at: Date.now() });
  return user;
});

/** For pages: the signed-in workspace user, or back to the landing page. */
export async function currentUser() {
  const u = await findUser(await currentUserId());
  if (!u) redirect("/");
  return u;
}

export async function setSession(userId: string) {
  (await cookies()).set(UID_COOKIE, signSession(userId), { httpOnly: true, secure: process.env.NODE_ENV === "production" && !process.env.PARLEY_INSECURE_COOKIES, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
}
