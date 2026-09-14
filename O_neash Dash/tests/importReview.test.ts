import test from 'node:test';
import assert from 'node:assert/strict';
import { NotionClient, type Fetcher } from '../src/lib/imports/notionClient.ts';

const noDelay = async () => {};
const progress = (signal: AbortSignal) => ({ signal, onProgress: () => {} });

test('cancellation at the end of a rate-limit wait does not send a request', async () => {
  const abort = new AbortController();
  let calls = 0;
  const fetcher: Fetcher = async () => { calls++; return new Response('{}'); };
  const client = new NotionClient('synthetic-token', fetcher, progress(abort.signal), async () => { abort.abort(); });
  await assert.rejects(client.request('/pages/example'), { name: 'AbortError' });
  assert.equal(calls, 0);
});

test('cancellation during body reading cannot publish a successful response and releases the body', async () => {
  const abort = new AbortController();
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) { controller.enqueue(new TextEncoder().encode('{"result":"late"}')); abort.abort(); },
    cancel() { cancelled = true; },
  }, { highWaterMark: 0 });
  const client = new NotionClient('synthetic-token', async () => new Response(stream), progress(abort.signal), noDelay);
  await assert.rejects(client.request('/pages/example'), { name: 'AbortError' });
  assert.equal(cancelled, true);
});

test('retryable and rejected HTTP responses release unread native bodies', async () => {
  const aborted = new AbortController();
  let cancelled = 0;
  let calls = 0;
  const client = new NotionClient('synthetic-token', async () => {
    calls++;
    return new Response(new ReadableStream({ cancel() { cancelled++; } }), { status: calls === 1 ? 429 : 401 });
  }, progress(aborted.signal), noDelay);
  await assert.rejects(client.request('/pages/example'), /rejected the token/);
  assert.equal(calls, 2);
  assert.equal(cancelled, 2);
});

test('response byte limit stops streaming before an oversized body finishes', async () => {
  let pulls = 0;
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) { pulls++; controller.enqueue(new Uint8Array(4_000_001)); },
    cancel() { cancelled = true; },
  }, { highWaterMark: 0 });
  const client = new NotionClient('synthetic-token', async () => new Response(stream), progress(new AbortController().signal), noDelay);
  await assert.rejects(client.request('/pages/example'), /response is too large/);
  assert.equal(pulls, 3);
  assert.equal(cancelled, true);
});

test('stream decoding preserves multibyte text split across native chunks', async () => {
  const bytes = new TextEncoder().encode('{"title":"한글 😀"}');
  const stream = new ReadableStream<Uint8Array>({
    start(controller) { for (const byte of bytes) controller.enqueue(Uint8Array.of(byte)); controller.close(); },
  });
  const client = new NotionClient('synthetic-token', async () => new Response(stream), progress(new AbortController().signal), noDelay);
  assert.deepEqual(await client.request('/pages/example'), { title: '한글 😀' });
});

test('a stalled native request is aborted at the request timeout', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  let started!: () => void;
  const ready = new Promise<void>(resolve => { started = resolve; });
  let requestAborted = false;
  const client = new NotionClient('synthetic-token', async (_url, init) => {
    started();
    return new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => { requestAborted = true; reject(new DOMException('Request aborted', 'AbortError')); }, { once: true });
    });
  }, progress(new AbortController().signal), noDelay);
  const request = client.request('/pages/example');
  await ready;
  context.mock.timers.tick(30_000);
  await assert.rejects(request, /failed or timed out/);
  assert.equal(requestAborted, true);
});

test('a response arriving after cancellation has its unread body released', async () => {
  const abort = new AbortController();
  let cancelled = false;
  const client = new NotionClient('synthetic-token', async () => {
    abort.abort();
    return new Response(new ReadableStream({ cancel() { cancelled = true; } }));
  }, progress(abort.signal), noDelay);
  await assert.rejects(client.request('/pages/example'), { name: 'AbortError' });
  assert.equal(cancelled, true);
});
