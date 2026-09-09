export function createCloseGuard(options: {
  hasPending: () => boolean;
  flush: () => Promise<void>;
  destroy: () => Promise<void>;
  onError: (error: unknown) => void;
  isDisposed?: () => boolean;
}): (event: { preventDefault: () => void }) => Promise<void> {
  let closing = false;
  return async event => {
    if (options.isDisposed?.()) return;
    if (!closing && !options.hasPending()) return;
    event.preventDefault();
    if (closing) return;
    closing = true;
    try {
      do { await options.flush(); } while (options.hasPending());
      if (!options.isDisposed?.()) await options.destroy();
    } catch (error) {
      options.onError(error);
    } finally { closing = false; }
  };
}
