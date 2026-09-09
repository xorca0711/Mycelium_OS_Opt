import assert from 'node:assert/strict';
import test from 'node:test';
import { analyticsRange, buildWakingWindows } from '../src/plugins/AnalyticsPlugin/panels/planner-sleep/sleepWindows.ts';
import { computeIrf } from '../src/plugins/AnalyticsPlugin/panels/planner-sleep/impulseResponseMath.ts';

process.env.TZ = 'Asia/Seoul';
const HOUR = 3_600_000;
const entry = (start: string, wake: string) => ({ sleep_start: start, wake_time: wake });

test('missing nights cannot attribute several days of output to one sleep', () => {
  const days = buildWakingWindows([
    entry('2026-09-01T00:00:00+09:00', '2026-09-01T08:00:00+09:00'),
    entry('2026-09-04T00:00:00+09:00', '2026-09-04T08:00:00+09:00'),
  ], analyticsRange(10, new Date('2026-09-04T18:00:00+09:00')));
  assert.equal(days[0].wakingHours, 20);
  assert.equal(days[0].sleepMs - days[0].wakeMs, days[0].wakingHours * HOUR);
  const missingDayTask = Date.parse('2026-09-02T12:00:00+09:00');
  assert.equal(days.some(d => missingDayTask >= d.wakeMs && missingDayTask < d.sleepMs), false);
  assert.equal(days[1].wakingHours, 10);
});

test('observed bedtime ends attribution, with no denominator-only clamp', () => {
  const days = buildWakingWindows([
    entry('2026-09-01T00:00:00+09:00', '2026-09-01T08:00:00+09:00'),
    entry('2026-09-01T23:00:00+09:00', '2026-09-02T07:00:00+09:00'),
  ], analyticsRange(10, new Date('2026-09-02T12:00:00+09:00')));
  assert.equal(days[0].wakingHours, 15);
  assert.equal(days[0].sleepMs, Date.parse('2026-09-01T23:00:00+09:00'));
});

test('rejects invalid/future sleep and excludes nearly-empty current observations', () => {
  const range = analyticsRange(10, new Date('2026-09-04T08:10:00+09:00'));
  assert.deepEqual(buildWakingWindows([
    entry('broken', 'broken'),
    entry('2026-09-04T10:00:00+09:00', '2026-09-04T08:00:00+09:00'),
    entry('2026-09-05T00:00:00+09:00', '2026-09-05T08:00:00+09:00'),
    entry('2026-09-04T00:00:00+09:00', '2026-09-04T08:00:00+09:00'),
  ], range), []);
});

test('local calendar cutoff and labels agree at KST midnight, independent of UTC day', () => {
  const range = analyticsRange(2, new Date('2026-09-04T12:00:00+09:00'));
  assert.equal(new Date(range.sinceMs).toISOString(), '2026-09-02T15:00:00.000Z');
  const days = buildWakingWindows([
    entry('2026-09-02T15:00:00+09:00', '2026-09-02T23:59:59+09:00'),
    entry('2026-09-02T23:59:59+09:00', '2026-09-03T00:00:00+09:00'),
    entry('2026-09-03T23:00:00+09:00', '2026-09-04T07:00:00+09:00'),
  ], range);
  assert.deepEqual(days.map(d => d.date), ['2026-09-03', '2026-09-04']);
  assert.equal(days[1].dayNumber - days[0].dayNumber, 1);
});

test('IRF requires enough observations inside the calendar window, not old record count', () => {
  const old = Array.from({ length: 20 }, (_, i) => ({
    id: i, date: `2025-01-${String(i + 1).padStart(2, '0')}`,
    sleep_start: new Date(2025, 0, i + 1, 0).toISOString(),
    wake_time: new Date(2025, 0, i + 1, 8).toISOString(), notes: null, created_at: '',
  }));
  assert.equal(computeIrf(old, [], new Date('2026-09-04T12:00:00+09:00')), null);
});

test('IRF calendar lags remain absent across a missing day', () => {
  const sleep = Array.from({ length: 20 }, (_, i) => i + 1).filter(day => day !== 6).map(day => ({
    id: day, date: `2026-08-${String(day).padStart(2, '0')}`,
    sleep_start: new Date(2026, 7, day, 0).toISOString(),
    wake_time: new Date(2026, 7, day, day <= 5 ? 4 : 8).toISOString(), notes: null, created_at: '',
  }));
  const tasks = sleep.map(e => ({ id: String(e.id), actual_completed_at: new Date(2026, 7, e.id, 12).toISOString(), estimated_duration_minutes: 30 }));
  const result = computeIrf(sleep, tasks, new Date(2026, 7, 21, 12));
  assert.ok(result);
  // Fifth shock is Aug 5. Its D+1 is missing Aug 6, not the next log on Aug 7.
  assert.equal(result.allTraj[4][2], null);
  assert.notEqual(result.allTraj[4][3], null);
});
