import { recentCalendarRange } from '../../../PlannerPlugin/lib/dateRanges.ts';

const HOUR_MS = 3_600_000;
export const WINDOW_ASSUMPTION = 'Local wake dates · at most 20h after waking · missing-night gaps excluded';

export interface AnalyticsRange { sinceMs: number; untilMs: number }
export interface SleepTiming { sleep_start: string; wake_time: string }
export interface WakingWindow {
  sleepStartMs: number;
  wakeMs: number;
  sleepMs: number;
  wakingHours: number;
  sleepDurationH: number;
  date: string;
  dayNumber: number;
}

export function analyticsRange(days: number, now = new Date()): AnalyticsRange {
  const [since] = recentCalendarRange(days, now);
  return { sinceMs: Date.parse(since), untilMs: now.getTime() };
}

/** Attribute completions only within the same bounded interval used for the rate.
 * A missing next night never stretches an observation over several calendar days.
 * Incomplete current days are included after 30 minutes; dates follow the user's timezone.
 */
export function buildWakingWindows(entries: readonly SleepTiming[], range: AnalyticsRange): WakingWindow[] {
  const sorted = entries.map(e => ({ sleepStartMs: Date.parse(e.sleep_start), wakeMs: Date.parse(e.wake_time) }))
    .filter(e => Number.isFinite(e.sleepStartMs) && Number.isFinite(e.wakeMs)
      && e.sleepStartMs < e.wakeMs && e.wakeMs <= range.untilMs)
    .sort((a, b) => a.sleepStartMs - b.sleepStartMs);

  return sorted.flatMap((entry, index) => {
    const { sleepStartMs, wakeMs } = entry;
    if (wakeMs < range.sinceMs) return [];
    // Overlapping sleep records do not provide a reliable waking interval.
    if (index > 0 && sorted[index - 1].wakeMs > sleepStartMs) return [];
    const sleepMs = Math.min(sorted[index + 1]?.sleepStartMs ?? range.untilMs,
      range.untilMs, wakeMs + 20 * HOUR_MS);
    const wakingHours = (sleepMs - wakeMs) / HOUR_MS;
    if (wakingHours < 0.5) return [];
    const wakeDate = new Date(wakeMs);
    const y = wakeDate.getFullYear(), m = wakeDate.getMonth(), d = wakeDate.getDate();
    return [{
      sleepStartMs, wakeMs, sleepMs, wakingHours,
      sleepDurationH: (wakeMs - sleepStartMs) / HOUR_MS,
      date: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      dayNumber: Date.UTC(y, m, d) / (24 * HOUR_MS),
    }];
  });
}
