import { contentHash, type ImportPayload, type ImportRecord } from './model.ts';
export interface NotionOptions { token: string; source: string; type: 'page' | 'database' | 'data_source'; limit: number }
export interface ImportProgress { signal: AbortSignal; onProgress: (message: string) => void }
export type Fetcher = (url: string, init: RequestInit) => Promise<Response>;
export interface NotionPage { id: string; last_edited_time: string; url: string; properties: Record<string, unknown>; in_trash?: boolean }
const API = 'https://api.notion.com/v1';
const MAX_RESPONSE_BYTES = 12_000_000;

async function readResponseText(response: Response, signal: AbortSignal): Promise<string> {
  signal.throwIfAborted();
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = '';
  let complete = false;
  try {
    while (true) {
      signal.throwIfAborted();
      const chunk = await reader.read();
      signal.throwIfAborted();
      if (chunk.done) { complete = true; return text + decoder.decode(); }
      bytes += chunk.value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) throw new Error('Notion response is too large. Select a smaller source.');
      text += decoder.decode(chunk.value, { stream: true });
    }
  } finally {
    if (!complete) await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export function notionId(input: string): string {
  let path = input.trim();
  if (/^https?:/i.test(path)) {
    const url = new URL(path);
    if (url.protocol !== 'https:' || !/(^|\.)(notion\.so|notion\.site)$/.test(url.hostname)) throw new Error('Use a Notion HTTPS page/database URL or its UUID.');
    path = url.pathname;
  }
  const match = path.match(/([a-f\d]{8}-?[a-f\d]{4}-?[a-f\d]{4}-?[a-f\d]{4}-?[a-f\d]{12})\/?$/i);
  if (!match) throw new Error('A Notion page, database or data-source ID is required. The view ID is not a source ID.');
  const raw = match[1].replace(/-/g, '').toLowerCase();
  return `${raw.slice(0,8)}-${raw.slice(8,12)}-${raw.slice(12,16)}-${raw.slice(16,20)}-${raw.slice(20)}`;
}
export function abortableDelay(ms: number, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const done = () => { signal.removeEventListener('abort', abort); resolve(); };
    const timer = setTimeout(done, ms);
    const abort = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); reject(new DOMException('Import cancelled.', 'AbortError')); };
    signal.addEventListener('abort', abort, { once: true });
  });
}
export class NotionClient {
  private nextRequest = 0;
  private readonly token: string;
  private readonly fetcher: Fetcher;
  private readonly progress: ImportProgress;
  private readonly delay: typeof abortableDelay;
  private readonly now: () => number;
  constructor(token: string, fetcher: Fetcher, progress: ImportProgress,
    delay = abortableDelay, now = Date.now) {
    if (!token.trim() || token.length > 512 || /\s/.test(token)) throw new Error('Enter a valid Notion connection token.');
    this.token = token;
    this.fetcher = fetcher;
    this.progress = progress;
    this.delay = delay;
    this.now = now;
  }
  async request<T>(path: string, body?: object): Promise<T> {
    const { signal, onProgress } = this.progress;
    for (let attempt = 0; attempt < 5; attempt++) {
      signal.throwIfAborted();
      await this.delay(Math.max(0, this.nextRequest - this.now()), signal);
      signal.throwIfAborted();
      this.nextRequest = this.now() + 550;
      const controller = new AbortController();
      const abort = () => controller.abort();
      signal.addEventListener('abort', abort, { once: true });
      const timer = setTimeout(abort, 30_000);
      let response: Response | undefined;
      try {
        response = await this.fetcher(`${API}${path}`, {
          method: body ? 'POST' : 'GET', signal: controller.signal,
          headers: { Authorization: `Bearer ${this.token}`, 'Notion-Version': '2026-03-11', 'Content-Type': 'application/json' },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
        controller.signal.throwIfAborted();
        if (response.ok) {
          const text = await readResponseText(response, controller.signal);
          controller.signal.throwIfAborted();
          try { return JSON.parse(text) as T; } catch { throw new Error('Notion returned an unreadable response. Retry later.'); }
        }
      } catch (error) {
        if (signal.aborted) throw new DOMException('Import cancelled.', 'AbortError');
        if (error instanceof Error && error.message.startsWith('Notion ')) throw error;
        throw new Error('The Notion request failed or timed out. Check the connection and retry the preview.');
      } finally {
        clearTimeout(timer);
        signal.removeEventListener('abort', abort);
        if (response && !response.bodyUsed) await response.body?.cancel().catch(() => undefined);
      }
      if ([429, 529, 500, 502, 503, 504].includes(response.status) && attempt < 4) {
        const header = response.headers.get('Retry-After');
        const seconds = header && /^\d+$/.test(header) ? Number(header) : 0;
        const wait = Math.max(seconds * 1000, 1000 * 2 ** attempt + Math.random() * 250);
        onProgress(`Notion is busy. Retrying after ${Math.ceil(wait / 1000)} seconds (attempt ${attempt + 2}/5).`);
        await this.delay(wait, signal);
        continue;
      }
      if (response.status === 401) throw new Error('Notion rejected the token. Check the connection token.');
      if (response.status === 403 || response.status === 404) throw new Error('Notion cannot read this source. Grant the connection Read content access and share this page/database with it.');
      throw new Error(`Notion request failed (HTTP ${response.status}). Check the source type or retry later.`);
    }
    throw new Error('Notion retry limit reached. Retry the preview later.');
  }
}
function plain(value: unknown): string {
  if (Array.isArray(value)) return value.map(plain).filter(Boolean).join(', ');
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    if (typeof object.plain_text === 'string') return object.plain_text;
    if (object.text && typeof object.text === 'object' && 'content' in object.text) return String(object.text.content);
    if (typeof object.name === 'string') return object.name;
    return JSON.stringify(value);
  }
  return value === null || value === undefined ? '' : String(value);
}
export function pageTitle(page: NotionPage): string {
  for (const value of Object.values(page.properties ?? {})) {
    if (value && typeof value === 'object' && 'type' in value && value.type === 'title' && 'title' in value) return plain(value.title) || 'Untitled';
  }
  return 'Untitled';
}
export async function fetchNotion(options: NotionOptions, progress: ImportProgress, fetcher: Fetcher, records: Map<string, ImportRecord>): Promise<{payloads: ImportPayload[]; warnings: string[]}> {
  if (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 100) throw new Error('Choose a batch size from 1 to 100 pages.');
  const source = notionId(options.source), client = new NotionClient(options.token, fetcher, progress);
  let pages: NotionPage[] = [];
  const warnings: string[] = [];
  if (options.type === 'page') pages = [await client.request<NotionPage>(`/pages/${source}`)];
  else {
    let sourceId = source;
    if (options.type === 'database') {
      const database = await client.request<{ data_sources?: { id: string; name: string }[] }>(`/databases/${source}`);
      if (!database.data_sources?.length) throw new Error('This database has no accessible data sources.');
      if (database.data_sources.length !== 1) throw new Error('This database has multiple data sources. Choose Data source and paste the specific data-source ID.');
      sourceId = notionId(database.data_sources[0].id);
    }
    let cursor: string | undefined;
    do {
      progress.onProgress(`Reading database rows (${pages.length}/${options.limit})…`);
      const result = await client.request<{ results: NotionPage[]; has_more: boolean; next_cursor: string | null }>(`/data_sources/${sourceId}/query`, {
        page_size: Math.min(100, options.limit - pages.length), ...(cursor ? { start_cursor: cursor } : {}),
        sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }],
      });
      if (!Array.isArray(result.results)) throw new Error('Notion returned an unreadable database response.');
      pages.push(...result.results);
      if (result.has_more && pages.length >= options.limit) warnings.push(`Batch limited to the ${options.limit} most recently edited rows. This is not a full database export. Use a smaller dedicated database or import individual pages for older rows.`);
      cursor = result.has_more ? result.next_cursor ?? undefined : undefined;
    } while (cursor && pages.length < options.limit);
  }
  const payloads: ImportPayload[] = [];
  let contentSize = 0;
  const addPayload = (payload: ImportPayload) => {
    contentSize += payload.content.length;
    if (payload.content.length > 1_000_000 || contentSize > 5_000_000) throw new Error('Notion content exceeds the preview size limit. Choose fewer pages or a smaller source.');
    payloads.push(payload);
  };
  const seen = new Set<string>();
  for (const page of pages) {
    progress.signal.throwIfAborted();
    const externalId = notionId(page.id);
    if (seen.has(externalId)) continue;
    seen.add(externalId);
    if (page.in_trash) { warnings.push('A page in Notion trash was skipped; local records were retained.'); continue; }
    const previous = records.get(externalId);
    progress.onProgress(`Reading page ${payloads.length + 1}/${pages.length}…`);
    // The previous canonical import is reused only when both metadata and local content remain unchanged.
    if (previous?.note_id && previous.source_updated_at === page.last_edited_time && previous.status === 'active') {
      if (await contentHash(previous.title, previous.content_plain, previous.content_json) === previous.content_hash) {
        addPayload({ externalId, title: previous.title ?? 'Untitled', content: previous.content_plain ?? '', updatedAt: page.last_edited_time });
        continue;
      }
    }
    const markdown = await client.request<{ markdown: string; truncated: boolean; unknown_block_ids: string[] }>(`/pages/${externalId}/markdown`);
    if (typeof markdown.markdown !== 'string' || markdown.truncated || markdown.unknown_block_ids?.length) {
      warnings.push(`Skipped “${pageTitle(page)}”: Notion returned incomplete or unsupported blocks. Existing local content was retained.`);
      continue;
    }
    const properties = Object.entries(page.properties ?? {}).map(([name, value]) => {
      const object = value && typeof value === 'object' ? value as Record<string, unknown> : {};
      if (object.has_more) warnings.push(`“${pageTitle(page)}”: property “${name}” has additional values; only the available property summary is copied.`);
      return `${name}: ${typeof object.type === 'string' ? plain(object[object.type]) : plain(value)}`;
    }).join('\n');
    const content = `${markdown.markdown}\n\n---\nNotion source: https://www.notion.so/${externalId.replace(/-/g, '')}\n\nProperties (source snapshot):\n${properties}`;
    addPayload({ externalId, title: pageTitle(page), content, updatedAt: page.last_edited_time || null });
  }
  return { payloads, warnings };
}
