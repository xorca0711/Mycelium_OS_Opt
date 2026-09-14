import { useEffect, useRef, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { browseTable, exportTable, type TablePage, type TableSummary } from '@/lib/dataManagement';

interface Props { tables: TableSummary[]; disabled: boolean; onRefresh: () => void }

function cellText(value: unknown): string {
  if (value === null) return 'NULL';
  if (value === undefined) return '';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

export function DataTableExplorer({ tables, disabled, onRefresh }: Props) {
  const [table, setTable] = useState('');
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(25);
  const [page, setPage] = useState<TablePage | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const exportBusy = useRef(false);

  useEffect(() => {
    if (table && !tables.some(item => item.name === table)) { setTable(''); setOffset(0); }
  }, [tables, table]);

  useEffect(() => {
    let current = true;
    setPage(null);
    setError(null);
    if (!table || disabled) { setLoading(false); return; }
    setLoading(true);
    void browseTable(table, offset, limit).then(result => {
      if (!current) return;
      if (result.total > 0 && offset >= result.total) { setOffset(0); return; }
      setPage(result);
    }).catch(reason => { if (current) setError(`Could not read this page. ${String(reason)} Use Refresh to try again.`); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [table, offset, limit, reload, disabled]);

  async function exportRecords(): Promise<void> {
    if (exportBusy.current || !table || disabled) return;
    exportBusy.current = true;
    setExporting(true);
    setError(null);
    setMessage(null);
    try {
      const directory = await open({ directory: true, multiple: false, title: `Choose folder for ${table} ${format.toUpperCase()} export` });
      if (typeof directory !== 'string') return;
      const result = await exportTable(table, directory, format);
      setMessage(`Exported ${result.rows.toLocaleString()} rows to ${result.path}`);
    } catch (reason) { setError(`Export failed. Choose a writable folder and retry. ${String(reason)}`); }
    finally { exportBusy.current = false; setExporting(false); }
  }

  return <section className="data-section" aria-labelledby="data-table-heading">
    <h3 id="data-table-heading">Browse and export records</h3>
    <p className="data-hint">Read-only database tables. Preview loads one page at a time; export includes every row in the selected table. Exports use a new filename in your chosen folder.</p>
    <div className="data-toolbar">
      <label>Table<select value={table} disabled={disabled || exporting} onChange={event => { setTable(event.target.value); setOffset(0); setMessage(null); }}>
        <option value="">Choose a table…</option>
        {tables.map(item => <option key={item.name} value={item.name}>{item.name} ({item.rows.toLocaleString()} rows)</option>)}
      </select></label>
      <label>Rows per page<select value={limit} disabled={disabled || exporting} onChange={event => { setLimit(Number(event.target.value)); setOffset(0); }}>
        {[25, 50, 100, 200].map(size => <option key={size} value={size}>{size}</option>)}
      </select></label>
      <button type="button" disabled={disabled || loading || exporting} onClick={() => { setReload(value => value + 1); onRefresh(); }}>Refresh records</button>
    </div>
    {loading && <p role="status">Loading table page…</p>}
    {page && <>
      <p className="data-hint" role="status">{page.total ? `${offset + 1}–${offset + page.rows.length} of ${page.total.toLocaleString()} rows` : 'This table has no rows.'} Long values are shortened in this preview; export preserves full values.</p>
      <div className="data-table-scroll" tabIndex={0} role="region" aria-label={`${table} records`}>
        <table><thead><tr>{page.columns.map(column => <th key={column} scope="col">{column}</th>)}</tr></thead>
          <tbody>{page.rows.map((row, rowIndex) => <tr key={offset + rowIndex}>{row.map((value, index) => {
            const text = cellText(value);
            return <td key={index}>{text.length > 500 ? `${text.slice(0, 500)}…` : text}</td>;
          })}</tr>)}</tbody>
        </table>
      </div>
      <div className="data-toolbar" style={{ marginTop: 12 }}>
        <button type="button" disabled={disabled || loading || offset === 0} onClick={() => setOffset(value => Math.max(0, value - limit))}>Previous page</button>
        <button type="button" disabled={disabled || loading || offset + page.rows.length >= page.total} onClick={() => setOffset(value => value + limit)}>Next page</button>
      </div>
    </>}
    <div className="data-toolbar" style={{ marginTop: 18 }}>
      <label>Export format<select value={format} disabled={disabled || exporting} onChange={event => setFormat(event.target.value as 'csv' | 'json')}><option value="csv">CSV</option><option value="json">JSON</option></select></label>
      <button type="button" disabled={disabled || exporting || !table} onClick={() => { void exportRecords(); }}>{exporting ? 'Exporting…' : 'Choose export folder…'}</button>
    </div>
    {error && <p role="alert" className="data-error">{error}</p>}
    {message && <p role="status" className="data-path">{message}</p>}
  </section>;
}
