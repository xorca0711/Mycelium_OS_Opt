import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.includes('/lib/imports/repository.ts')) {
      if (specifier === '../db') return {url:'test:import-db',shortCircuit:true};
      if (specifier.includes('notesDb')) return {url:'test:import-catalog',shortCircuit:true};
      if (specifier.includes('noteEvents')) return {url:'test:import-events',shortCircuit:true};
      if (specifier.includes('useNotesStore')) return {url:'test:import-store',shortCircuit:true};
    }
    return next(specifier,context);
  },
  load(url, context, next) {
    const sources = {
      'test:import-db':'export const getDb=()=>globalThis.importTestDb; export const executeBatch=s=>globalThis.importTestDb.executeBatch(s);',
      'test:import-catalog':'export const invalidateDocumentCatalog=()=>{};',
      'test:import-events':'export const publishNoteChange=c=>globalThis.importTestEvents.push(c);',
      'test:import-store':'export const useNotesStore={getState:()=>({loadDocuments:async()=>{}})};',
    };
    if (sources[url]) return {format:'module',source:sources[url],shortCircuit:true};
    return next(url,context);
  },
});
const { buildPreview, applyImport } = await import('../src/lib/imports/repository.ts');
function database() {
  const db = new DatabaseSync(':memory:');
  db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE notes(id TEXT PRIMARY KEY,note_type TEXT,title TEXT,content_plain TEXT,content_json TEXT,status TEXT DEFAULT 'active',updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE note_title_aliases(target_id TEXT REFERENCES notes(id),title TEXT,PRIMARY KEY(target_id,title));`);
  db.exec(readFileSync(new URL('../src-tauri/src/database/schema/data.sql',import.meta.url),'utf8').split('-- notesDb.loadNotes')[0]);
  let failLedger = false;
  globalThis.importTestEvents = [];
  globalThis.importTestDb = {
    select:async(sql,values=[])=>db.prepare(sql).all(...values),
    executeBatch:async statements=>{
      db.exec('BEGIN');
      try {
        for (const {sql,values=[]} of statements) {
          if(failLedger && sql.includes('INSERT INTO import_records')) throw new Error('injected ledger failure');
          db.prepare(sql).run(...values);
        }
        db.exec('COMMIT'); return [];
      } catch(error) {db.exec('ROLLBACK');throw error;}
    },
  };
  return {db, failLedger:()=>{failLedger=true;}};
}
const source={kind:'csv',sourceId:'reading-notes',label:'Reading notes'};
const payload={externalId:'stable-1',title:'First title',content:'First body',updatedAt:null};
test('Actual import SQL creates once, updates same note, preserves rename alias and records runs',async()=>{
  const {db}=database();
  try {
    const first=await buildPreview(source,[payload]);
    assert.equal(first.created,1);
    assert.deepEqual(await applyImport(first),{created:1,updated:0,skipped:0});
    const id=db.prepare('SELECT id FROM notes').get().id;
    assert.deepEqual(await applyImport(await buildPreview(source,[payload])),{created:0,updated:0,skipped:1});
    const updated=await buildPreview(source,[{...payload,title:'Renamed',content:'Updated source'}]);
    assert.equal(updated.updated,1);
    await applyImport(updated);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM notes').get().n,1);
    assert.equal(db.prepare('SELECT title FROM notes WHERE id=?').get(id).title,'Renamed');
    assert.equal(db.prepare('SELECT title FROM note_title_aliases WHERE target_id=?').get(id).title,'First title');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM import_runs').get().n,3);
    assert.equal(globalThis.importTestEvents.length,2);
  } finally {db.close();}
});
test('Local edits after preview and deleted local notes are preserved at import time',async()=>{
  const {db}=database();
  try {
    await applyImport(await buildPreview(source,[payload]));
    const preview=await buildPreview(source,[{...payload,content:'Changed remote'}]);
    db.prepare('UPDATE notes SET title=?').run('Local user edit');
    assert.deepEqual(await applyImport(preview),{created:0,updated:0,skipped:1});
    assert.equal(db.prepare('SELECT title FROM notes').get().title,'Local user edit');
    db.exec('DELETE FROM notes');
    const deleted=await buildPreview(source,[payload]);
    assert.equal(deleted.items[0].action,'deleted');
    await applyImport(deleted);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM notes').get().n,0);
  } finally {db.close();}
});
test('A provenance failure rolls back all notes/source writes and emits no change events',async()=>{
  const fixture=database();
  try {
    const preview=await buildPreview(source,[payload,{...payload,externalId:'stable-2'}]);
    fixture.failLedger();
    await assert.rejects(applyImport(preview),/injected ledger failure/);
    for(const table of ['notes','import_sources','import_records','import_runs']) assert.equal(fixture.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n,0);
    assert.equal(globalThis.importTestEvents.length,0);
  } finally {fixture.db.close();}
});
