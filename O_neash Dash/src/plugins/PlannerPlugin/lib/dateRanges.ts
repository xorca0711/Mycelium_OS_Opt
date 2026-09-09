function localMidnight(key: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) throw new Error('Expected YYYY-MM-DD');
  const [y, m, d] = key.split('-').map(Number);
  const result = new Date(y, m - 1, d);
  if (result.getFullYear() !== y || result.getMonth() !== m - 1 || result.getDate() !== d) {
    throw new Error('Invalid calendar date');
  }
  return result;
}

/** Inclusive local date keys become an exclusive-end UTC timestamp interval. */
export function localDateRange(from: string, to: string): [string, string] {
  const start = localMidnight(from);
  const end = localMidnight(to);
  if (end < start) throw new Error('End date precedes start date');
  end.setDate(end.getDate() + 1);
  return [start.toISOString(), end.toISOString()];
}

export function recentCalendarRange(days: number, now = new Date()): [string, string] {
  if (!Number.isInteger(days) || days < 1) throw new Error('Days must be a positive integer');
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - days + 1);
  const end = new Date(now);
  end.setHours(0, 0, 0, 0);
  end.setDate(end.getDate() + 1);
  return [start.toISOString(), end.toISOString()];
}
