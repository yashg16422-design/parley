import { cookies } from "next/headers";
import { audit } from "@/audit";
import { getDb } from "@/db";
import { clientIp } from "@/rate-limit";
import { finishGoogleAuth, upsertGoogleUser } from "@/google-auth";
import { currentUserId, setSession } from "@/session";
import { appOrigin as origin } from "@/auth-urls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const jar = await cookies();
  const saved = (() => {
    try { return JSON.parse(jar.get("parley_oauth")?.value ?? "") as { state: string; verifier: string; next: string }; } catch { return null; }
  })();
  jar.delete({ name: "parley_oauth", path: "/api/auth/google" });
  const fail = (why: string) => Response.redirect(`${origin(req)}/?auth=${why}`, 303);
  if (url.searchParams.get("error")) return fail("cancelled");
  // The state must round-trip unchanged: stops login CSRF and replayed codes.
  if (!saved || !url.searchParams.get("code") || url.searchParams.get("state") !== saved.state) return fail("expired");
  try {
    const profile = await finishGoogleAuth(url.searchParams.get("code")!, saved.verifier, `${origin(req)}/api/auth/google/callback`);
    const r = await upsertGoogleUser(getDb(), profile, await currentUserId());
    await setSession(r.userId);
    await audit(getDb(), r.userId, r.created ? "account.created" : "sign_in", profile.email, { via: "google", keptGuestData: r.keptGuestData }, clientIp(req.headers));
    return Response.redirect(`${origin(req)}${saved.next}`, 303);
  } catch (e) {
    console.error("google sign-in:", e instanceof Error ? e.message : e);
    return fail("failed");
  }
}
