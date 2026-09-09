/** Session cache shared by all instances of a feed; failed refreshes retain articles. */
export function createFeedCache<T>(
  ttlMs = 15 * 60_000,
  retryMs = 60_000,
  now: () => number = Date.now,
) {
  const entries = new Map<string, { data: T[]; nextRefresh: number; pending?: Promise<T[]> }>();

  return {
    peek(key: string): T[] {
      return entries.get(key)?.data ?? [];
    },
    load(key: string, fetchItems: () => Promise<T[]>): Promise<T[]> {
      let entry = entries.get(key);
      if (entry?.pending) return entry.pending;
      if (entry && now() < entry.nextRefresh) return Promise.resolve(entry.data);
      if (!entry) {
        entry = { data: [], nextRefresh: 0 };
        entries.set(key, entry);
      }
      const current = entry;
      current.pending = Promise.resolve().then(fetchItems).then(items => {
        // RSS endpoints can return an HTML/cookie gate with HTTP 200 and no articles.
        if (items.length === 0) throw new Error('Feed returned no articles');
        current.data = items;
        current.nextRefresh = now() + ttlMs;
        return items;
      }).catch(() => {
        current.nextRefresh = now() + retryMs;
        return current.data;
      }).finally(() => { current.pending = undefined; });
      return current.pending;
    },
  };
}
