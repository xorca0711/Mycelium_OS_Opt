import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { pluginEnabled, filterAppCategories, analyticsSelection, formatHomeClock } from '../src/lib/personalFeaturePolicy.ts';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.includes('/src/')) {
      if (specifier.includes('usePersonalSettingsStore')) return { url: 'features-test:settings', shortCircuit: true };
      if (specifier === '@tauri-apps/plugin-http') return { url: 'features-test:http', shortCircuit: true };
      if (specifier.endsWith('/personalFeatures')) return nextResolve(new URL(specifier + '.tsx', context.parentURL).href, context);
      if (specifier.endsWith('/personalFeaturePolicy')) return nextResolve(new URL(specifier + '.ts', context.parentURL).href, context);
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === 'features-test:settings') return { format: 'module', shortCircuit: true,
      source: 'export const usePersonalSettingsStore = selector => selector(globalThis.__featureState); usePersonalSettingsStore.getState = () => globalThis.__featureState;' };
    if (url === 'features-test:http') return { format: 'module', shortCircuit: true,
      source: 'export const fetch = (...args) => globalThis.__featureFetch(...args);' };
    if (url.endsWith('/personalFeatures.tsx')) return { format: 'module', shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText };
    return nextLoad(url, context);
  },
});
const { FeedGate, canFetchFeed } = await import('../src/lib/personalFeatures.tsx');
const { fetchRandomQuote } = await import('../src/home/quote/quoteApi.ts');
const { geocodeCity, fetchCurrentWeather } = await import('../src/home/weather/weatherApi.ts');

function state() {
  return { loaded: true, error: null, settings: {
    disabledPluginIds: [], feeds: { news: true, research: true, weather: true, quotes: true }, analytics: { planner: true, sleep: true },
  } };
}

test('hidden modules disappear from categories; Settings and Home survive malformed disable lists or load failure', () => {
  const categories = [{ id: 'basic', apps: [{ pluginId: 'notes' }, { pluginId: 'settings' }] }, { id: 'games', apps: [{ pluginId: 'snake' }] }];
  const disabled = ['notes', 'snake', 'settings'];
  assert.deepEqual(filterAppCategories(categories, disabled), [{ id: 'basic', apps: [{ pluginId: 'settings' }] }]);
  assert.equal(categories[0].apps.length, 2, 'saved navigation definitions are not mutated');
  assert.equal(pluginEnabled('notes', disabled), false);
  assert.equal(pluginEnabled('planner', [], false), false);
  assert.equal(pluginEnabled('settings', disabled, false), true);
  assert.equal(pluginEnabled(null, disabled, false), true);
});

test('disabled analytics cannot participate through a stale combined selection', () => {
  const selected = new Set(['planner', 'sleep', 'journal']);
  assert.equal(analyticsSelection(selected, { planner: true, sleep: true }, true), 'combined');
  assert.equal(analyticsSelection(selected, { planner: false, sleep: true }, true), 'sleep');
  assert.equal(analyticsSelection(selected, { planner: true, sleep: false }, true), 'planner');
  assert.equal(analyticsSelection(selected, { planner: false, sleep: false }, true), null);
  assert.equal(analyticsSelection(selected, { planner: true, sleep: true }, false), null);
});

test('clock date and time follow the chosen zone at a KST midnight boundary', () => {
  const now = new Date('2026-09-08T15:05:06Z');
  const seoul = formatHomeClock(now, 'Asia/Seoul', 'en-US');
  const utc = formatHomeClock(now, 'UTC', 'en-US');
  assert.equal(seoul.time, '00:05:06');
  assert.match(seoul.date, /September 9, 2026/);
  assert.equal(utc.time, '15:05:06');
  assert.match(utc.date, /September 8, 2026/);
  assert.match(formatHomeClock(now, 'Asia/Seoul', 'ko-KR').date, /2026년 9월 9일/);
  assert.equal(now.toISOString(), '2026-09-08T15:05:06.000Z', 'formatting does not shift stored timestamps');
});

test('feed gate does not render its child before load, on load error, or when switched off', () => {
  globalThis.__featureState = state();
  let mounts = 0;
  const Child = () => { mounts++; return createElement('span', null, 'feed'); };
  const render = () => renderToStaticMarkup(createElement(FeedGate, { feature: 'news' }, createElement(Child)));
  globalThis.__featureState.loaded = false;
  assert.equal(render(), '');
  globalThis.__featureState.loaded = true;
  globalThis.__featureState.error = 'invalid profile';
  assert.equal(render(), '');
  globalThis.__featureState.error = null;
  globalThis.__featureState.settings.feeds.news = false;
  assert.equal(render(), '');
  assert.equal(mounts, 0);
  globalThis.__featureState.settings.feeds.news = true;
  assert.match(render(), /feed/);
  assert.equal(mounts, 1);
});

test('network boundaries and deferred request decisions observe updated switches', async () => {
  globalThis.__featureState = state();
  let requests = 0;
  globalThis.__featureFetch = async () => { requests++; return { ok: true, json: async () => ['quote'] }; };
  assert.equal(canFetchFeed('research'), true);
  globalThis.__featureState.settings.feeds.research = false;
  await Promise.resolve();
  assert.equal(canFetchFeed('research'), false, 'a retry must see the current setting');
  globalThis.__featureState.settings.feeds.quotes = false;
  globalThis.__featureState.settings.feeds.weather = false;
  await fetchRandomQuote();
  assert.deepEqual(await geocodeCity('Seoul'), []);
  assert.equal(await fetchCurrentWeather(37, 127), null);
  assert.equal(requests, 0);
  globalThis.__featureState.settings.feeds.quotes = true;
  assert.equal((await fetchRandomQuote()).text, 'quote');
  assert.equal(requests, 1);
});
