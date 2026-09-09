const pending = new Map<string, Promise<void>>();

/** Keep a session's reads and writes together, including both sides of a move. */
export function serializeSessionOperation<Args extends [string, ...unknown[]], Result>(
  operation: (...args: Args) => Promise<Result>,
  sessionIds: (...args: Args) => readonly string[] = (...args) => [args[0]],
): (...args: Args) => Promise<Result> {
  return (...args) => {
    const ids = [...new Set(sessionIds(...args))].sort();
    const predecessors = ids.map(id => pending.get(id) ?? Promise.resolve());
    const result = Promise.all(predecessors).then(() => operation(...args));
    const settled = result.then(() => undefined, () => undefined);

    // Reserve every session before yielding, so opposite moves cannot deadlock.
    for (const id of ids) pending.set(id, settled);
    void settled.then(() => {
      for (const id of ids) {
        if (pending.get(id) === settled) pending.delete(id);
      }
    });
    return result;
  };
}
