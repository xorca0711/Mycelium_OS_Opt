import type { ImportPayload } from './model.ts';
export interface FileMapping { id: string; title: string; content: string }
const MAX_BYTES = 10 * 1024 * 1024;

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], value = '', quoted = false, closed = false;
  text = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const field = () => { row.push(value); value = ''; closed = false; };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { value += '"'; i++; }
      else if (ch === '"') { quoted = false; closed = true; }
      else value += ch;
    } else if (ch === ',') field();
    else if (ch === '\n') { field(); if (row.some(cell => cell.length)) rows.push(row); row = []; }
    else if (ch === '"' && value === '' && !closed) quoted = true;
    else if (closed || ch === '"') throw new Error('Malformed CSV quoting. Use a standard CSV export.');
    else value += ch;
    if (rows.length > 500) throw new Error('Import at most 500 file records per batch.');
  }
  if (quoted) throw new Error('The CSV contains an unterminated quoted field.');
  if (value || row.length || closed) { field(); if (row.some(cell => cell.length)) rows.push(row); }
  return rows;
}
function fileRows(text: string, format: 'csv' | 'json'): Record<string, unknown>[] {
  if (new TextEncoder().encode(text).length > MAX_BYTES) throw new Error('Choose a file smaller than 10 MiB.');
  if (format === 'json') {
    let parsed: unknown;
    try { parsed = JSON.parse(text.replace(/^\uFEFF/, '')); } catch { throw new Error('The file is not valid JSON.'); }
    const rows = Array.isArray(parsed) ? parsed : parsed && typeof parsed === 'object' && 'notes' in parsed ? parsed.notes : null;
    if (!Array.isArray(rows) || !rows.every(row => row && typeof row === 'object' && !Array.isArray(row))) throw new Error('JSON must be an array of records or an object with a notes array.');
    if (rows.length > 500) throw new Error('Import at most 500 file records per batch.');
    return rows;
  }
  const [headers = [], ...rows] = parseCsv(text);
  if (!headers.length || headers.some(h => !h.trim()) || new Set(headers).size !== headers.length) throw new Error('CSV needs unique, non-empty column headers.');
  return rows.map(row => {
    if (row.length !== headers.length) throw new Error('CSV row lengths must match the header.');
    return Object.fromEntries(headers.map((header, index) => [header, row[index]]));
  });
}
export function inspectFile(text: string, format: 'csv' | 'json'): string[] {
  return [...new Set(fileRows(text, format).flatMap(row => Object.keys(row)))];
}
export function mapFile(text: string, format: 'csv' | 'json', mapping: FileMapping): ImportPayload[] {
  const ids = new Set<string>();
  const rows = fileRows(text, format);
  if (!rows.length) throw new Error('The file has no records.');
  if (!mapping.id || !mapping.title || !mapping.content) throw new Error('Choose ID, title and content fields.');
  return rows.map(row => {
    const id = row[mapping.id], title = row[mapping.title], content = row[mapping.content];
    if ((typeof id !== 'string' && typeof id !== 'number') || typeof title !== 'string' || typeof content !== 'string') throw new Error('IDs must be text/numbers, and title/content fields must be text in every row.');
    const externalId = String(id).trim();
    if (ids.has(externalId)) throw new Error(`Duplicate record ID: ${externalId}`);
    ids.add(externalId);
    return { externalId, title, content, updatedAt: null };
  });
}
