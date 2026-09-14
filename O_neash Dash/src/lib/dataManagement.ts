import { invoke } from '@tauri-apps/api/core';
import type { LocalPreferences } from './localPreferences';
export { collectLocalPreferences, applyRestoredPreferences, LOCAL_PREFERENCE_KEYS } from './localPreferences';
export type { LocalPreferences } from './localPreferences';

export interface TableSummary { name: string; rows: number }
export interface DataOverview {
  schemaVersion: number;
  databaseBytes: number;
  integrity: string[];
  foreignKeyViolations: number;
  tables: TableSummary[];
}
export interface TablePage { columns: string[]; rows: unknown[][]; total: number; offset: number; limit: number }
export interface TableExport { path: string; rows: number }
export interface BackupInfo {
  path: string;
  createdAt: number;
  schemaVersion: number;
  files: number;
  bytes: number;
  preferences: LocalPreferences;
}
export interface RestoreStage { restartRequired: true; stagedPath: string }
export interface RestoreStatus { pending: boolean; appliedPreferences: LocalPreferences | null; rollbackPath: string | null }

export function getDataOverview(): Promise<DataOverview> { return invoke('data_overview'); }
export function browseTable(table: string, offset = 0, limit = 50): Promise<TablePage> {
  if (!table || !Number.isSafeInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 200) {
    return Promise.reject(new Error('Choose a table and a valid page of 1–200 rows.'));
  }
  return invoke('browse_table', { table, offset, limit });
}
export function exportTable(table: string, destinationDirectory: string, format: 'json' | 'csv'): Promise<TableExport> {
  return invoke('export_table', { table, destinationDirectory, format });
}
export function createBackup(destinationDirectory: string, preferences: LocalPreferences): Promise<BackupInfo> {
  return invoke('create_backup', { destinationDirectory, preferences });
}
export function validateBackup(backupDirectory: string): Promise<BackupInfo> { return invoke('validate_backup', { backupDirectory }); }
export function stageRestore(backupDirectory: string): Promise<RestoreStage> { return invoke('stage_restore', { backupDirectory }); }
export function getRestoreStatus(): Promise<RestoreStatus> { return invoke('get_restore_status'); }
export function acknowledgeRestore(): Promise<void> { return invoke('acknowledge_restore'); }
export function cancelStagedRestore(): Promise<void> { return invoke('cancel_staged_restore'); }
