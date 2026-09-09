import assert from 'node:assert/strict';
import test from 'node:test';
import { createFeedCache } from '../src/widgets/lib/feedCache.ts';

test('reuses fresh articles across callers and refreshes at TTL boundary', async () => {
  let time = 0, calls = 0;
  const cache = createFeedCache<string>(100, 10, () => time);
  const fetchItems = async () => [`article-${++calls}`];
  assert.deepEqual(await cache.load('news', fetchItems), ['article-1']);
  time = 99;
  assert.deepEqual(await cache.load('news', fetchItems), ['article-1']);
  assert.equal(calls, 1);
  time = 100;
  assert.deepEqual(await cache.load('news', fetchItems), ['article-2']);
});

test('concurrent mounts share one request and settled results remain cached', async () => {
  const cache = createFeedCache<string>();
  let finish!: (items: string[]) => void;
  let calls = 0;
  const fetchItems = () => { calls++; return new Promise<string[]>(resolve => { finish = resolve; }); };
  const first = cache.load('news', fetchItems);
  const second = cache.load('news', fetchItems);
  assert.equal(first, second);
  await Promise.resolve();
  assert.equal(calls, 1);
  finish(['shared']);
  assert.deepEqual(await second, ['shared']);
  assert.deepEqual(cache.peek('news'), ['shared']);
});

test('offline refresh preserves articles and retries after cooldown', async () => {
  let time = 0, failures = 0;
  const cache = createFeedCache<string>(100, 10, () => time);
  await cache.load('news', async () => ['saved']);
  time = 100;
  const offline = async () => { failures++; throw new Error('offline'); };
  assert.deepEqual(await cache.load('news', offline), ['saved']);
  time = 109;
  assert.deepEqual(await cache.load('news', offline), ['saved']);
  assert.equal(failures, 1);
  time = 110;
  assert.deepEqual(await cache.load('news', async () => ['recovered']), ['recovered']);
});

test('empty/cookie-gated responses cannot erase articles from one source', async () => {
  let time = 0;
  const cache = createFeedCache<string>(100, 10, () => time);
  await cache.load('Nature', async () => ['paper']);
  await cache.load('Cell', async () => ['cell-paper']);
  time = 100;
  assert.deepEqual(await cache.load('Nature', async () => []), ['paper']);
  assert.deepEqual(await cache.load('Cell', async () => ['new-cell-paper']), ['new-cell-paper']);
});

test('cold failure is recoverable and does not leave a rejected in-flight entry', async () => {
  let time = 0;
  const cache = createFeedCache<string>(100, 10, () => time);
  assert.deepEqual(await cache.load('news', () => { throw new Error('network'); }), []);
  time = 10;
  assert.deepEqual(await cache.load('news', async () => ['online']), ['online']);
});
