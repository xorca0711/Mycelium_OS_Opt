export interface PauseInterval {
  paused_at: string;
  resumed_at: string | null;
}

/** Subtract the union of pauses clipped to the active interval. */
export function netSessionMinutes(started: string, finished: string, pauses: readonly PauseInterval[]): number {
  const start = Date.parse(started);
  const end = Date.parse(finished);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  const intervals = pauses.map(p => [
    Math.max(start, Date.parse(p.paused_at)),
    Math.min(end, p.resumed_at ? Date.parse(p.resumed_at) : end),
  ]).filter(([s, e]) => Number.isFinite(s) && Number.isFinite(e) && e > s)
    .sort((a, b) => a[0] - b[0]);
  let paused = 0;
  let coveredUntil = start;
  for (const [s, e] of intervals) {
    paused += Math.max(0, e - Math.max(s, coveredUntil));
    coveredUntil = Math.max(coveredUntil, e);
  }
  return Math.max(0, (end - start - paused) / 60_000);
}
