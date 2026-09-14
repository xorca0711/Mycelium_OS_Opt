import { getDb, executeBatch } from './db';
import { plugins } from '../plugins/registry';
import { getDefaultPersonalSettings, validatePersonalSettings, type LegacyPersonalCapacity, type PersonalSettings } from './personalSettings';

interface SettingsRow { revision: number; schema_version: number; settings_json: string; saved_at: string }
export interface PersonalSettingsRevision { revision: number; savedAt: string; settings: PersonalSettings }

let pending: Promise<unknown> = Promise.resolve();
function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const result = pending.then(operation);
  pending = result.catch(() => undefined);
  return result;
}

function validate(value: unknown): PersonalSettings {
  return validatePersonalSettings(value, plugins.map(plugin => plugin.id));
}

function decode(row: SettingsRow): PersonalSettings {
  if (row.schema_version !== 1) throw new Error('Unsupported personal settings version; stored data was kept');
  let value: unknown;
  try { value = JSON.parse(row.settings_json); } catch { throw new Error('Stored personal settings contain invalid JSON; data was kept'); }
  return validate(value);
}

async function loadCurrent(): Promise<PersonalSettings> {
  const rows = await getDb().select<SettingsRow[]>("SELECT * FROM personal_settings WHERE id = 'current'");
  if (rows[0]) return decode(rows[0]);
  const capacity = await getDb().select<LegacyPersonalCapacity[]>("SELECT daily_minutes, peak_start, peak_end FROM user_capacity WHERE id = 'default'");
  const settings = getDefaultPersonalSettings(capacity[0]);
  const now = new Date().toISOString();
  await executeBatch([
    { sql: `INSERT OR IGNORE INTO personal_settings(id, revision, schema_version, settings_json, saved_at)
      VALUES ('current', 1, 1, ?, ?)`, values: [JSON.stringify(settings), now] },
    { sql: `INSERT OR IGNORE INTO personal_settings_history(revision, schema_version, settings_json, saved_at)
      SELECT revision, schema_version, settings_json, saved_at FROM personal_settings WHERE id = 'current'` },
  ]);
  const initialized = await getDb().select<SettingsRow[]>("SELECT * FROM personal_settings WHERE id = 'current'");
  if (!initialized[0]) throw new Error('Personal settings could not be initialized');
  return decode(initialized[0]);
}

export function loadPersonalSettings(): Promise<PersonalSettings> {
  return serialize(loadCurrent);
}

export async function savePersonalSettings(value: PersonalSettings): Promise<PersonalSettings> {
  // Snapshot at invocation, before waiting, so edits to a caller's draft cannot leak into a save.
  const settings = validate(value);
  return serialize(async () => {
    // Refuse to replace malformed or future-version data with fallback defaults.
    await loadCurrent();
    await executeBatch([
      { sql: `UPDATE personal_settings SET revision = revision + 1, schema_version = 1, settings_json = ?, saved_at = ?
        WHERE id = 'current'`, values: [JSON.stringify(settings), new Date().toISOString()] },
      { sql: `INSERT INTO personal_settings_history(revision, schema_version, settings_json, saved_at)
        SELECT revision, schema_version, settings_json, saved_at FROM personal_settings WHERE id = 'current'` },
    ]);
    return settings;
  });
}

export function loadPersonalSettingsHistory(limit = 50): Promise<PersonalSettingsRevision[]> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) return Promise.reject(new Error('History limit must be from 1 to 500'));
  return serialize(async () => {
    const rows = await getDb().select<SettingsRow[]>('SELECT * FROM personal_settings_history ORDER BY revision DESC LIMIT ?', [limit]);
    return rows.map(row => ({ revision: row.revision, savedAt: row.saved_at, settings: decode(row) }));
  });
}
