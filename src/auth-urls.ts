/** Allowed post-login destinations; never an arbitrary URL from the query string. */
export const AUTH_NEXT = ["/home", "/live/mic?join=1", "/settings", "/calendar"];

/** Public base URL (APP_URL on Vercel, else the request's own origin); must match Google's redirect URI. */
export const appOrigin = (req: Request) => process.env.APP_URL?.replace(/\/$/, "") || new URL(req.url).origin;
