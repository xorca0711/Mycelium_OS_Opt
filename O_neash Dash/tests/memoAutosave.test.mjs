import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const turn = () => new Promise(resolve => setImmediate(resolve));
const base = { id: 'memo', note_type: 'memo', title: null, content_plain: 'Original', content_json: null, status: 'active' };

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.includes('/NotesPlugin/store/useNotesStore.ts')) {
      if (specifier === '../lib/notesDb') return { url: 'memo-test:database', shortCircuit: true };
      if (specifier === '../lib/autosaveQueue') return nextResolve(new URL('../lib/autosaveQueue.ts', context.parentURL).href, context);
    }
    if (context.parentURL?.includes('/store/useDataMaintenanceStore.ts') && specifier.includes('useNotesStore')) return { url: 'memo-test:notes-store', shortCircuit: true };
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === 'memo-test:database') return { format: 'module', shortCircuit: true, source: ['loadNotes', 'loadArchivedMemos', 'updateNote', 'archiveNote', 'deleteNote', 'promoteToDocument', 'saveDocument'].map(name => `export const ${name} = (...args) => globalThis.__memoTestDb.${name}(...args);`).join('\n') };
    if (url === 'memo-test:notes-store') return { format: 'module', shortCircuit: true, source: 'export const useNotesStore = globalThis.__memoTestStore;' };
    return nextLoad(url, context);
  },
});

test('maintenance drains queued memo revisions before touching workspace files', async () => {
  const writes = [];
  globalThis.__memoTestDb = { updateNote: (id, patch) => { const write = deferred(); writes.push({ id, patch, ...write }); return write.promise; } };
  const { useNotesStore: store } = await import('../src/plugins/NotesPlugin/store/useNotesStore.ts?memo-maintenance');
  store.setState({ memos: [base] });
  globalThis.__memoTestStore = store;
  const { runDataMaintenance, useDataMaintenanceStore } = await import('../src/store/useDataMaintenanceStore.ts?memo-maintenance');
  const first = store.getState().updateMemo('memo', 'First');
  let backedUp = false;
  const backup = runDataMaintenance('Synthetic backup', async () => { backedUp = true; });
  assert.equal(writes.length, 1);
  assert.equal(backedUp, false);
  assert.equal(useDataMaintenanceStore.getState().busy, true);
  const newest = store.getState().updateMemo('memo', 'Newest');
  writes[0].resolve();
  await first;
  await turn();
  assert.equal(writes.length, 2);
  assert.equal(backedUp, false);
  assert.equal(store.getState().memos[0].content_plain, 'Newest');
  writes[1].resolve();
  await Promise.all([newest, backup]);
  assert.equal(backedUp, true);
  assert.equal(useDataMaintenanceStore.getState().busy, false);
  assert.equal(store.getState().saveStates.memo.status, 'saved');
});

test('failed memo flush retains the shared draft across reload and blocks maintenance until retry succeeds', async () => {
  let fails = true;
  globalThis.__memoTestDb = { updateNote: async () => { if (fails) throw new Error('synthetic disk failure'); }, loadNotes: async () => [base] };
  const { useNotesStore: store } = await import('../src/plugins/NotesPlugin/store/useNotesStore.ts?memo-failure');
  store.setState({ memos: [base] });
  const pending = store.getState().updateMemo('memo', 'Retained draft');
  const rejected = assert.rejects(pending, /disk failure/);
  await assert.rejects(store.getState().flushAllDocuments(), /disk failure/);
  await rejected;
  await turn();
  await store.getState().loadMemos();
  assert.equal(store.getState().memos[0].content_plain, 'Retained draft');
  assert.equal(store.getState().saveStates.memo.status, 'error');
  fails = false;
  await store.getState().flushAllDocuments();
  assert.equal(store.getState().saveStates.memo.status, 'saved');
});

test('stale memo hydration cannot replace a later committed draft', async () => {
  const stale = deferred();
  globalThis.__memoTestDb = { updateNote: async () => {}, loadNotes: () => stale.promise };
  const { useNotesStore: store } = await import('../src/plugins/NotesPlugin/store/useNotesStore.ts?memo-hydration');
  store.setState({ memos: [base] });
  const reload = store.getState().loadMemos();
  const changed = store.getState().updateMemo('memo', 'Saved after load began');
  await store.getState().flushMemo('memo');
  await changed;
  stale.resolve([base]);
  await reload;
  assert.equal(store.getState().memos[0].content_plain, 'Saved after load began');
});

test('archive and delete wait for pending memo autosaves before changing note lifecycle', async () => {
  const write = deferred();
  const actions = [];
  globalThis.__memoTestDb = {
    updateNote: () => write.promise,
    archiveNote: async id => actions.push(`archive:${id}`),
    loadNotes: async () => [], loadArchivedMemos: async () => [{ ...base, status: 'archived' }],
    deleteNote: async id => actions.push(`delete:${id}`),
  };
  const { useNotesStore: store } = await import('../src/plugins/NotesPlugin/store/useNotesStore.ts?memo-archive');
  store.setState({ memos: [base] });
  const save = store.getState().updateMemo('memo', 'Before archive');
  const archive = store.getState().archiveMemo('memo');
  assert.deepEqual(actions, []);
  write.resolve();
  await Promise.all([save, archive]);
  assert.deepEqual(actions, ['archive:memo']);
  await store.getState().deleteNote('memo');
  assert.deepEqual(actions, ['archive:memo', 'delete:memo']);
  await store.getState().flushAllDocuments();
});
