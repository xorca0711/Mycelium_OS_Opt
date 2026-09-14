import { create } from 'zustand';
import * as db from '../lib/notesDb';
import type { NoteRow } from '../lib/notesDb';
import { createAutosaveQueue, mergeDocumentRows, type SaveState } from '../lib/autosaveQueue';

interface DocumentDraft { title: string; contentJson: string; updatedAt?: string }
interface NotesStore {
  memos: NoteRow[];
  archivedMemos: NoteRow[];
  documents: NoteRow[];
  saveStates: Record<string, SaveState>;
  pendingOpenDocId: string | null;
  setPendingOpenDocId: (id: string | null) => void;
  loadMemos: () => Promise<void>;
  loadArchivedMemos: () => Promise<void>;
  loadDocuments: () => Promise<void>;
  ensureDocument: (id: string) => Promise<NoteRow | null>;
  flushDocument: (id: string) => Promise<void>;
  flushMemo: (id: string) => Promise<void>;
  flushAllDocuments: () => Promise<void>;
  createMemo: (content: string) => Promise<string>;
  createDocument: (title: string, arc_id?: string | null, project_id?: string | null) => Promise<string>;
  updateMemo: (id: string, content: string) => Promise<void>;
  updateDocument: (id: string, title: string, contentJson: string) => Promise<void>;
  archiveMemo: (id: string) => Promise<void>;
  restoreMemo: (id: string) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  promoteToDoc: (id: string, title: string, contentJson: string) => Promise<void>;
}

export const useNotesStore = create<NotesStore>((set, get) => {
  const revisions = new Map<string, number>();
  const deleted = new Set<string>();
  const deleting = new Set<string>();
  const loads = new Map<string, Promise<NoteRow | null>>();
  let loadSequence = 0;
  let memoLoadSequence = 0;
  let archiveLoadSequence = 0;
  const memoIds = new Set<string>();
  const touch = (id: string) => revisions.set(id, (revisions.get(id) ?? 0) + 1);
  const queue = createAutosaveQueue<DocumentDraft>({
    persist: async (id, draft) => {
      const note = await db.saveDocument(id, draft.title, draft.contentJson);
      return { title: note.title ?? '', contentJson: note.content_json ?? '{"type":"doc","content":[]}', updatedAt: note.updated_at };
    },
    onState: (id, state) => set(s => ({ saveStates: { ...s.saveStates, [id]: state } })),
    onCommitted: (id, draft, isLatest) => {
      if (!isLatest || deleted.has(id)) return;
      touch(id);
      set(s => ({ documents: s.documents.map(doc => doc.id === id ? {
        ...doc, title: draft.title, content_json: draft.contentJson, updated_at: draft.updatedAt ?? doc.updated_at,
      } : doc) }));
    },
  });
  const memoQueue = createAutosaveQueue<string>({
    persist: async (id, content) => { await db.updateNote(id, { content_plain: content }); return content; },
    onState: (id, state) => set(s => ({ saveStates: { ...s.saveStates, [id]: state } })),
    onCommitted: (id, content, isLatest) => {
      if (!isLatest || deleted.has(id)) return;
      touch(id);
      set(s => ({ memos: s.memos.map(memo => memo.id === id ? { ...memo, content_plain: content } : memo) }));
    },
  });
  return {
    memos: [], archivedMemos: [], documents: [], saveStates: {}, pendingOpenDocId: null,
    setPendingOpenDocId: id => set({ pendingOpenDocId: id }),
    loadMemos: async () => {
      const sequence = ++memoLoadSequence;
      const before = new Map(revisions);
      const loaded = await db.loadNotes('memo');
      if (sequence !== memoLoadSequence) return;
      const protectedIds = new Set(get().memos.filter(memo => memoQueue.isDirty(memo.id) || revisions.get(memo.id) !== before.get(memo.id)).map(memo => memo.id));
      set(s => ({ memos: mergeDocumentRows(loaded, s.memos, protectedIds, deleted) }));
    },
    loadArchivedMemos: async () => {
      const sequence = ++archiveLoadSequence;
      const loaded = await db.loadArchivedMemos();
      if (sequence === archiveLoadSequence) set({ archivedMemos: loaded.filter(memo => !deleted.has(memo.id)) });
    },
    loadDocuments: async () => {
      const sequence = ++loadSequence;
      const before = new Map(revisions);
      const loaded = await db.loadNotes('document');
      if (sequence !== loadSequence) return;
      const protectedIds = new Set(get().documents.filter(doc => queue.isDirty(doc.id) || revisions.get(doc.id) !== before.get(doc.id)).map(doc => doc.id));
      set(s => ({ documents: mergeDocumentRows(loaded, s.documents, protectedIds, deleted) }));
    },
    ensureDocument: async id => {
      if (deleted.has(id)) return null;
      const cached = get().documents.find(doc => doc.id === id);
      if (cached) return cached;
      const pending = loads.get(id);
      if (pending) return pending;
      const request = db.getNoteById(id).then(note => {
        if (!note || note.note_type !== 'document' || deleted.has(id)) return null;
        const latest = get().documents.find(doc => doc.id === id);
        if (latest) return latest;
        touch(id);
        set(s => ({ documents: [...s.documents, note] }));
        return note;
      }).finally(() => loads.delete(id));
      loads.set(id, request);
      return request;
    },
    flushDocument: id => queue.flush(id),
    flushMemo: id => memoQueue.flush(id),
    // Keep the public name for callers; all edited notes are drained before backup or close.
    flushAllDocuments: async () => {
      do {
        await Promise.all([...get().documents.map(doc => queue.flush(doc.id)), ...[...memoIds].map(id => memoQueue.flush(id))]);
      } while (Object.values(get().saveStates).some(state => state.status !== 'saved'));
    },
    createMemo: async content => {
      const id = await db.createNote({ note_type: 'memo', title: null, content_plain: content, content_json: null, arc_id: null, project_id: null });
      await get().loadMemos();
      return id;
    },
    createDocument: async (title, arc_id = null, project_id = null) => {
      const id = await db.createNote({ note_type: 'document', title, content_plain: null, content_json: null, arc_id, project_id });
      await get().ensureDocument(id);
      return id;
    },
    updateMemo: (id, content) => {
      if (deleted.has(id) || deleting.has(id)) return Promise.reject(new Error('The memo is being deleted.'));
      const current = get().memos.find(memo => memo.id === id);
      if (!current) return Promise.reject(new Error('Load the active memo before editing it.'));
      if (current.content_plain === content) return Promise.resolve();
      memoIds.add(id);
      touch(id);
      set(s => ({ memos: s.memos.map(memo => memo.id === id ? { ...memo, content_plain: content } : memo) }));
      return memoQueue.enqueue(id, content);
    },
    updateDocument: (id, title, contentJson) => {
      if (deleted.has(id) || deleting.has(id)) return Promise.reject(new Error('The document is being deleted.'));
      const current = get().documents.find(doc => doc.id === id);
      if (!current) return Promise.reject(new Error('Load the document before editing it.'));
      if (current.title === title && current.content_json === contentJson) return Promise.resolve();
      touch(id);
      set(s => ({ documents: s.documents.map(doc => doc.id === id ? { ...doc, title, content_json: contentJson } : doc) }));
      return queue.enqueue(id, { title, contentJson });
    },
    archiveMemo: async id => {
      await memoQueue.flush(id);
      await db.archiveNote(id);
      await Promise.all([get().loadMemos(), get().loadArchivedMemos()]);
    },
    restoreMemo: async id => {
      await db.updateNote(id, { status: 'active' });
      await Promise.all([get().loadArchivedMemos(), get().loadMemos()]);
    },
    deleteNote: async id => {
      deleting.add(id);
      try {
        await Promise.all([queue.flush(id), memoQueue.flush(id)]);
        await db.deleteNote(id);
        deleted.add(id);
        touch(id);
        set(s => ({ documents: s.documents.filter(n => n.id !== id), memos: s.memos.filter(n => n.id !== id), archivedMemos: s.archivedMemos.filter(n => n.id !== id) }));
      } finally { deleting.delete(id); }
    },
    promoteToDoc: async (id, title, contentJson) => {
      await memoQueue.flush(id);
      await db.promoteToDocument(id, title, contentJson);
      await Promise.all([get().loadMemos(), get().ensureDocument(id)]);
    },
  };
});
