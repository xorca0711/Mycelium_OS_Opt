import { useRef, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { collectLocalPreferences, createBackup, stageRestore, validateBackup, type BackupInfo } from '@/lib/dataManagement';
import { runDataMaintenance } from '@/store/useDataMaintenanceStore';

interface Props { disabled: boolean; onComplete: () => void }

export function formatDataBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes.toLocaleString()} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

export function DataBackupRestore({ disabled, onComplete }: Props) {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<BackupInfo | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const working = useRef(false);

  async function action(operation: () => Promise<void>): Promise<void> {
    if (working.current || disabled) return;
    working.current = true;
    setBusy(true);
    setError(null);
    setMessage(null);
    try { await operation(); }
    catch (reason) { setError(`${String(reason)} Check the selected folder and retry. Your current workspace has not been replaced.`); }
    finally { working.current = false; setBusy(false); }
  }

  async function backup(): Promise<void> {
    const directory = await open({ directory: true, multiple: false, title: 'Choose a parent folder for the new backup' });
    if (typeof directory !== 'string') return;
    const result = await runDataMaintenance('Saving drafts and creating backup', () => createBackup(directory, collectLocalPreferences()));
    setMessage(`Backup created: ${result.path} (${result.files.toLocaleString()} files, ${formatDataBytes(result.bytes)}).`);
    onComplete();
  }

  async function previewRestore(): Promise<void> {
    const directory = await open({ directory: true, multiple: false, title: 'Choose a Mycelium backup folder to preview' });
    if (typeof directory !== 'string') return;
    setPreview(null);
    setConfirmed(false);
    const result = await validateBackup(directory);
    setPreview(result);
  }

  async function applyRestore(): Promise<void> {
    if (!preview || !confirmed) return;
    await runDataMaintenance('Saving drafts and staging workspace restore', () => stageRestore(preview.path), { restartOnSuccess: true });
    setPreview(null);
    setConfirmed(false);
    setMessage('Restore staged. Fully quit and reopen Mycelium to apply it. The current workspace will be preserved for rollback.');
    onComplete();
  }

  return <section className="data-section" aria-labelledby="data-backup-heading">
    <h3 id="data-backup-heading">Back up and restore your workspace</h3>
    <p className="data-hint">A backup is a folder containing your database, managed image files, and saved appearance, widget, arc, planner, and weather-location preferences. Unsaved note drafts are saved before backup. Keep the entire folder together.</p>
    <div className="data-toolbar">
      <button type="button" disabled={disabled || busy} onClick={() => { void action(backup); }}>Create backup folder…</button>
      <button type="button" disabled={disabled || busy} onClick={() => { void action(previewRestore); }}>Choose backup to preview…</button>
    </div>
    {busy && <p role="status">Working… Keep Mycelium open until this finishes.</p>}
    {preview && <div className="data-restore-preview" aria-labelledby="data-restore-heading">
      <h4 id="data-restore-heading">Restore preview</h4>
      <dl className="data-facts">
        <div><dt>Backup folder</dt><dd className="data-path">{preview.path}</dd></div>
        <div><dt>Created</dt><dd>{new Date(preview.createdAt).toLocaleString()}</dd></div>
        <div><dt>Contents</dt><dd>{preview.files.toLocaleString()} files · {formatDataBytes(preview.bytes)} · schema {preview.schemaVersion}</dd></div>
        <div><dt>Local preferences</dt><dd>{Object.keys(preview.preferences).length} saved preference keys</dd></div>
      </dl>
      <p>Applying this backup replaces the complete workspace after a full app restart, including personal settings and files. Your current workspace is preserved for rollback.</p>
      <label className="data-check"><input type="checkbox" checked={confirmed} disabled={disabled || busy} onChange={event => setConfirmed(event.target.checked)} />I want to replace this workspace with the reviewed backup after restart.</label>
      <div className="data-toolbar" style={{ marginTop: 16 }}>
        <button type="button" className="data-apply" disabled={disabled || busy || !confirmed} onClick={() => { void action(applyRestore); }}>Apply reviewed backup on restart</button>
        <button type="button" disabled={busy} onClick={() => { setPreview(null); setConfirmed(false); }}>Cancel preview</button>
      </div>
    </div>}
    {error && <p role="alert" className="data-error">{error}</p>}
    {message && <p role="status" className="data-path">{message}</p>}
  </section>;
}
