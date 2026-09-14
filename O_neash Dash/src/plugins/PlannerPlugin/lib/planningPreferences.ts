import type { PersonalSettings } from '../../../lib/personalSettings';
import type { PlannerNode } from '../types';
import { isSameDay } from './logicEngine.ts';

export type PlanningPreferences = Pick<PersonalSettings, 'dailyMinutes' | 'focusStart' | 'focusEnd' | 'focusMinutes' | 'breakMinutes'>;
export type CapacityNode = Pick<PlannerNode, 'id' | 'node_type' | 'is_completed' | 'planned_start_at' | 'due_at' | 'estimated_duration_minutes'>;

/** Week positions are display choices; underlying date keys remain device-local. */
export function weekdayOrder(first: 0 | 1): number[] {
  return Array.from({ length: 7 }, (_, i) => (first + i) % 7);
}

export function calendarWeekStart(date: Date, first: 0 | 1, offset = 0): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (start.getDay() - first + 7) % 7 + offset * 7);
  return start;
}

export function dailyCapacity(preferences: PlanningPreferences, date: Date): number {
  return preferences.dailyMinutes[date.getDay()];
}

export function isPreferredFocusTime(preferences: PlanningPreferences, date: Date): boolean {
  const minute = date.getHours() * 60 + date.getMinutes();
  const toMinutes = (value: string) => { const [h, m] = value.split(':').map(Number); return h * 60 + m; };
  const start = toMinutes(preferences.focusStart);
  const end = toMinutes(preferences.focusEnd);
  return start < end ? minute >= start && minute < end : minute >= start || minute < end;
}

/** Breaks between focus blocks reserve real calendar time; no trailing break. */
export function estimatedBlockMinutes(estimate: number | null | undefined, preferences: PlanningPreferences): number {
  const work = estimate != null && Number.isFinite(estimate) && estimate > 0 ? estimate : preferences.focusMinutes;
  return work + Math.max(0, Math.ceil(work / preferences.focusMinutes) - 1) * preferences.breakMinutes;
}

/** Count commitments once, independently of the Today/Overdue display sections. */
export function reservedPlanningMinutes(
  nodes: readonly CapacityNode[], completedToday: readonly CapacityNode[], activeSessionNodeIds: ReadonlySet<string>,
  preferences: PlanningPreferences, now: Date,
): number {
  const reserved = new Map<string, CapacityNode>();
  for (const node of nodes) {
    const scheduledToday = isSameDay(node.planned_start_at, now)
      || (node.node_type !== 'event' && isSameDay(node.due_at, now));
    if (!node.is_completed && (scheduledToday || activeSessionNodeIds.has(node.id))) reserved.set(node.id, node);
  }
  for (const node of completedToday) reserved.set(node.id, node);
  let minutes = 0;
  for (const node of reserved.values()) {
    minutes += node.node_type === 'event' ? Math.max(0, node.estimated_duration_minutes ?? 0)
      : estimatedBlockMinutes(node.estimated_duration_minutes, preferences);
  }
  return minutes;
}

export function remainingCapacity(preferences: PlanningPreferences, date: Date, reservedMinutes: number): number {
  return Math.max(0, dailyCapacity(preferences, date) - Math.max(0, reservedMinutes));
}

/** null means the suggestion cannot fit today's unallocated work budget. */
export function suggestionPreferenceBonus(
  estimate: number | null | undefined, preferences: PlanningPreferences, now: Date, availableMinutes: number,
): number | null {
  if (estimatedBlockMinutes(estimate, preferences) > availableMinutes) return null;
  const work = estimate != null && estimate > 0 ? estimate : preferences.focusMinutes;
  if (isPreferredFocusTime(preferences, now)) return work > preferences.focusMinutes ? 12 : 6;
  return work <= preferences.focusMinutes ? 12 : 0;
}
