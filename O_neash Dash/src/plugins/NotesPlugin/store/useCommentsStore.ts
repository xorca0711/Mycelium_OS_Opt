import { create } from 'zustand';
import type { CommentRow } from '../lib/notesDb';
import { loadComments, createComment, deleteComment, updateComment } from '../lib/notesDb';

interface CommentsStore {
  byDocument: Record<string, CommentRow[]>;
  activeByDocument: Record<string, string | null>;
  load:      (docId: string) => Promise<void>;
  add:       (docId: string, markId: string, body: string) => Promise<string>;
  remove:    (id: string) => Promise<void>;
  update:    (id: string, body: string) => Promise<void>;
  setActive: (docId: string, id: string | null) => void;
}

export const useCommentsStore = create<CommentsStore>((set, get) => ({
  byDocument: {},
  activeByDocument: {},
  load: async (docId) => {
    const comments = await loadComments(docId);
    set(s => ({ byDocument: { ...s.byDocument, [docId]: comments } }));
  },
  add: async (docId, markId, body) => {
    const id = await createComment(docId, markId, body);
    await get().load(docId);
    return id;
  },
  remove: async (id) => {
    await deleteComment(id);
    set(s => ({ byDocument: Object.fromEntries(Object.entries(s.byDocument).map(([docId, comments]) => [docId, comments.filter(c => c.id !== id)])) }));
  },
  update: async (id, body) => {
    await updateComment(id, body);
    set(s => ({ byDocument: Object.fromEntries(Object.entries(s.byDocument).map(([docId, comments]) => [docId, comments.map(c => c.id === id ? { ...c, body } : c)])) }));
  },
  setActive: (docId, id) => set(s => ({ activeByDocument: { ...s.activeByDocument, [docId]: id } })),
}));
