export interface NoteChange {
  id: string;
  kind: 'created' | 'updated' | 'deleted' | 'promoted';
  linksChanged: boolean;
}
const listeners = new Set<(change: NoteChange) => void>();
/** Emitted only after persistence succeeds; consumers never observe half-written links. */
export function publishNoteChange(change: NoteChange): void {
  for (const listener of listeners) {
    try { listener(change); } catch (error) { console.error('Note change listener failed', error); }
  }
}
export function subscribeNoteChanges(listener: (change: NoteChange) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export async function commitNoteChange<T>(persist: () => Promise<T>, change: NoteChange): Promise<T> {
  const result = await persist();
  publishNoteChange(change);
  return result;
}
