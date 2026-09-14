import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarWeekStart, weekdayOrder, dailyCapacity, remainingCapacity, estimatedBlockMinutes, suggestionPreferenceBonus, isPreferredFocusTime, reservedPlanningMinutes } from '../src/plugins/PlannerPlugin/lib/planningPreferences.ts';
import type { CapacityNode } from '../src/plugins/PlannerPlugin/lib/planningPreferences.ts';

const preferences = { dailyMinutes: [0, 120, 120, 120, 120, 120, 60], focusStart: '09:00', focusEnd: '12:00', focusMinutes: 25, breakMinutes: 5 };

test('weekly capacity distinguishes working days, weekends and a rest day', () => {
  assert.equal(dailyCapacity(preferences, new Date(2026, 8, 7)), 120);
  assert.equal(dailyCapacity(preferences, new Date(2026, 8, 12)), 60);
  assert.equal(dailyCapacity(preferences, new Date(2026, 8, 13)), 0);
  assert.equal(remainingCapacity(preferences, new Date(2026, 8, 7), 145), 0);
});

test('suggestions reserve breaks between focus blocks and stop at remaining capacity', () => {
  const now = new Date(2026, 8, 7, 10);
  assert.equal(estimatedBlockMinutes(50, preferences), 55);
  assert.equal(estimatedBlockMinutes(null, preferences), 25);
  assert.equal(suggestionPreferenceBonus(50, preferences, now, 54), null);
  assert.notEqual(suggestionPreferenceBonus(50, preferences, now, 55), null);
  assert.equal(suggestionPreferenceBonus(10, preferences, now, 0), null);
});

test('capacity includes overdue work planned today and session work once across every source', () => {
  const now = new Date(2026, 8, 7, 10);
  const task = (id: string, patch: Partial<CapacityNode> = {}): CapacityNode => ({
    id, node_type: 'task', is_completed: false, estimated_duration_minutes: 25, ...patch,
  });
  const overdue = { ...task('overdue', { planned_start_at: '2026-09-07', due_at: '2026-09-06' }), is_overdue: true };
  const sessionOnly = task('queued');
  const scheduledInSession = task('running', { planned_start_at: '2026-09-07', due_at: '2026-09-07' });
  const completed = task('done', { is_completed: true });
  const event = task('event', { node_type: 'event', planned_start_at: '2026-09-07', estimated_duration_minutes: 30 });
  const future = task('future', { planned_start_at: '2026-09-08' });
  const ids = new Set(['queued', 'running', 'done', 'event']);
  const nodes = [overdue, sessionOnly, scheduledInSession, completed, event, future];
  const reserved = reservedPlanningMinutes(nodes, [completed, event], ids, preferences, now);
  assert.equal(reserved, 130); // Four 25-minute tasks and one 30-minute event, each only once.
  assert.equal(remainingCapacity(preferences, now, reserved), 0);
  assert.equal(suggestionPreferenceBonus(25, preferences, now, remainingCapacity(preferences, now, reserved)), null);
  assert.equal(reservedPlanningMinutes([sessionOnly, future], [], new Set(), preferences, now), 0);
});

test('focus period changes ranking and supports a preferred overnight interval', () => {
  const inside = new Date(2026, 8, 7, 10), outside = new Date(2026, 8, 7, 14);
  assert.ok(suggestionPreferenceBonus(50, preferences, inside, 100)! > suggestionPreferenceBonus(50, preferences, outside, 100)!);
  assert.ok(suggestionPreferenceBonus(20, preferences, outside, 100)! > suggestionPreferenceBonus(50, preferences, outside, 100)!);
  const night = { ...preferences, focusStart: '22:00', focusEnd: '02:00' };
  assert.equal(isPreferredFocusTime(night, new Date(2026, 8, 7, 23)), true);
  assert.equal(isPreferredFocusTime(night, new Date(2026, 8, 8, 1)), true);
  assert.equal(isPreferredFocusTime(night, new Date(2026, 8, 8, 2)), false);
});

test('week-start changes ordering and ranges without mutating dates or Sunday identity', () => {
  const sunday = new Date(2026, 8, 13, 14);
  assert.deepEqual(weekdayOrder(1), [1,2,3,4,5,6,0]);
  assert.deepEqual(weekdayOrder(0), [0,1,2,3,4,5,6]);
  assert.equal(calendarWeekStart(sunday, 1).getDate(), 7);
  assert.equal(calendarWeekStart(sunday, 0).getDate(), 13);
  assert.equal(calendarWeekStart(sunday, 1, 1).getDate(), 14);
  assert.equal(sunday.getHours(), 14);
});
