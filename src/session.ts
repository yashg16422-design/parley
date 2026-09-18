import "server-only";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "./db";
import * as s from "./db/schema";

/** Demo-grade session: which workspace user this browser is. Not authentication. */
export const UID_COOKIE = "parley_uid";

export async function currentUserId() {
  return (await cookies()).get(UID_COOKIE)?.value ?? null;
}

export async function findUser(id: string | null) {
  return id && /^[0-9a-f-]{36}$/.test(id) ? getDb().query.users.findFirst({ where: eq(s.users.id, id) }) : undefined;
}

/** For pages: the signed-in workspace user, or back to the landing page. */
export async function currentUser() {
  const u = await findUser(await currentUserId());
  if (!u) redirect("/");
  return u;
}

export async function setSession(userId: string) {
  (await cookies()).set(UID_COOKIE, userId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
}
