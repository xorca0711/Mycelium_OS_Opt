import { useEffect, useRef, useState } from 'react';
import { applyImport, inspectFile, previewFile, previewNotion, type ImportPreview } from '@/lib/imports';
import { runDataMaintenance } from '@/store/useDataMaintenanceStore';

interface Props { disabled?: boolean }
type FileFormat = 'csv' | 'json';
type NotionType = 'page' | 'database' | 'data_source';
type Mapping = { id: string; title: string; content: string };
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const PAGE_SIZE = 50;
const EMPTY_MAPPING: Mapping = { id: '', title: '', content: '' };

export function DataImportSection({ disabled = false }: Props) {
  const [mode, setMode] = useState<'notion' | 'file'>('notion');
  const [token, setToken] = useState('');
  const [source, setSource] = useState('');
  const [notionType, setNotionType] = useState<NotionType>('page');
  const [limit, setLimit] = useState('25');
  const [format, setFormat] = useState<FileFormat>('csv');
  const [fileName, setFileName] = useState('');
  const [fileText, setFileText] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Mapping>(EMPTY_MAPPING);
  const [sourceLabel, setSourceLabel] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState<'reading' | 'previewing' | 'importing' | null>(null);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const mounted = useRef(true);
  const operation = useRef(0);
  const active = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const tokenMemory = useRef('');

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      operation.current++;
      controller.current?.abort();
      tokenMemory.current = '';
    };
  }, []);

  // Settings keeps inactive tabs mounted. Hide-time cancellation must therefore be explicit.
  useEffect(() => {
    if (!disabled) return;
    clearToken();
    if (busy === 'previewing' || busy === 'reading') cancelPreview();
  }, [disabled]);

  function clearToken(): void { tokenMemory.current = ''; setToken(''); }
  function invalidate(): void { setPreview(null); setPage(0); setError(null); setMessage(null); setProgress(''); }
  function cancelPreview(): void {
    operation.current++;
    controller.current?.abort();
    controller.current = null;
    active.current = false;
    setBusy(null);
    clearToken();
    setProgress('');
    setMessage('Preview cancelled. No notes were imported.');
  }

  async function readImportFile(file: File | undefined): Promise<void> {
    if (!file || disabled || active.current) return;
    invalidate();
    setFileText(''); setHeaders([]); setMapping(EMPTY_MAPPING); setFileName('');
    if (file.size > MAX_FILE_BYTES) { setError('Choose a CSV or JSON file of 10 MiB or less.'); return; }
    active.current = true;
    const request = ++operation.current;
    setBusy('reading');
    try {
      const text = await file.text();
      if (!mounted.current || request !== operation.current) return;
      const fields = inspectFile(text, format);
      if (!fields.length) { setError('No fields found. Choose a CSV with headers or a JSON record file.'); return; }
      setFileText(text); setFileName(file.name); setHeaders(fields);
      setSourceLabel(previous => previous || file.name);
      const find = (candidates: string[]) => fields.find(field => candidates.includes(field.toLowerCase())) ?? '';
      setMapping({ id: find(['id', 'external_id', 'page_id']), title: find(['title', 'name']), content: find(['content', 'text', 'body']) });
    } catch { if (mounted.current && request === operation.current) setError('Could not read this file. Check the selected format, CSV headers or JSON record structure, then choose the file again.'); }
    finally {
      if (mounted.current && request === operation.current) { active.current = false; setBusy(null); }
    }
  }

  const validLimit = Number.isInteger(Number(limit)) && Number(limit) >= 1 && Number(limit) <= 100;
  const mappingReady = Object.values(mapping).every(field => !!field && headers.includes(field));
  const readyToPreview = mode === 'notion'
    ? !!token.trim() && !!source.trim() && validLimit
    : !!fileText && !!sourceLabel.trim() && mappingReady;

  async function buildPreview(): Promise<void> {
    if (disabled || active.current || !readyToPreview) return;
    active.current = true;
    invalidate();
    const request = ++operation.current;
    const abort = new AbortController();
    controller.current = abort;
    setBusy('previewing');
    setProgress(mode === 'notion' ? 'Reading the selected Notion source…' : 'Checking file records…');
    try {
      const result = mode === 'notion'
        ? await previewNotion({ token: token.trim(), source: source.trim(), type: notionType, limit: Number(limit) }, {
          signal: abort.signal,
          onProgress: text => {
            if (mounted.current && request === operation.current) {
              // Progress comes from our importer, never render the credential if accidentally included.
              setProgress((tokenMemory.current ? text.split(tokenMemory.current).join('[redacted]') : text).slice(0, 300));
            }
          },
        })
        : await previewFile(fileText, format, sourceLabel.trim(), mapping);
      if (!mounted.current || request !== operation.current || abort.signal.aborted) return;
      setPreview(result);
      setProgress('Preview ready. Review the actions before importing.');
      clearToken();
    } catch (reason) {
      if (mounted.current && request === operation.current && !abort.signal.aborted) {
        const fallback = mode === 'notion'
          ? 'Could not preview Notion. Check the token, shared source, source type and connection, then try again.'
          : 'Could not preview this file. Check the field mapping and ensure each record has a stable, unique ID.';
        const message = reason instanceof Error ? reason.message : fallback;
        setError((tokenMemory.current ? message.split(tokenMemory.current).join('[redacted]') : message).slice(0, 600));
        setProgress('');
      }
    } finally {
      if (mounted.current && request === operation.current) { controller.current = null; active.current = false; setBusy(null); }
    }
  }

  async function importReviewed(): Promise<void> {
    if (disabled || active.current || !preview || preview.created + preview.updated === 0) return;
    active.current = true;
    setBusy('importing'); setError(null); setMessage(null); setProgress('Saving reviewed notes…');
    try {
      const result = await runDataMaintenance('Importing notes', () => applyImport(preview));
      if (!mounted.current) return;
      clearToken(); setPreview(null); setProgress('');
      setMessage(`Import complete: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped.`);
    } catch {
      if (mounted.current) { setError('Import did not complete. Create a fresh preview before trying again; existing local changes will be checked again.'); setPreview(null); setProgress(''); }
    } finally { if (mounted.current) { active.current = false; setBusy(null); } }
  }

  const locked = disabled || busy !== null;
  const rows = preview?.items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE) ?? [];

  return <section className="data-section" aria-labelledby="data-import-heading">
    <h3 id="data-import-heading">Import into Notes</h3>
    <p className="data-hint">Bring Notion pages/database rows or CSV/JSON records into Notes. Markdown and available properties are copied as editable text; relations remain IDs. This is a one-way import, without task mapping, two-way sync or media downloads.</p>
    <div className="data-toolbar">
      <label>Source<select value={mode} disabled={locked} onChange={event => { setMode(event.target.value as 'notion' | 'file'); clearToken(); invalidate(); }}>
        <option value="notion">Notion</option><option value="file">CSV / JSON file</option>
      </select></label>
    </div>
    {mode === 'notion' ? <>
      <p className="data-hint">Share the source with your Notion connection first. The token stays in memory and is cleared after a successful preview, cancellation or leaving this screen. Nothing is fetched until you select Preview.</p>
      <div className="data-toolbar">
        <label>Notion token<input type="password" value={token} disabled={locked} autoComplete="off" spellCheck={false} onChange={event => { setToken(event.target.value); tokenMemory.current = event.target.value.trim(); invalidate(); }} /></label>
        <label style={{ flex: '1 1 260px' }}>Source URL or ID<input value={source} disabled={locked} autoComplete="off" spellCheck={false} onChange={event => { setSource(event.target.value); invalidate(); }} /></label>
        <label>Source type<select value={notionType} disabled={locked} onChange={event => { setNotionType(event.target.value as NotionType); invalidate(); }}>
          <option value="page">Page</option><option value="database">Database</option><option value="data_source">Data source</option>
        </select></label>
        <label>Preview limit (1–100)<input type="number" min={1} max={100} step={1} value={limit} disabled={locked} onChange={event => { setLimit(event.target.value); invalidate(); }} /></label>
      </div>
    </> : <>
      <p className="data-hint">Choose a local file up to 10 MiB. Map its stable record ID, title and text fields. Reuse the same source label and record IDs on later imports so existing records can be matched.</p>
      <div className="data-toolbar">
        <label>Format<select value={format} disabled={locked} onChange={event => { setFormat(event.target.value as FileFormat); setFileText(''); setFileName(''); setHeaders([]); setMapping(EMPTY_MAPPING); invalidate(); }}>
          <option value="csv">CSV</option><option value="json">JSON</option>
        </select></label>
        <label>File<input key={format} type="file" accept={format === 'csv' ? '.csv,text/csv' : '.json,application/json'} disabled={locked} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void readImportFile(file); }} /></label>
        <label>Stable source label<input value={sourceLabel} disabled={locked} onChange={event => { setSourceLabel(event.target.value); invalidate(); }} placeholder="e.g. Personal reading notes" /></label>
      </div>
      {fileName && <p className="data-path">Selected: {fileName}</p>}
      {headers.length > 0 && <div className="data-toolbar">
        {(['id', 'title', 'content'] as const).map(key => <label key={key}>{key === 'id' ? 'Stable record ID field' : key === 'title' ? 'Title field' : 'Text content field'}<select value={mapping[key]} disabled={locked} onChange={event => { setMapping(previous => ({ ...previous, [key]: event.target.value })); invalidate(); }}>
          <option value="">Choose field…</option>{headers.map(field => <option key={field} value={field}>{field}</option>)}
        </select></label>)}
      </div>}
    </>}
    <div className="data-toolbar" style={{ marginTop: 14 }}>
      <button type="button" disabled={locked || !readyToPreview} onClick={() => void buildPreview()}>Preview import</button>
      {(busy === 'previewing' || busy === 'reading') && <button type="button" onClick={cancelPreview}>Cancel preview</button>}
    </div>
    {disabled && <p className="data-hint">Finish pending settings changes or the current data operation before importing.</p>}
    {progress && <p role="status" aria-live="polite">{progress}</p>}
    {error && <p role="alert" className="data-error">{error}</p>}
    {message && <p role="status">{message}</p>}
    {preview && <div style={{ marginTop: 18 }}>
      <h4>Review: {preview.source.label}</h4>
      <p>{preview.created} to create · {preview.updated} to update · {preview.skipped} to skip</p>
      {preview.warnings.length > 0 && <ul className="data-hint">{preview.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>}
      <p className="data-hint">Local edits and deleted notes are skipped. Import checks again against the latest local records, so final counts may differ from this preview.</p>
      <div className="data-table-scroll" style={{ maxHeight: 320, overflow: 'auto' }} tabIndex={0} role="region" aria-label="Import preview">
        <table><thead><tr><th scope="col">Title</th><th scope="col">Action</th><th scope="col">Reason</th></tr></thead>
          <tbody>{rows.map((item, index) => <tr key={`${item.externalId}-${index}`}><td style={{ overflowWrap: 'anywhere' }}>{item.title || 'Untitled'}</td><td>{item.action}</td><td>{item.reason ?? '—'}</td></tr>)}</tbody>
        </table>
      </div>
      {preview.items.length > PAGE_SIZE && <div className="data-toolbar" style={{ marginTop: 10 }}>
        <button type="button" disabled={locked || page === 0} onClick={() => setPage(value => value - 1)}>Previous preview page</button>
        <span>{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, preview.items.length)} of {preview.items.length}</span>
        <button type="button" disabled={locked || (page + 1) * PAGE_SIZE >= preview.items.length} onClick={() => setPage(value => value + 1)}>Next preview page</button>
      </div>}
      <div className="data-toolbar" style={{ marginTop: 14 }}>
        <button type="button" disabled={locked || preview.created + preview.updated === 0} onClick={() => void importReviewed()}>Import reviewed notes</button>
        <button type="button" disabled={locked} onClick={invalidate}>Discard preview</button>
      </div>
    </div>}
  </section>;
}
