export interface PersonalSettings {
  schemaVersion: 1;
  displayName: string;
  avatarDataUrl: string | null;
  timeZone: string;
  locale: 'system' | 'en-US' | 'ko-KR';
  weekStartsOn: 0 | 1;
  /** Minutes available on Sunday through Saturday. */
  dailyMinutes: [number, number, number, number, number, number, number];
  focusStart: string;
  focusEnd: string;
  focusMinutes: number;
  breakMinutes: number;
  disabledPluginIds: string[];
  feeds: { news: boolean; research: boolean; weather: boolean; quotes: boolean };
  analytics: { planner: boolean; sleep: boolean };
}

export interface LegacyPersonalCapacity {
  daily_minutes: number;
  peak_start?: string;
  peak_end?: string;
}

export const MAX_AVATAR_BYTES = 512 * 1024;
const clockTime = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function getDefaultPersonalSettings(capacity?: LegacyPersonalCapacity): PersonalSettings {
  const minutes = Number.isInteger(capacity?.daily_minutes) && capacity!.daily_minutes >= 0 && capacity!.daily_minutes <= 1440
    ? capacity!.daily_minutes : 480;
  return {
    schemaVersion: 1, displayName: '', avatarDataUrl: null, timeZone: 'system', locale: 'system', weekStartsOn: 1,
    dailyMinutes: [minutes, minutes, minutes, minutes, minutes, minutes, minutes],
    focusStart: capacity?.peak_start && clockTime.test(capacity.peak_start) ? capacity.peak_start : '09:00',
    focusEnd: capacity?.peak_end && clockTime.test(capacity.peak_end) ? capacity.peak_end : '12:00',
    focusMinutes: 25, breakMinutes: 5, disabledPluginIds: [],
    feeds: { news: true, research: true, weather: true, quotes: true },
    analytics: { planner: true, sleep: true },
  };
}

function exactObject(value: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== keys.length || keys.some(key => !Object.prototype.hasOwnProperty.call(record, key))) {
    throw new Error(`${label} contains missing or unsupported fields`);
  }
  return record;
}

function integer(value: unknown, min: number, max: number, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label} must be a whole number from ${min} to ${max}`);
  }
  return value;
}

function avatar(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || value.length > Math.ceil(MAX_AVATAR_BYTES / 3) * 4 + 40) {
    throw new Error('Avatar must be a raster image of at most 512 KiB');
  }
  const match = /^data:image\/(png|jpeg|gif|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || match[2].length % 4 !== 0) throw new Error('Avatar must be a base64 PNG, JPEG, GIF, or WebP image');
  let bytes: string;
  try { bytes = atob(match[2]); } catch { throw new Error('Avatar contains invalid base64 data'); }
  if (bytes.length > MAX_AVATAR_BYTES) throw new Error('Avatar must be at most 512 KiB');
  const valid = match[1] === 'png' ? bytes.startsWith('\x89PNG\r\n\x1a\n')
    : match[1] === 'jpeg' ? bytes.startsWith('\xff\xd8\xff')
    : match[1] === 'gif' ? /^GIF8[79]a/.test(bytes)
    : bytes.startsWith('RIFF') && bytes.slice(8, 12) === 'WEBP';
  if (!valid) throw new Error('Avatar data does not match its image type');
  return value;
}

/** Validate the entire persisted/imported document; never silently discard fields. */
export function validatePersonalSettings(value: unknown, installedPluginIds: readonly string[]): PersonalSettings {
  const settings = exactObject(value, Object.keys(getDefaultPersonalSettings()), 'Personal settings');
  if (settings.schemaVersion !== 1) throw new Error('Unsupported personal settings version');
  if (typeof settings.displayName !== 'string' || settings.displayName.length > 80 || /[\x00-\x1f\x7f]/.test(settings.displayName)) {
    throw new Error('Display name must contain at most 80 characters without control characters');
  }
  if (typeof settings.timeZone !== 'string' || settings.timeZone.length > 100 || /^[+-]/.test(settings.timeZone)) throw new Error('Invalid IANA time zone');
  if (settings.timeZone !== 'system') {
    try { new Intl.DateTimeFormat('en-US', { timeZone: settings.timeZone }).format(0); }
    catch { throw new Error('Time zone must be system or a supported IANA time zone'); }
  }
  if (!['system', 'en-US', 'ko-KR'].includes(settings.locale as string)) throw new Error('Unsupported locale');
  if (settings.weekStartsOn !== 0 && settings.weekStartsOn !== 1) throw new Error('Week must start on Sunday or Monday');
  if (!Array.isArray(settings.dailyMinutes) || settings.dailyMinutes.length !== 7) throw new Error('Daily capacity must contain seven days');
  const dailyMinutes = Array.from(settings.dailyMinutes, (minutes, day) => integer(minutes, 0, 1440, `Day ${day + 1} capacity`));
  for (const field of ['focusStart', 'focusEnd']) {
    if (typeof settings[field] !== 'string' || !clockTime.test(settings[field])) throw new Error(`${field} must use HH:mm`);
  }
  if (!Array.isArray(settings.disabledPluginIds) || Array.from(settings.disabledPluginIds).some(id => typeof id !== 'string' || id === 'settings' || !installedPluginIds.includes(id))) {
    throw new Error('Only installed plugins may be disabled; Settings must remain available');
  }
  if (new Set(settings.disabledPluginIds).size !== settings.disabledPluginIds.length) throw new Error('Disabled plugins must be unique');
  const feeds = exactObject(settings.feeds, ['news', 'research', 'weather', 'quotes'], 'Feeds');
  const analytics = exactObject(settings.analytics, ['planner', 'sleep'], 'Analytics');
  if ([...Object.values(feeds), ...Object.values(analytics)].some(enabled => typeof enabled !== 'boolean')) {
    throw new Error('Feed and analytics preferences must be true or false');
  }
  return {
    schemaVersion: 1, displayName: settings.displayName, avatarDataUrl: avatar(settings.avatarDataUrl),
    timeZone: settings.timeZone, locale: settings.locale as PersonalSettings['locale'], weekStartsOn: settings.weekStartsOn,
    dailyMinutes: dailyMinutes as PersonalSettings['dailyMinutes'], focusStart: settings.focusStart as string, focusEnd: settings.focusEnd as string,
    focusMinutes: integer(settings.focusMinutes, 1, 240, 'Focus minutes'), breakMinutes: integer(settings.breakMinutes, 1, 120, 'Break minutes'),
    disabledPluginIds: [...settings.disabledPluginIds],
    feeds: { ...feeds } as PersonalSettings['feeds'], analytics: { ...analytics } as PersonalSettings['analytics'],
  };
}
