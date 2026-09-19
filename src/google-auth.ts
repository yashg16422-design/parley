import { createHash, randomBytes } from "node:crypto";
import { and, eq, ne, sql } from "drizzle-orm";
import type { Database } from "./db";
import * as s from "./db/schema";

/**
 * "Sign in with Google" (OAuth 2.0 authorization code + PKCE). Only the basic
 * `openid email profile` scopes, which Google does not require app
 * verification for. We never see a password and store no Google tokens:
 * just the stable account id (sub), email, name and photo.
 */
export const GOOGLE_SCOPES = "openid email profile";
export const googleConfigured = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

const b64url = (b: Buffer) => b.toString("base64url");

export function startGoogleAuth(redirectUri: string) {
  const state = b64url(randomBytes(24));
  const verifier = b64url(randomBytes(48));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!, redirect_uri: redirectUri, response_type: "code", scope: GOOGLE_SCOPES,
    state, code_challenge: challenge, code_challenge_method: "S256", prompt: "select_account",
  }).toString();
  return { url: url.href, state, verifier };
}

export type GoogleProfile = { sub: string; email: string; email_verified: boolean; name?: string; picture?: string };

export async function finishGoogleAuth(code: string, verifier: string, redirectUri: string): Promise<GoogleProfile> {
  const tok = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, code_verifier: verifier, redirect_uri: redirectUri, grant_type: "authorization_code", client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET! }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!tok.ok) throw new Error(`Google token exchange failed (${tok.status})`);
  const { access_token } = (await tok.json()) as { access_token: string };
  // The userinfo endpoint is authenticated by Google itself, so no ID-token signature checking is needed here.
  const r = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { authorization: `Bearer ${access_token}` }, signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error(`Google userinfo failed (${r.status})`);
  return (await r.json()) as GoogleProfile;
}

/**
 * Account for a Google profile. Signing in from a "Try now" workspace keeps its
 * recordings: the guest becomes the account, or its meetings move into the
 * existing account and the empty guest is removed.
 */
export async function upsertGoogleUser(db: Database, p: GoogleProfile, currentUserId: string | null) {
  if (!p.email_verified) throw new Error("Google hasn't verified this email address");
  const email = p.email.toLowerCase();
  const profile = { email, name: p.name?.trim() || email.split("@")[0]!, avatarUrl: p.picture ?? null, googleSub: p.sub, kind: "account" as const, expiresAt: null, title: null };
  return db.transaction(async (tx) => {
    const current = currentUserId ? await tx.query.users.findFirst({ where: eq(s.users.id, currentUserId) }) : undefined;
    const guest = current?.kind === "guest" ? current : undefined;
    const existing = await tx.query.users.findFirst({ where: eq(s.users.googleSub, p.sub) })
      ?? await tx.query.users.findFirst({ where: and(eq(s.users.email, email), ne(s.users.kind, "demo")) });

    if (existing) {
      await tx.update(s.users).set({ ...profile, title: existing.title }).where(eq(s.users.id, existing.id));
      if (guest && guest.id !== existing.id) {
        const [to, from] = [existing.id, guest.id];
        await tx.update(s.meetings).set({ ownerId: to }).where(eq(s.meetings.ownerId, from));
        await tx.update(s.meetingParticipants).set({ userId: to }).where(eq(s.meetingParticipants.userId, from));
        await tx.update(s.highlights).set({ createdBy: to }).where(eq(s.highlights.createdBy, from));
        await tx.update(s.clips).set({ createdBy: to }).where(eq(s.clips.createdBy, from));
        await tx.execute(sql`INSERT INTO scratchpads (meeting_id, user_id, body, updated_at) SELECT meeting_id, ${to}, body, updated_at FROM scratchpads WHERE user_id = ${from} ON CONFLICT DO NOTHING`);
        await tx.delete(s.users).where(eq(s.users.id, from));
      }
      return { userId: existing.id, created: false, keptGuestData: !!guest };
    }
    if (guest) {
      await tx.update(s.users).set(profile).where(eq(s.users.id, guest.id));
      return { userId: guest.id, created: true, keptGuestData: true };
    }
    const [u] = await tx.insert(s.users).values(profile).returning({ id: s.users.id });
    return { userId: u!.id, created: true, keptGuestData: false };
  });
}
