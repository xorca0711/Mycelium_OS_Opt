import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const source = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const schema = name => source(`../src-tauri/src/database/schema/${name}.sql`);
const templates = path => [...source(path).matchAll(/`([^`]+)`/g)].map(match => match[1]);
const notes = templates('../src/plugins/NotesPlugin/lib/notesDb.ts');
const sessions = templates('../src/plugins/PlannerPlugin/lib/onTheClockDb.ts');
const planner = templates('../src/plugins/PlannerPlugin/lib/plannerDb.ts');
function query(list, fragment) {
  const found = list.find(sql => sql.includes(fragment));
  assert.ok(found, `Source query is still present: ${fragment}`);
  assert.ok(!found.includes('${'), 'Fixture must bind real SQL, not an interpolated template');
  return found;
}

function fixture(t) {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  db.exec('PRAGMA foreign_keys=ON');
  for (const name of ['planner', 'personal', 'collections', 'settings']) db.exec(schema(name));
  db.exec("INSERT INTO planner_groups(id,name) VALUES ('shared','Shared'); BEGIN");
  const note = db.prepare('INSERT INTO notes(id,note_type,title,status,pinned,updated_at) VALUES (?,?,?,?,?,?)');
  const node = db.prepare('INSERT INTO nodes(id,title) VALUES (?,?)');
  const group = db.prepare("INSERT INTO note_groups(note_id,group_id) VALUES (?,'shared')");
  const log = db.prepare('INSERT INTO productivity_logs(id,node_id,duration_actual) VALUES (?,?,?)');
  const session = db.prepare('INSERT INTO work_sessions(id,title,planned_date,created_at) VALUES (?,?,?,?)');
  const effort = db.prepare('INSERT INTO session_nodes(session_id,node_id,total_minutes) VALUES (?,?,?)');
  for (let i = 0; i < 2000; i++) {
    const day = `2026-09-${String(i % 28 + 1).padStart(2, '0')}`;
    // Distinct sort keys make equality meaningful: current SQL does not specify a tie-breaker.
    const timestamp = `${day}T${String(i % 24).padStart(2, '0')}:00:00.${String(i).padStart(4, '0')}`;
    note.run(`note-${i}`, i % 3 ? 'document' : 'memo', `Note ${i}`, i % 7 ? 'active' : 'archived', i % 5 === 0 ? 1 : 0, timestamp);
    node.run(`node-${i}`, `Task ${i}`);
    group.run(`note-${i}`);
    log.run(`log-${i}`, `node-${i}`, 25);
    session.run(`session-${i}`, `Session ${i}`, day, timestamp);
    effort.run(`session-${i}`, `node-${i % 100}`, i % 3 ? 25 : 0);
  }
  db.exec('COMMIT; ANALYZE');
  return db;
}

test('additive indexes improve actual query plans without changing selected records', t => {
  const db = fixture(t);
  // SQLite index names are global: the old repeated name never indexed note_groups.
  assert.equal(db.prepare("SELECT tbl_name FROM sqlite_master WHERE name='idx_ng_group'").get().tbl_name, 'node_groups');
  const cases = [
    { sql: query(notes, "WHERE note_type = ? AND status = 'active' ORDER BY pinned"), params: ['document'], index: 'idx_notes_type_status_order', sort: 'ORDER BY' },
    { sql: query(notes, "WHERE status = 'active' ORDER BY pinned"), params: [], index: 'idx_notes_status_order', sort: 'ORDER BY' },
    { sql: query(sessions, 'ORDER BY ws.planned_date DESC, ws.created_at DESC'), params: [60], index: 'idx_ws_date_created', sort: 'ORDER BY' },
    { sql: query(sessions, 'SELECT node_id, SUM(total_minutes) AS total_minutes'), params: [], index: 'idx_session_nodes_effort', sort: 'GROUP BY' },
    { sql: query(planner, 'DELETE FROM productivity_logs WHERE node_id = ?'), params: ['node-50'], index: 'idx_productivity_logs_node', scan: 'productivity_logs' },
    { sql: query(planner, 'DELETE FROM planner_groups WHERE id = ?'), params: ['shared'], index: 'idx_note_groups_group', scan: 'note_groups' },
  ];
  const explain = item => db.prepare(`EXPLAIN QUERY PLAN ${item.sql}`).all(...item.params).map(row => row.detail).join('\n');
  for (const item of cases) {
    item.before = explain(item);
    if (item.sql.trim().startsWith('SELECT')) item.rows = db.prepare(item.sql).all(...item.params);
  }
  db.exec(schema('data'));
  db.exec(schema('data')); // Explicitly idempotent DDL.
  db.exec('ANALYZE');
  for (const item of cases) {
    const after = explain(item);
    assert.ok(after.includes(item.index), `${item.index}:\n${after}`);
    if (item.sort) {
      assert.match(item.before, /TEMP B-TREE/, `${item.index} must address an observed sort`);
      assert.doesNotMatch(after, /TEMP B-TREE/, `${item.index} should supply the order/grouping`);
    } else {
      assert.ok(item.before.includes(`SCAN ${item.scan}`), item.before);
      assert.ok(after.includes(`SEARCH ${item.scan}`), after);
    }
    if (item.rows) assert.deepEqual(db.prepare(item.sql).all(...item.params), item.rows);
    t.diagnostic(`${item.index}: ${item.before.replaceAll('\n', '; ')} -> ${after.replaceAll('\n', '; ')}`);
  }
});

test('source schema enforces repeat-safe import identity and retains history after note deletion', t => {
  const db = fixture(t);
  db.exec(schema('data'));
  db.exec("INSERT INTO import_sources(id,kind,source_id) VALUES ('source','notion','external-source')");
  db.exec("INSERT INTO import_records(source_id,external_id,note_id,content_hash,source_updated_at) VALUES ('source','external-note','note-1','hash','2026-09-14T00:00:00Z')");
  db.exec("INSERT INTO import_runs(id,source_id,created_count,status) VALUES ('run','source',1,'completed')");
  assert.throws(() => db.exec("INSERT INTO import_sources(id,kind,source_id) VALUES ('other','notion','external-source')"), /UNIQUE/);
  assert.throws(() => db.exec("INSERT INTO import_records(source_id,external_id,content_hash) VALUES ('source','external-note','hash')"), /UNIQUE/);
  assert.throws(() => db.exec("INSERT INTO import_records(source_id,external_id,note_id,content_hash) VALUES ('source','other','missing','hash')"), /FOREIGN KEY/);
  assert.throws(() => db.exec("DELETE FROM import_sources WHERE id='source'"), /FOREIGN KEY/);
  assert.throws(() => db.exec("INSERT INTO import_runs(id,source_id,created_count) VALUES ('invalid','source',-1)"), /CHECK/);
  db.exec("DELETE FROM notes WHERE id='note-1'");
  const row = db.prepare('SELECT note_id,content_hash,source_updated_at FROM import_records').get();
  assert.equal(row.note_id, null);
  assert.equal(row.content_hash, 'hash');
  assert.equal(row.source_updated_at, '2026-09-14T00:00:00Z');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM import_runs').get().count, 1);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
});
