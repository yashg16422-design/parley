import { cookies } from "next/headers";
import { AUTH_NEXT as NEXT, appOrigin as origin } from "@/auth-urls";
import { googleConfigured, startGoogleAuth } from "@/google-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";


export async function GET(req: Request) {
  if (!googleConfigured()) return Response.redirect(`${origin(req)}/?auth=unconfigured`, 303);
  const next = new URL(req.url).searchParams.get("next") ?? "/home";
  const { url, state, verifier } = startGoogleAuth(`${origin(req)}/api/auth/google/callback`);
  (await cookies()).set("parley_oauth", JSON.stringify({ state, verifier, next: NEXT.includes(next) ? next : "/home" }), {
    httpOnly: true, sameSite: "lax", path: "/api/auth/google", maxAge: 600, secure: process.env.NODE_ENV === "production" && !process.env.PARLEY_INSECURE_COOKIES,
  });
  return Response.redirect(url, 303);
}
