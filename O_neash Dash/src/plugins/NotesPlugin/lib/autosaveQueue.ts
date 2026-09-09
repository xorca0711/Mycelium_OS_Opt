export type SaveStatus = 'pending' | 'saving' | 'saved' | 'error';
export interface SaveState { status: SaveStatus; error?: string }
interface Snapshot<T> { value: T; revision: number }
interface Waiter { revision: number; resolve: () => void; reject: (error: unknown) => void }
interface Entry<T> {
  revision: number;
  settledRevision: number;
  pending?: Snapshot<T>;
  failed?: Snapshot<T>;
  running?: Promise<void>;
  timer?: ReturnType<typeof setTimeout>;
  waiters: Waiter[];
}

/** Coalesces typing bursts and never writes two revisions of one document concurrently. */
export function createAutosaveQueue<T>(options: {
  persist: (id: string, value: T) => Promise<T>;
  onState: (id: string, state: SaveState) => void;
  onCommitted?: (id: string, value: T, isLatest: boolean) => void;
  delayMs?: number;
}) {
  const entries = new Map<string, Entry<T>>();
  const entryFor = (id: string): Entry<T> => {
    let entry = entries.get(id);
    if (!entry) { entry = { revision: 0, settledRevision: 0, waiters: [] }; entries.set(id, entry); }
    return entry;
  };
  const waitFor = (entry: Entry<T>, revision: number) => new Promise<void>((resolve, reject) => {
    entry.waiters.push({ revision, resolve, reject });
  });
  function start(id: string, entry: Entry<T>): void {
    if (entry.running || !entry.pending) return;
    clearTimeout(entry.timer);
    const snapshot = entry.pending;
    entry.pending = undefined;
    options.onState(id, { status: 'saving' });
    entry.running = (async () => {
      try {
        const saved = await options.persist(id, snapshot.value);
        const isLatest = snapshot.revision === entry.revision;
        options.onCommitted?.(id, saved, isLatest);
        if (isLatest) options.onState(id, { status: 'saved' });
        for (const waiter of entry.waiters.filter(w => w.revision <= snapshot.revision)) waiter.resolve();
      } catch (error) {
        if (snapshot.revision === entry.revision) {
          entry.failed = snapshot;
          options.onState(id, { status: 'error', error: error instanceof Error ? error.message : String(error) });
        }
        for (const waiter of entry.waiters.filter(w => w.revision <= snapshot.revision)) waiter.reject(error);
      } finally {
        entry.settledRevision = snapshot.revision;
        entry.waiters = entry.waiters.filter(w => w.revision > snapshot.revision);
      }
    })().finally(() => {
      entry.running = undefined;
      if (entry.pending) start(id, entry);
    });
  }
  return {
    enqueue(id: string, value: T): Promise<void> {
      const entry = entryFor(id);
      entry.pending = { value, revision: ++entry.revision };
      entry.failed = undefined;
      options.onState(id, { status: 'pending' });
      clearTimeout(entry.timer);
      const result = waitFor(entry, entry.revision);
      if (!entry.running) entry.timer = setTimeout(() => start(id, entry), options.delayMs ?? 350);
      return result;
    },
    flush(id: string): Promise<void> {
      const entry = entries.get(id);
      if (!entry) return Promise.resolve();
      if (entry.failed) { entry.pending = entry.failed; entry.failed = undefined; }
      if (!entry.pending && entry.settledRevision === entry.revision) return Promise.resolve();
      if (!entry.pending && !entry.running) return Promise.resolve();
      const result = waitFor(entry, entry.revision);
      start(id, entry);
      return result;
    },
    isDirty(id: string): boolean {
      const entry = entries.get(id);
      return !!(entry?.pending || entry?.running || entry?.failed);
    },
  };
}

/** A delayed database read cannot replace a newer draft, including another editor's draft. */
export function mergeDocumentRows<T extends { id: string }>(
  loaded: T[], current: T[], protectedIds: ReadonlySet<string>, deletedIds: ReadonlySet<string>,
): T[] {
  const rows = new Map(loaded.filter(row => !deletedIds.has(row.id)).map(row => [row.id, row]));
  for (const row of current) {
    if (protectedIds.has(row.id) && !deletedIds.has(row.id)) rows.set(row.id, row);
  }
  return [...rows.values()];
}
