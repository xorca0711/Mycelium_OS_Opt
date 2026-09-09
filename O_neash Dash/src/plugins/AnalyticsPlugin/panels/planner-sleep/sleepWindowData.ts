import { getDb } from '@/lib/db';
import type { SleepEntry } from '../../../SleepTrackerPlugin/lib/sleepDb';
import type { AnalyticsRange } from './sleepWindows';

/** Read by timestamp, not number of nights: sparse logs must not pull old zero-output samples. */
export function loadAnalyticsSleep(range: AnalyticsRange): Promise<SleepEntry[]> {
  return getDb().select<SleepEntry[]>(
    `SELECT id, date, sleep_start, wake_time, notes, created_at FROM sleep_entries
     WHERE is_nap = 0 AND julianday(wake_time) >= julianday(?)
       AND julianday(wake_time) <= julianday(?) ORDER BY sleep_start ASC`,
    [new Date(range.sinceMs).toISOString(), new Date(range.untilMs).toISOString()],
  );
}
