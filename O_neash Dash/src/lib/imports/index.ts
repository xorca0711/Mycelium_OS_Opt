import { fetch as nativeFetch } from '@tauri-apps/plugin-http';
import { fetchNotion, notionId, type ImportProgress, type NotionOptions } from './notionClient.ts';
import { mapFile, type FileMapping } from './files.ts';
import { buildPreview, loadImportRecords } from './repository';
import type { ImportPreview } from './model.ts';
export type { ImportPreview, ImportResult, ImportItem, ImportSource } from './model.ts';
export { inspectFile } from './files.ts';
export { applyImport } from './repository';

export async function previewNotion(options: NotionOptions, progress: ImportProgress): Promise<ImportPreview> {
  const source = { kind: 'notion', sourceId: notionId(options.source), label: `Notion ${options.type}: ${notionId(options.source)}` };
  const records = await loadImportRecords(source);
  const result = await fetchNotion(options, progress, (url, init) => nativeFetch(url, { ...init, maxRedirections: 0, connectTimeout: 15_000 }), records);
  progress.signal.throwIfAborted();
  return buildPreview(source, result.payloads, result.warnings);
}
export async function previewFile(text: string, format: 'csv' | 'json', sourceLabel: string, mapping: FileMapping): Promise<ImportPreview> {
  const label = sourceLabel.trim();
  return buildPreview({ kind: format, sourceId: label, label }, mapFile(text, format, mapping));
}
