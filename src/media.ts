/**
 * Stateless media contract. Recordings live on the provider (Mux); Parley never
 * touches video bytes. A clip is just a millisecond range on a meeting, and
 * both Mux clip workflows are derived from it:
 *  - instant clip: the parent playback URL with asset_start_time/asset_end_time
 *  - clip asset:   POST /video/v1/assets with input mux://assets/<id> + start/end
 */
export type MediaSource = { mediaProvider: "mux" | null; mediaAssetId: string | null; mediaPlaybackId: string | null };
export type ClipRange = { startMs: number; endMs: number };

const sec = (ms: number) => +(ms / 1000).toFixed(3);

export function checkClipRange({ startMs, endMs }: ClipRange, durationMs: number) {
  if (!Number.isInteger(startMs) || !Number.isInteger(endMs) || startMs < 0 || endMs <= startMs) return "clip must end after it starts";
  if (endMs > durationMs) return `clip ends at ${endMs}ms, after the recording (${durationMs}ms)`;
  if (endMs - startMs > 10 * 60_000) return "clips are limited to 10 minutes";
  return null;
}

/** Body for Mux's "create asset" call that cuts a clip from the meeting's asset; null without media. */
export function muxClipAssetRequest(m: MediaSource, c: ClipRange) {
  if (m.mediaProvider !== "mux" || !m.mediaAssetId) return null;
  return { input: [{ url: `mux://assets/${m.mediaAssetId}`, start_time: sec(c.startMs), end_time: sec(c.endMs) }], playback_policies: ["public"] as const };
}

/** HLS URL that plays only the clip's range, with no new asset (Mux instant clipping). */
export function muxClipPlaybackUrl(m: MediaSource, c: ClipRange) {
  if (m.mediaProvider !== "mux" || !m.mediaPlaybackId) return null;
  return `https://stream.mux.com/${m.mediaPlaybackId}.m3u8?asset_start_time=${sec(c.startMs)}&asset_end_time=${sec(c.endMs)}`;
}
