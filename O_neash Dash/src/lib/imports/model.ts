export interface ImportSource { kind: string; sourceId: string; label: string }
export interface ImportPayload { externalId: string; title: string; content: string; updatedAt: string | null }
export interface ImportItem extends ImportPayload {
  action: 'create' | 'update' | 'unchanged' | 'conflict' | 'deleted';
  reason?: string;
  contentJson: string;
  hash: string;
}
export interface ImportPreview { source: ImportSource; items: ImportItem[]; warnings: string[]; created: number; updated: number; skipped: number }
export interface ImportResult { created: number; updated: number; skipped: number }
export interface ImportRecord {
  external_id: string; note_id: string | null; content_hash: string; source_updated_at: string | null;
  title: string | null; content_plain: string | null; content_json: string | null; status: string | null;
}
export function validatePayload(payload: ImportPayload): void {
  if (!payload.externalId.trim() || payload.externalId.length > 512) throw new Error('Every record needs a stable ID of 1–512 characters.');
  if (!payload.title.trim() || payload.title.length > 2000) throw new Error('Every record needs a title of 1–2,000 characters.');
  if (payload.content.length > 1_000_000) throw new Error(`Record ${payload.externalId} exceeds the one-million-character content limit.`);
}
/** Store markup as text nodes: remote HTML, scripts and image URLs are never executed. */
export function textDocument(text: string): string {
  const content = text.replace(/\r\n?/g, '\n').split('\n').map(line => ({
    type: 'paragraph', ...(line ? { content: [{ type: 'text', text: line }] } : {}),
  }));
  return JSON.stringify({ type: 'doc', content });
}
export async function contentHash(title: string | null, plain: string | null, json: string | null): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify([title ?? '', plain ?? '', json ?? '']));
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(byte => byte.toString(16).padStart(2, '0')).join('');
}
export async function classifyItem(payload: ImportPayload, previous?: ImportRecord): Promise<ImportItem> {
  validatePayload(payload);
  const contentJson = textDocument(payload.content);
  const hash = await contentHash(payload.title, payload.content, contentJson);
  const base = { ...payload, contentJson, hash };
  if (!previous) return { ...base, action: 'create' };
  if (!previous.note_id) return { ...base, action: 'deleted', reason: 'Previously imported note was deleted locally; it will not be recreated.' };
  if (previous.status !== 'active') return { ...base, action: 'conflict', reason: 'The local note is archived.' };
  const localHash = await contentHash(previous.title, previous.content_plain, previous.content_json);
  if (localHash !== previous.content_hash) return { ...base, action: 'conflict', reason: 'Local edits are preserved; no source changes will be applied to this note.' };
  return { ...base, action: hash === previous.content_hash ? 'unchanged' : 'update' };
}
export function countItems(items: ImportItem[]): ImportResult {
  const created = items.filter(item => item.action === 'create').length;
  const updated = items.filter(item => item.action === 'update').length;
  return { created, updated, skipped: items.length - created - updated };
}
