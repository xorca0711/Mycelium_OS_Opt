import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { createAutosaveQueue, mergeDocumentRows } from '../src/plugins/NotesPlugin/lib/autosaveQueue.ts';
import { prepareDocumentLinks, resolveWikiTarget } from '../src/plugins/NotesPlugin/lib/noteLinks.ts';
import { commitNoteChange, subscribeNoteChanges } from '../src/plugins/NotesPlugin/lib/noteEvents.ts';
import { createCloseGuard } from '../src/plugins/NotesPlugin/lib/closeGuard.ts';

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const turn = () => new Promise(resolve => setImmediate(resolve));
const content = attrs => JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'wikiLink', attrs }] }] });

test('typing is coalesced, per-note writes serialize, and an old result never becomes latest', async () => {
  const writes = [], commits = [];
  const queue = createAutosaveQueue({
    delayMs: 10000,
    onState() {},
    persist: (id, value) => { const pending = deferred(); writes.push({ id, value, ...pending }); return pending.promise; },
    onCommitted: (id, value, latest) => commits.push({ value, latest }),
  });
  const first = queue.enqueue('a', 'first');
  const flushFirst = queue.flush('a');
  const skipped = queue.enqueue('a', 'intermediate');
  const newest = queue.enqueue('a', 'newest');
  const flushNewest = queue.flush('a');
  assert.deepEqual(writes.map(w => w.value), ['first']);
  writes[0].resolve('first');
  await first;
  await turn();
  assert.deepEqual(writes.map(w => w.value), ['first', 'newest']);
  writes[1].resolve('newest');
  await Promise.all([skipped, newest, flushFirst, flushNewest]);
  await queue.flush('a'); // already settled flush must not hang
  assert.deepEqual(commits, [{ value: 'first', latest: false }, { value: 'newest', latest: true }]);
});

test('a failed latest save remains retryable and does not poison the queue', async () => {
  let attempts = 0;
  const states = [];
  const queue = createAutosaveQueue({ delayMs: 10000, onState: (_, state) => states.push(state.status), persist: async (_, value) => {
    if (++attempts === 1) throw new Error('disk unavailable');
    return value;
  } });
  const pending = queue.enqueue('a', 'draft');
  const pendingFailure = assert.rejects(pending, /disk unavailable/);
  await assert.rejects(queue.flush('a'), /disk unavailable/);
  await pendingFailure;
  await turn();
  assert.equal(queue.isDirty('a'), true);
  await queue.flush('a');
  await turn();
  assert.equal(queue.isDirty('a'), false);
  assert.deepEqual(states, ['pending', 'saving', 'error', 'saving', 'saved']);
});

test('different notes can save independently without waiting for a slow note', async () => {
  const slow = deferred();
  const queue = createAutosaveQueue({ delayMs: 10000, onState() {}, persist: (id, value) => id === 'slow' ? slow.promise : Promise.resolve(value) });
  const a = queue.enqueue('slow', 'A');
  const af = queue.flush('slow');
  const b = queue.enqueue('fast', 'B');
  await queue.flush('fast');
  await b;
  assert.equal(queue.isDirty('slow'), true);
  slow.resolve('A');
  await Promise.all([a, af]);
});

test('late database hydration preserves dirty drafts and does not resurrect deleted notes', () => {
  assert.deepEqual(mergeDocumentRows(
    [{ id: 'draft', title: 'old' }, { id: 'deleted', title: 'old' }, { id: 'new', title: 'loaded' }],
    [{ id: 'draft', title: 'latest' }], new Set(['draft']), new Set(['deleted']),
  ), [{ id: 'draft', title: 'latest' }, { id: 'new', title: 'loaded' }]);
});

test('stable IDs survive a rename and never bind to another note with the old title', () => {
  const json = content({ title: 'Original', targetId: 'one' });
  const docs = [{ id: 'one', title: 'Renamed' }, { id: 'two', title: 'Original' }];
  const prepared = prepareDocumentLinks('source', json, docs);
  assert.deepEqual(prepared.targetIds, ['one']);
  assert.equal(resolveWikiTarget({ title: 'Original', targetId: 'missing' }, docs), null);
});

test('legacy links gain IDs through unique title aliases, while ambiguous titles remain unresolved', () => {
  const docs = [{ id: 'one', title: 'Renamed', aliases: ['Original'] }];
  const prepared = prepareDocumentLinks('source', content({ title: 'Original' }), docs);
  assert.deepEqual(prepared.targetIds, ['one']);
  assert.equal(JSON.parse(prepared.contentJson).content[0].content[0].attrs.targetId, 'one');
  assert.equal(resolveWikiTarget({ title: 'Original' }, [...docs, { id: 'two', title: 'Original' }]), null);
  assert.throws(() => prepareDocumentLinks('source', '{}', docs), /JSON document/);
});

test('note and link observers run only after successful atomic persistence', async () => {
  const notifications = [];
  const unsubscribe = subscribeNoteChanges(change => notifications.push(change));
  const write = deferred();
  const change = { id: 'source', kind: 'updated', linksChanged: true };
  const committed = commitNoteChange(() => write.promise, change);
  assert.deepEqual(notifications, []);
  write.resolve('saved');
  assert.equal(await committed, 'saved');
  assert.deepEqual(notifications, [change]);
  await assert.rejects(commitNoteChange(() => Promise.reject(new Error('rollback')), change), /rollback/);
  assert.equal(notifications.length, 1);
  unsubscribe();
});

test('close guard waits for all drafts, handles repeated close events, and leaves failed saves open', async () => {
  const write = deferred();
  let pending = true, prevented = 0, destroyed = 0;
  const errors = [];
  const guard = createCloseGuard({ hasPending: () => pending, flush: () => write.promise, destroy: async () => { destroyed++; }, onError: error => errors.push(error) });
  const event = { preventDefault() { prevented++; } };
  const closing = guard(event);
  await guard(event);
  assert.equal(prevented, 2);
  assert.equal(destroyed, 0);
  pending = false;
  write.resolve();
  await closing;
  assert.equal(destroyed, 1);
  const failure = createCloseGuard({ hasPending: () => true, flush: async () => { throw new Error('save failed'); }, destroy: async () => { destroyed++; }, onError: error => errors.push(error) });
  await failure(event);
  assert.equal(destroyed, 1);
  assert.match(errors[0].message, /save failed/);
  await guard(event); // no pending saves: native close proceeds without interception
  assert.equal(prevented, 3);
});

// Exercise the real Zustand store with an isolated persistence adapter, without Tauri or user files.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.includes('/NotesPlugin/lib/notesDb.ts')) {
      if (specifier === '@/lib/db') return { url: 'notes-test:sqlite', shortCircuit: true };
      if (specifier === './noteLinks' || specifier === './noteEvents') return nextResolve(new URL(specifier + '.ts', context.parentURL).href, context);
    }
    if (context.parentURL?.includes('/NotesPlugin/store/useNotesStore.ts')) {
      if (specifier === '../lib/notesDb') return { url: 'notes-test:database', shortCircuit: true };
      if (specifier === '../lib/autosaveQueue') return nextResolve(new URL('../lib/autosaveQueue.ts', context.parentURL).href, context);
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === 'notes-test:sqlite') return { format: 'module', shortCircuit: true, source: 'export const getDb = () => globalThis.__notesSqlite; export const executeBatch = statements => globalThis.__notesSqlite.executeBatch(statements);' };
    if (url === 'notes-test:database') return {
      format: 'module', shortCircuit: true,
      source: ['getNoteById', 'loadNotes', 'loadArchivedMemos', 'saveDocument', 'createNote', 'updateNote', 'archiveNote', 'deleteNote', 'promoteToDocument']
        .map(name => `export const ${name} = (...args) => globalThis.__notesTestDb.${name}(...args);`).join('\n'),
    };
    return nextLoad(url, context);
  },
});

test('normal/floating edits share latest state despite delayed writes and a stale reload', async () => {
  const base = { id: 'shared', note_type: 'document', title: 'Initial', content_json: '{"type":"doc","content":[]}', status: 'active', updated_at: 'old' };
  const reload = deferred();
  const writes = [];
  globalThis.__notesTestDb = {
    getNoteById: async () => base,
    loadNotes: () => reload.promise,
    saveDocument: (_, title, contentJson) => {
      const pending = deferred();
      writes.push({ ...pending, note: { ...base, title, content_json: contentJson, updated_at: 'new' } });
      return pending.promise;
    },
  };
  const { useNotesStore: store } = await import('../src/plugins/NotesPlugin/store/useNotesStore.ts?shared-edit-test');
  await store.getState().ensureDocument('shared');
  const normal = store.getState().updateDocument('shared', 'Normal editor', base.content_json);
  const flushNormal = store.getState().flushDocument('shared');
  const floating = store.getState().updateDocument('shared', 'Floating editor latest', base.content_json);
  const refresh = store.getState().loadDocuments();
  writes[0].resolve(writes[0].note);
  await normal;
  await turn();
  assert.equal(store.getState().documents[0].title, 'Floating editor latest');
  writes[1].resolve(writes[1].note);
  await Promise.all([floating, flushNormal]);
  reload.resolve([base]);
  await refresh;
  assert.equal(store.getState().documents[0].title, 'Floating editor latest');
  assert.equal(store.getState().saveStates.shared.status, 'saved');
  await store.getState().flushAllDocuments();
});

test('actual note persistence upgrades legacy links, preserves rename aliases, and rolls back note/link failures', async () => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE notes (id TEXT PRIMARY KEY, note_type TEXT, title TEXT, content_plain TEXT, content_json TEXT, arc_id TEXT, project_id TEXT,
      status TEXT DEFAULT 'active', pinned INTEGER DEFAULT 0, color_hex TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE note_links (source_id TEXT REFERENCES notes(id), target_id TEXT REFERENCES notes(id), PRIMARY KEY(source_id, target_id));
    CREATE TABLE note_title_aliases (target_id TEXT REFERENCES notes(id), title TEXT, PRIMARY KEY(target_id,title));
    CREATE TABLE doc_comments (id TEXT, doc_id TEXT);
  `);
  let failLinks = false;
  globalThis.__notesSqlite = {
    select: async (sql, values = []) => sqlite.prepare(sql).all(...values),
    execute: async (sql, values = []) => sqlite.prepare(sql).run(...values),
    executeBatch: async statements => {
      sqlite.exec('BEGIN');
      try {
        const results = statements.map(({ sql, values = [] }) => {
          if (failLinks && sql.startsWith('INSERT OR IGNORE INTO note_links')) throw new Error('injected link failure');
          return sqlite.prepare(sql).run(...values);
        });
        sqlite.exec('COMMIT');
        return results;
      } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  };
  const db = await import('../src/plugins/NotesPlugin/lib/notesDb.ts?sqlite-test');
  const create = title => db.createNote({ note_type: 'document', title, content_plain: null, content_json: null, arc_id: null, project_id: null });
  const target = await create('Original');
  const replacement = await create('Other');
  const source = await create('Source');
  await db.saveDocument(source, 'Source', content({ title: 'Original' }));
  assert.equal(JSON.parse((await db.getNoteById(source)).content_json).content[0].content[0].attrs.targetId, target);
  await db.saveDocument(target, 'Renamed', '{"type":"doc","content":[]}');
  await db.saveDocument(source, 'Source', content({ title: 'Original' }));
  assert.deepEqual((await db.loadAllLinks()).map(link => link.target_id), [target]);
  assert.equal(sqlite.prepare('SELECT title FROM note_title_aliases WHERE target_id = ?').get(target).title, 'Original');
  const before = await db.getNoteById(source);
  const notifications = [];
  const unsubscribe = subscribeNoteChanges(change => notifications.push(change));
  failLinks = true;
  await assert.rejects(db.saveDocument(source, 'Must roll back', content({ targetId: replacement, title: 'Other' })), /injected link failure/);
  assert.deepEqual(await db.getNoteById(source), before);
  assert.deepEqual((await db.loadAllLinks()).map(link => link.target_id), [target]);
  assert.equal(notifications.length, 0);
  unsubscribe();
  sqlite.close();
});
