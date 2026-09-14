import test from 'node:test';
import assert from 'node:assert/strict';
import { getWeatherLocation, setWeatherLocation, clearWeatherLocation, subscribeWeatherLocation } from '../src/home/weather/weatherLocation.ts';

function isolatedStorage() {
  const values = new Map();
  globalThis.window = new EventTarget();
  globalThis.localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
  return values;
}

test('weather location clear removes only its local key and updates mounted subscribers after persistence', () => {
  const values = isolatedStorage();
  values.set('unrelated-preference', 'keep');
  const observed = [];
  const unsubscribe = subscribeWeatherLocation(location => observed.push({ location, stored: getWeatherLocation() }));
  const sample = { name: 'Sample city', lat: 10, lon: 20 };
  setWeatherLocation(sample);
  clearWeatherLocation();
  assert.equal(getWeatherLocation(), null);
  assert.equal(values.get('unrelated-preference'), 'keep');
  assert.deepEqual(observed, [{ location: sample, stored: sample }, { location: null, stored: null }]);
  unsubscribe();
  setWeatherLocation(sample);
  assert.equal(observed.length, 2);
});

test('location consumers respond to cross-window storage changes and ignore unrelated keys', () => {
  const values = isolatedStorage();
  const observed = [];
  const unsubscribe = subscribeWeatherLocation(location => observed.push(location));
  const sample = { name: 'Another sample', lat: 30, lon: 40 };
  values.set('oneash-weather-location', JSON.stringify(sample));
  window.dispatchEvent(Object.assign(new Event('storage'), { key: 'other-key' }));
  assert.deepEqual(observed, []);
  window.dispatchEvent(Object.assign(new Event('storage'), { key: 'oneash-weather-location' }));
  values.clear();
  window.dispatchEvent(Object.assign(new Event('storage'), { key: null }));
  assert.deepEqual(observed, [sample, null]);
  unsubscribe();
});

test('a failed local removal does not announce that the saved location was cleared', () => {
  isolatedStorage();
  const sample = { name: 'Sample city', lat: 10, lon: 20 };
  setWeatherLocation(sample);
  const observed = [];
  const unsubscribe = subscribeWeatherLocation(location => observed.push(location));
  localStorage.removeItem = () => { throw new Error('storage unavailable'); };
  assert.throws(clearWeatherLocation, /storage unavailable/);
  assert.deepEqual(getWeatherLocation(), sample);
  assert.deepEqual(observed, []);
  unsubscribe();
});
