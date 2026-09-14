import test from 'node:test';
import assert from 'node:assert/strict';
import { LOCAL_PREFERENCE_KEYS, collectLocalPreferences, applyRestoredPreferences } from '../src/lib/localPreferences.ts';

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}

test('backup captures only the native whitelist and includes null for absent preferences', () => {
  const source = storage({ 'oneash-font-main': 'Tamzen', 'unrelated-token': 'never copy', 'notes-recent-docs': '["note"]' });
  const snapshot = collectLocalPreferences(source);
  assert.deepEqual(Object.keys(snapshot), [...LOCAL_PREFERENCE_KEYS]);
  assert.equal(snapshot['oneash-font-main'], 'Tamzen');
  assert.equal(snapshot['oneash-weather-location'], null);
  assert.equal('unrelated-token' in snapshot, false);
  assert.equal('notes-recent-docs' in snapshot, false);
});

test('restore updates explicit keys, clears null values, and retains unrelated preferences', () => {
  const target = storage({ 'oneash-font-main': 'VT323', 'oneash-weather-location': 'old-city', unrelated: 'keep', 'oneash-font-kr': 'Gulim' });
  applyRestoredPreferences({ 'oneash-font-main': 'Tamzen', 'oneash-weather-location': null }, target);
  assert.equal(target.getItem('oneash-font-main'), 'Tamzen');
  assert.equal(target.getItem('oneash-weather-location'), null);
  assert.equal(target.getItem('oneash-font-kr'), 'Gulim');
  assert.equal(target.getItem('unrelated'), 'keep');
});

test('invalid or oversized handoffs are rejected before touching storage', () => {
  const target = storage({ 'oneash-font-main': 'VT323' });
  assert.throws(() => applyRestoredPreferences({ 'oneash-font-main': 'Tamzen', bad: 'value' }, target), /Unsupported/);
  assert.throws(() => applyRestoredPreferences({ 'oneash-widgets-v3': 'x'.repeat(128 * 1024 + 1) }, target), /size limit/);
  assert.throws(() => applyRestoredPreferences({ 'oneash-widgets-v3': '한'.repeat(45000) }, target), /size limit/);
  assert.throws(() => applyRestoredPreferences({ 'oneash-font-main': 123 }, target), /Invalid/);
  assert.equal(target.getItem('oneash-font-main'), 'VT323');
});

test('storage failure rolls back earlier writes so retry can use the same handoff', () => {
  const target = storage({ 'oneash-font-main': 'VT323', 'oneash-font-kr': 'Gulim' });
  const write = target.setItem;
  target.setItem = (key, value) => {
    if (key === 'oneash-font-kr' && value === 'HBIOS-SYS') throw new Error('quota exceeded');
    write(key, value);
  };
  assert.throws(() => applyRestoredPreferences({ 'oneash-font-main': 'Tamzen', 'oneash-font-kr': 'HBIOS-SYS' }, target), /Previous preferences were retained/);
  assert.equal(target.getItem('oneash-font-main'), 'VT323');
  assert.equal(target.getItem('oneash-font-kr'), 'Gulim');
  target.setItem = write;
  applyRestoredPreferences({ 'oneash-font-main': 'Tamzen', 'oneash-font-kr': 'HBIOS-SYS' }, target);
  assert.equal(target.getItem('oneash-font-main'), 'Tamzen');
  assert.equal(target.getItem('oneash-font-kr'), 'HBIOS-SYS');
});
