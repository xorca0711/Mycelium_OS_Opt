// Environment values exposed by Vite.

interface ImportMeta {
  readonly env: Record<string, string | boolean | undefined> & { DEV: boolean; PROD: boolean };
}
