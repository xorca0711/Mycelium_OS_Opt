import { getDb, executeBatch, type SqlStatement } from '../db';
import { invalidateDocumentCatalog } from '../../plugins/NotesPlugin/lib/notesDb';
import { publishNoteChange } from '../../plugins/NotesPlugin/lib/noteEvents';
import { useNotesStore } from '../../plugins/NotesPlugin/store/useNotesStore';
import { classifyItem, countItems, type ImportPayload, type ImportPreview, type ImportRecord, type ImportResult, type ImportSource } from './model.ts';

export async function loadImportRecords(source: ImportSource): Promise<Map<string, ImportRecord>> {
  const rows = await getDb().select<ImportRecord[]>(`SELECT r.external_id, r.note_id, r.content_hash, r.source_updated_at,
    n.title, n.content_plain, n.content_json, n.status FROM import_records r
    JOIN import_sources s ON s.id = r.source_id LEFT JOIN notes n ON n.id = r.note_id
    WHERE s.kind = ? AND s.source_id = ?`, [source.kind, source.sourceId]);
  return new Map(rows.map(row => [row.external_id, row]));
}
export async function buildPreview(source: ImportSource, payloads: ImportPayload[], warnings: string[] = []): Promise<ImportPreview> {
  if (!['notion', 'csv', 'json'].includes(source.kind) || !source.sourceId.trim() || source.sourceId.length > 512 || source.label.length > 2000) throw new Error('Choose a valid import source and label.');
  if (payloads.length > 500) throw new Error('Import at most 500 records per batch.');
  if (payloads.reduce((size, payload) => size + payload.content.length, 0) > 5_000_000) throw new Error('This batch exceeds five million content characters. Choose a smaller source or file.');
  if (new Set(payloads.map(payload => payload.externalId)).size !== payloads.length) throw new Error('The source contains duplicate record IDs.');
  const records = await loadImportRecords(source);
  const items = await Promise.all(payloads.map(payload => classifyItem(payload, records.get(payload.externalId))));
  return { source, items, warnings, ...countItems(items) };
}
/** Network is finished before this method. Note changes and provenance commit atomically. */
export async function applyImport(preview: ImportPreview): Promise<ImportResult> {
  const fresh = await buildPreview(preview.source, preview.items, preview.warnings);
  const sources = await getDb().select<{id: string}[]>(`SELECT id FROM import_sources WHERE kind = ? AND source_id = ?`, [fresh.source.kind, fresh.source.sourceId]);
  const sourceId = sources[0]?.id ?? crypto.randomUUID();
  const records = await loadImportRecords(fresh.source);
  const statements: SqlStatement[] = [];
  const changes: { id: string; kind: 'created' | 'updated'; linksChanged: boolean }[] = [];
  if (!sources.length) statements.push({ sql: `INSERT INTO import_sources (id, kind, source_id, label) VALUES (?, ?, ?, ?)`, values: [sourceId, fresh.source.kind, fresh.source.sourceId, fresh.source.label] });
  for (const item of fresh.items) {
    if (item.action === 'conflict' || item.action === 'deleted') continue;
    const previous = records.get(item.externalId);
    const noteId = previous?.note_id ?? crypto.randomUUID();
    if (item.action === 'create') {
      statements.push({ sql: `INSERT INTO notes (id, note_type, title, content_plain, content_json) VALUES (?, 'document', ?, ?, ?)`, values: [noteId, item.title, item.content, item.contentJson] });
      changes.push({ id: noteId, kind: 'created', linksChanged: false });
    } else if (item.action === 'update') {
      if (previous?.title && previous.title !== item.title) statements.push({ sql: `INSERT OR IGNORE INTO note_title_aliases (target_id, title) VALUES (?, ?)`, values: [noteId, previous.title] });
      statements.push({ sql: `UPDATE notes SET title = ?, content_plain = ?, content_json = ?, updated_at = STRFTIME('%Y-%m-%d %H:%M:%f', 'now') WHERE id = ?`, values: [item.title, item.content, item.contentJson, noteId] });
      changes.push({ id: noteId, kind: 'updated', linksChanged: false });
    }
    statements.push({ sql: `INSERT INTO import_records (source_id, external_id, note_id, content_hash, source_updated_at) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(source_id, external_id) DO UPDATE SET note_id = excluded.note_id, content_hash = excluded.content_hash,
      source_updated_at = excluded.source_updated_at, imported_at = CURRENT_TIMESTAMP`, values: [sourceId, item.externalId, noteId, item.hash, item.updatedAt] });
  }
  const counts = countItems(fresh.items);
  statements.push({ sql: `INSERT INTO import_runs (id, source_id, completed_at, created_count, updated_count, skipped_count, status)
    VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, ?, 'completed')`, values: [crypto.randomUUID(), sourceId, counts.created, counts.updated, counts.skipped] });
  await executeBatch(statements);
  invalidateDocumentCatalog();
  for (const change of changes) publishNoteChange(change);
  // A failed UI refresh must not report that an already committed import failed.
  await useNotesStore.getState().loadDocuments().catch(() => undefined);
  return counts;
}
