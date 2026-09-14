import { useEffect, useState } from 'react';
import { getDataLocation, type DataLocation } from '@/lib/dataLocation';
import { getDataOverview, getRestoreStatus, type DataOverview, type RestoreStatus } from '@/lib/dataManagement';
import { useDataMaintenanceStore } from '@/store/useDataMaintenanceStore';
import { DataTableExplorer } from './DataTableExplorer';
import { DataBackupRestore, formatDataBytes } from './DataBackupRestore';
import { DataImportSection } from './DataImportSection';

interface Props { active: boolean; draftPending: boolean; onEditPersonal: () => void }

export function DataSettings({ active, draftPending, onEditPersonal }: Props) {
  const busy = useDataMaintenanceStore(state => state.busy);
  const restartRequired = useDataMaintenanceStore(state => state.restartRequired);
  const blocked = busy || restartRequired;
  const [overview, setOverview] = useState<DataOverview | null>(null);
  const [location, setLocation] = useState<DataLocation | null>(null);
  const [restore, setRestore] = useState<RestoreStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const refresh = () => setRevision(value => value + 1);

  useEffect(() => {
    if (!active || blocked) return;
    let current = true;
    setLoading(true);
    setError(null);
    void Promise.all([getDataLocation(), getDataOverview(), getRestoreStatus()]).then(([directory, summary, status]) => {
      if (!current) return;
      setLocation(directory);
      setOverview(summary);
      setRestore(status);
    }).catch(reason => { if (current) setError(`Could not load the data overview. ${String(reason)} Use Refresh data status to retry.`); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [active, blocked, revision]);

  return <div className="data-settings">
    <style>{`
      .data-settings { color: #e6e6e6; font-size: 1.1rem; line-height: 1.4; max-width: 1100px; margin: 0 auto; padding-bottom: 24px; }
      .data-settings h2 { font-size: 1.7rem; margin: 0 0 8px; }
      .data-settings h3 { font-size: 1.35rem; color: #00c4a7; margin: 0 0 12px; }
      .data-settings h4 { font-size: 1.2rem; margin: 0 0 12px; }
      .data-section { border: 1px solid #303030; border-radius: 8px; padding: 18px; margin-bottom: 22px; min-width: 0; }
      .data-toolbar { display: flex; flex-wrap: wrap; align-items: end; gap: 12px; }
      .data-settings label { display: grid; gap: 6px; min-width: 0; }
      .data-settings input:not([type=checkbox]), .data-settings select, .data-settings textarea { box-sizing: border-box; width: 100%; min-width: 0; max-width: 100%; border: 1px solid #555; border-radius: 5px; padding: 8px 10px; background: #101010; color: #fff; color-scheme: dark; font: inherit; }
      .data-settings select { max-width: 340px; }
      .data-settings button { border: 1px solid #555; border-radius: 5px; color: #f2f2f2; background: #151515; padding: 8px 12px; font: inherit; cursor: pointer; }
      .data-settings button:disabled { opacity: .5; cursor: not-allowed; }
      .data-settings :focus-visible { outline: 2px solid #00c4a7; outline-offset: 3px; }
      .data-hint { color: #aaa; font-size: 1rem; margin: 6px 0 14px; }
      .data-error { color: #ff9999; overflow-wrap: anywhere; }
      .data-path, .data-settings code { overflow-wrap: anywhere; word-break: break-word; }
      .data-settings code { font-size: .88rem; }
      .data-facts { margin: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 250px), 1fr)); gap: 12px 24px; }
      .data-facts dt { color: #aaa; font-size: 1rem; }
      .data-facts dd { margin: 3px 0 12px; }
      .data-table-scroll { overflow: auto; max-height: 390px; max-width: 100%; border: 1px solid #333; border-radius: 5px; }
      .data-table-scroll table { border-collapse: collapse; width: 100%; font: .88rem/1.4 monospace; }
      .data-table-scroll th, .data-table-scroll td { border-bottom: 1px solid #303030; border-right: 1px solid #303030; padding: 9px; text-align: left; vertical-align: top; min-width: 110px; max-width: 320px; overflow-wrap: anywhere; white-space: pre-wrap; }
      .data-table-scroll th { position: sticky; top: 0; background: #171717; color: #aaa; }
      .data-restore-preview { margin-top: 20px; padding: 18px; border: 1px solid #9c7750; border-radius: 6px; background: #191510; }
      .data-settings .data-check { display: flex; align-items: start; gap: 10px; }
      .data-settings input[type=checkbox] { width: 18px; height: 18px; flex-shrink: 0; margin-top: 4px; accent-color: #00c4a7; }
      .data-settings button.data-apply { border-color: #e5b779; color: #e5b779; }
    `}</style>
    <h2>Local data</h2>
    <p className="data-hint">Inspect records, import data, and manage workspace backups on this device.</p>
    {draftPending && <p role="status" className="data-section">Personal settings have unsaved changes. Save or discard them before importing, backing up, or restoring. <button type="button" onClick={onEditPersonal}>Return to Personal settings</button></p>}
    <section className="data-section" aria-labelledby="data-status-heading">
      <h3 id="data-status-heading">Data location and status</h3>
      {loading && <p role="status">Reading data status…</p>}
      {location && <dl className="data-facts">
        <div><dt>Data directory</dt><dd><code>{location.directory}</code></dd></div>
        <div><dt>Database</dt><dd><code>{location.databaseUrl}</code></dd></div>
        <div><dt>Workspace</dt><dd>{location.development ? 'Development (isolated from installed app)' : 'Installed app'}</dd></div>
        {overview && <div><dt>Database size / schema</dt><dd>{formatDataBytes(overview.databaseBytes)} / v{overview.schemaVersion}</dd></div>}
      </dl>}
      {overview && <p className={overview.foreignKeyViolations || overview.integrity.some(item => item !== 'ok') ? 'data-error' : 'data-hint'}>
        {overview.tables.length} tables · {overview.tables.reduce((sum, table) => sum + table.rows, 0).toLocaleString()} total rows · Integrity: {overview.integrity.join('; ') || 'No result'} · {overview.foreignKeyViolations} foreign-key violations
      </p>}
      {restore?.rollbackPath && <p className="data-hint data-path">Previous workspace preserved at: {restore.rollbackPath}</p>}
      {restore?.pending && <p role="status">A restore is staged and will apply when the native app next starts.</p>}
      {error && <p role="alert" className="data-error">{error}</p>}
      <button type="button" disabled={blocked || loading} onClick={refresh}>Refresh data status</button>
    </section>
    <DataTableExplorer tables={overview?.tables ?? []} disabled={!active || blocked} onRefresh={refresh} />
    <DataImportSection disabled={draftPending || blocked || !active} />
    <DataBackupRestore disabled={draftPending || blocked || !active} onComplete={refresh} />
  </div>;
}
