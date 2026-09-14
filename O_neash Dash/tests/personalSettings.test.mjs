import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { getDefaultPersonalSettings, validatePersonalSettings, MAX_AVATAR_BYTES } from '../src/lib/personalSettings.ts';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.includes('/src/')) {
      if (specifier === './db' && context.parentURL.endsWith('/personalSettingsDb.ts')) return { url: 'settings-test:db', shortCircuit: true };
      if (specifier === '../plugins/registry') return { url: 'settings-test:plugins', shortCircuit: true };
      if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return nextResolve(new URL(specifier + '.ts', context.parentURL).href, context);
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === 'settings-test:db') return { format: 'module', shortCircuit: true,
      source: 'export const getDb=()=>globalThis.__settingsDb; export const executeBatch=s=>globalThis.__settingsDb.executeBatch(s);' };
    if (url === 'settings-test:plugins') return { format: 'module', shortCircuit: true,
      source: 'export const plugins=[{id:"notes"},{id:"planner"},{id:"settings"}];' };
    return nextLoad(url, context);
  },
});
const db = await import('../src/lib/personalSettingsDb.ts');
const { usePersonalSettingsStore: store } = await import('../src/store/usePersonalSettingsStore.ts');
const ids = ['notes', 'planner', 'settings'];
const validate = value => validatePersonalSettings(value, ids);

function fixture(t, minutes = 420) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../src-tauri/src/database/schema/settings.sql', import.meta.url), 'utf8'));
  sqlite.exec("CREATE TABLE user_capacity(id TEXT PRIMARY KEY,daily_minutes INTEGER,peak_start TEXT,peak_end TEXT)");
  sqlite.prepare("INSERT INTO user_capacity VALUES ('default',?,'10:00','14:30')").run(minutes);
  let failAt = -1;
  globalThis.__settingsDb = {
    select: async (sql, params = []) => sqlite.prepare(sql).all(...params),
    executeBatch: async statements => {
      sqlite.exec('BEGIN');
      try {
        const result = statements.map(({ sql, values = [] }, index) => {
          if (index === failAt) throw new Error('injected write failure');
          return sqlite.prepare(sql).run(...values);
        });
        sqlite.exec('COMMIT'); return result;
      } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  };
  store.setState({ settings: getDefaultPersonalSettings(), loaded: false, error: null });
  t.after(() => sqlite.close());
  return { sqlite, fail: index => { failAt = index; }, row: sql => sqlite.prepare(sql).get() };
}

test('defaults inherit capacity and focus hours; validation returns independent values', () => {
  const defaults = getDefaultPersonalSettings({ daily_minutes: 360, peak_start: '11:00', peak_end: '15:00' });
  assert.deepEqual(defaults.dailyMinutes, [360, 360, 360, 360, 360, 360, 360]);
  assert.equal(defaults.focusStart, '11:00'); assert.equal(defaults.focusEnd, '15:00');
  const result = validate(defaults);
  result.feeds.news = false; result.dailyMinutes[0] = 0;
  assert.equal(defaults.feeds.news, true); assert.equal(defaults.dailyMinutes[0], 360);
});

test('validation rejects unsupported, malformed, out-of-range and unsafe settings', () => {
  for (const patch of [
    { schemaVersion: 2 }, { unexpected: true }, { displayName: 'a'.repeat(81) }, { displayName: '\n' },
    { dailyMinutes: [1] }, { dailyMinutes: new Array(7) }, { dailyMinutes: [0, 1, 2, 3, 4, 5, 1441] }, { dailyMinutes: [0, 1, 2, 3, 4, 5, 1.5] },
    { focusStart: '24:00' }, { focusMinutes: 0 }, { breakMinutes: 121 }, { timeZone: 'Not/AZone' }, { timeZone: '+01:00' },
    { locale: 'ar' }, { weekStartsOn: 2 }, { disabledPluginIds: ['settings'] }, { disabledPluginIds: ['missing'] },
    { disabledPluginIds: ['notes', 'notes'] }, { disabledPluginIds: new Array(1) }, { feeds: { news: true } }, { analytics: { planner: 'yes', sleep: true } },
    { avatarDataUrl: 'https://example.com/avatar.png' }, { avatarDataUrl: 'data:image/svg+xml;base64,PHN2Zy8+' },
    { avatarDataUrl: 'data:image/png;base64,' + btoa('not a png') },
    { avatarDataUrl: 'data:image/png;base64,' + Buffer.alloc(MAX_AVATAR_BYTES + 1).toString('base64') },
  ]) assert.throws(() => validate({ ...getDefaultPersonalSettings(), ...patch }), undefined, JSON.stringify(patch).slice(0, 100));
  const valid = validate({ ...getDefaultPersonalSettings(), timeZone: 'Asia/Seoul', disabledPluginIds: ['notes'],
    avatarDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4e8AAAAASUVORK5CYII=' });
  assert.equal(valid.timeZone, 'Asia/Seoul');
});

test('initialization is lazy, inherits legacy data, and repeated loads keep a single revision', async t => {
  const f = fixture(t);
  assert.equal(f.row('SELECT COUNT(*) AS n FROM personal_settings').n, 0);
  const [a, b] = await Promise.all([db.loadPersonalSettings(), db.loadPersonalSettings()]);
  assert.deepEqual(a, b); assert.deepEqual(a.dailyMinutes, [420, 420, 420, 420, 420, 420, 420]);
  assert.equal(a.focusStart, '10:00'); assert.equal(a.focusEnd, '14:30');
  assert.equal(f.row('SELECT COUNT(*) AS n FROM personal_settings_history').n, 1);
  assert.equal(f.row('SELECT daily_minutes FROM user_capacity').daily_minutes, 420);
});

test('save commits the current settings and each ordered snapshot atomically', async t => {
  const f = fixture(t); const defaults = await db.loadPersonalSettings();
  const draft = { ...defaults, displayName: 'First' };
  const first = db.savePersonalSettings(draft);
  draft.displayName = 'Mutated draft';
  const second = db.savePersonalSettings({ ...defaults, displayName: 'Second' });
  await Promise.all([first, second]);
  assert.equal((await db.loadPersonalSettings()).displayName, 'Second');
  const history = await db.loadPersonalSettingsHistory();
  assert.deepEqual(history.map(row => [row.revision, row.settings.displayName]), [[3, 'Second'], [2, 'First'], [1, '']]);
  assert.equal(f.row('SELECT revision FROM personal_settings').revision, 3);
});

test('failed initialization and failed snapshot writes roll back; queues recover', async t => {
  const f = fixture(t); f.fail(1);
  await assert.rejects(db.loadPersonalSettings(), /injected/);
  assert.equal(f.row('SELECT COUNT(*) AS n FROM personal_settings').n, 0);
  f.fail(-1); const before = await db.loadPersonalSettings();
  f.fail(1);
  await assert.rejects(db.savePersonalSettings({ ...before, displayName: 'Failed' }), /injected/);
  assert.deepEqual(await db.loadPersonalSettings(), before);
  assert.equal(f.row('SELECT COUNT(*) AS n FROM personal_settings_history').n, 1);
  f.fail(-1); await db.savePersonalSettings({ ...before, displayName: 'Recovered' });
  assert.equal((await db.loadPersonalSettings()).displayName, 'Recovered');
});

test('invalid and future persisted profiles remain untouched on load and save', async t => {
  const f = fixture(t); await db.loadPersonalSettings();
  for (const value of [{ ...getDefaultPersonalSettings(), schemaVersion: 9 }, { ...getDefaultPersonalSettings(), extra: 'keep me' }]) {
    const encoded = JSON.stringify(value);
    f.sqlite.prepare('UPDATE personal_settings SET settings_json=?').run(encoded);
    await assert.rejects(db.loadPersonalSettings());
    await assert.rejects(db.savePersonalSettings(getDefaultPersonalSettings()));
    assert.equal(f.row('SELECT settings_json FROM personal_settings').settings_json, encoded);
    assert.equal(f.row('SELECT COUNT(*) AS n FROM personal_settings_history').n, 1);
  }
});

test('store publishes only persisted settings and exposes failures without replacing a profile', async t => {
  const f = fixture(t); await store.getState().load();
  assert.equal(store.getState().loaded, true);
  assert.equal(store.getState().settings.dailyMinutes[0], 420);
  const before = store.getState().settings; f.fail(1);
  await assert.rejects(store.getState().save({ ...before, displayName: 'Failed' }), /injected/);
  assert.deepEqual(store.getState().settings, before); assert.equal(store.getState().error, null);
  await assert.rejects(store.getState().save({ ...before, focusMinutes: 0 }));
  assert.equal(store.getState().error, null);
  f.fail(-1);
  await Promise.all([store.getState().save({ ...before, displayName: 'One' }), store.getState().save({ ...before, displayName: 'Two' })]);
  assert.equal(store.getState().settings.displayName, 'Two'); assert.equal(store.getState().error, null);
  f.sqlite.exec("UPDATE personal_settings SET schema_version=9");
  await store.getState().load();
  assert.equal(store.getState().settings.displayName, 'Two'); assert.match(store.getState().error, /Unsupported/);
});
