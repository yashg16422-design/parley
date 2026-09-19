/**
 * Recognise Zoom / Google Meet / Teams join links (pasted by a user or found in
 * a calendar event). Client- and server-safe.
 */
export type Platform = "zoom" | "google_meet" | "teams";

export const LINK_PATTERNS: [Platform, RegExp][] = [
  ["google_meet", /https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}/i],
  ["zoom", /https:\/\/[\w.-]*zoom\.us\/(?:j|my|w|wc\/join)\/[^\s"<>)\\]+/i],
  ["teams", /https:\/\/teams\.(?:microsoft|live)\.com\/(?:l\/meetup-join|meet)\/[^\s"<>)\\]+/i],
];

export const PLATFORM_NAME: Record<Platform, string> = { zoom: "Zoom", google_meet: "Google Meet", teams: "Microsoft Teams" };

/** First join link in `text`, or null. */
export function findMeetingLink(text: string): { platform: Platform; url: string } | null {
  for (const [platform, re] of LINK_PATTERNS) {
    const url = text.match(re)?.[0];
    if (url) return { platform, url };
  }
  return null;
}

/**
 * Zoom's in-browser client (zoom.us/wc/join/<id>) runs in a tab, so Parley can
 * capture everyone's audio from it. The desktop app is a separate program a
 * web page can't hear.
 */
export function zoomWebUrl(url: string) {
  const u = new URL(url);
  const id = u.pathname.match(/\/(?:j|w|wc\/join)\/(\d+)/)?.[1];
  if (!id) return null;
  return `${u.origin}/wc/join/${id}${u.search}`;
}
