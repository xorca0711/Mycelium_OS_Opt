import Database from '@tauri-apps/plugin-sql';
import { invoke } from '@tauri-apps/api/core';
import type { DataLocation } from './dataLocation';

export type SqlValue = string | number | boolean | null;

export interface SqlStatement {
  sql: string;
  values?: readonly SqlValue[];
}

export interface WriteResult {
  rowsAffected: number;
  lastInsertId: number;
}

let database: Database | null = null;
let setupPromise: Promise<Database> | undefined;

export function setupDb(): Promise<Database> {
  setupPromise ??= invoke<DataLocation>('initialize_database').then(location => {
    database = Database.get(location.databaseUrl);
    return database;
  }).catch(error => {
    setupPromise = undefined;
    throw error;
  });
  return setupPromise;
}

export function getDb(): Database {
  if (!database) throw new Error('Database not initialized. Wait for setupDb() before accessing data.');
  return database;
}

/** Execute related writes on one native SQLite transaction, rolling back all on error. */
export async function executeBatch(statements: readonly SqlStatement[]): Promise<WriteResult[]> {
  getDb();
  return invoke<WriteResult[]>('execute_batch', { statements });
}
