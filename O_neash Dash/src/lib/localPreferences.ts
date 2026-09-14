export const LOCAL_PREFERENCE_KEYS = [
  'oneash-font-main', 'oneash-font-kr', 'oneash-font-main-scale', 'oneash-font-kr-scale',
  'oneash-weather-location', 'oneash-widgets-v3', 'arc-visibility', 'planner-view-store',
] as const;

export type LocalPreferences = Record<string, string | null>;
type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const allowedKeys = new Set<string>(LOCAL_PREFERENCE_KEYS);

function checkedPreferences(value: LocalPreferences): LocalPreferences {
  const entries = Object.entries(value);
  let bytes = 0;
  const encoder = new TextEncoder();
  for (const [key, item] of entries) {
    if (!allowedKeys.has(key)) throw new Error(`Unsupported local preference: ${key}`);
    if (item !== null && typeof item !== 'string') throw new Error(`Invalid local preference: ${key}`);
    const size = item === null ? 0 : encoder.encode(item).byteLength;
    if (size > 128 * 1024) throw new Error(`Local preference ${key} exceeds the backup size limit.`);
    bytes += size;
  }
  if (bytes > 512 * 1024) throw new Error('Local preferences exceed the backup size limit.');
  return Object.fromEntries(entries);
}

export function collectLocalPreferences(storage: PreferenceStorage = localStorage): LocalPreferences {
  return checkedPreferences(Object.fromEntries(LOCAL_PREFERENCE_KEYS.map(key => [key, storage.getItem(key)])));
}

/** Apply only the explicit backup keys; roll back this handoff if storage rejects a write. */
export function applyRestoredPreferences(preferences: LocalPreferences, storage: PreferenceStorage = localStorage): void {
  const checked = checkedPreferences(preferences);
  const previous = Object.fromEntries(Object.keys(checked).map(key => [key, storage.getItem(key)]));
  const write = (key: string, value: string | null) => value === null ? storage.removeItem(key) : storage.setItem(key, value);
  const written: string[] = [];
  try {
    for (const [key, value] of Object.entries(checked)) {
      write(key, value);
      written.push(key);
    }
  } catch (error) {
    const rollbackErrors: unknown[] = [];
    for (const key of written.reverse()) {
      try { write(key, previous[key]); } catch (rollbackError) { rollbackErrors.push(rollbackError); }
    }
    if (rollbackErrors.length) throw new Error('Restored preferences could not be applied or fully rolled back. Free local storage and retry startup.');
    throw new Error(`Restored preferences could not be applied. Previous preferences were retained; free local storage and retry startup. ${error instanceof Error ? error.message : String(error)}`);
  }
}
