import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { netSessionMinutes } from '../src/plugins/PlannerPlugin/lib/sessionTiming.ts';
import { localDateRange } from '../src/plugins/PlannerPlugin/lib/dateRanges.ts';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.includes('/PlannerPlugin/lib/')) {
      if (specifier === '@/lib/db') return { url: 'planner-test:db', shortCircuit: true };
      if (specifier.startsWith('./') && !specifier.endsWith('.ts')) return nextResolve(new URL(specifier + '.ts', context.parentURL).href, context);
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === 'planner-test:db') return { format: 'module', shortCircuit: true,
      source: 'export const getDb = () => globalThis.__plannerDb; export const executeBatch = s => globalThis.__plannerDb.executeBatch(s);' };
    return nextLoad(url, context);
  },
});
const planner = await import('../src/plugins/PlannerPlugin/lib/plannerDb.ts');
const sessions = await import('../src/plugins/PlannerPlugin/lib/onTheClockDb.ts');

function fixture(t) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON');
  for (const name of ['planner', 'personal', 'collections']) {
    sqlite.exec(readFileSync(new URL(`../src-tauri/src/database/schema/${name}.sql`, import.meta.url), 'utf8'));
  }
  const calls = [];
  let failAt = -1;
  const values = list => list.map(value => typeof value === 'boolean' ? Number(value) : value);
  globalThis.__plannerDb = {
    select: async (sql, params = []) => { calls.push({ sql, params }); return sqlite.prepare(sql).all(...values(params)); },
    execute: async (sql, params = []) => sqlite.prepare(sql).run(...values(params)),
    executeBatch: async statements => {
      sqlite.exec('BEGIN');
      try {
        const results = statements.map(({ sql, values: params = [] }, i) => {
          if (i === failAt) throw new Error('injected interruption');
          return sqlite.prepare(sql).run(...values(params));
        });
        sqlite.exec('COMMIT');
        return results;
      } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  };
  t.after(() => sqlite.close());
  return { sqlite, calls, fail: i => { failAt = i; },
    node: id => sqlite.prepare('INSERT INTO nodes (id,title) VALUES (?,?)').run(id, id),
    session: id => sqlite.prepare("INSERT INTO work_sessions (id,title,planned_date,status,actual_start) VALUES (?,?,'2026-09-09','active','2026-09-09T00:00:00Z')").run(id, id),
    row: (sql, ...params) => sqlite.prepare(sql).get(...params),
  };
}

test('task create and group replacement roll back on invalid group; cascades preserve trigger', async t => {
  const f = fixture(t);
  await assert.rejects(planner.createNode({ title: 'rollback', group_ids: ['missing'] }), /FOREIGN KEY/);
  assert.equal(f.row('SELECT COUNT(*) AS n FROM nodes').n, 0);
  f.node('a'); f.node('b');
  f.sqlite.exec("INSERT INTO planner_groups (id,name) VALUES ('g','group')");
  await planner.replaceNodeGroups('a', ['g']);
  await assert.rejects(planner.replaceNodeGroups('a', ['missing']), /FOREIGN KEY/);
  assert.deepEqual((await planner.getNodeGroups('a')).map(g => g.id), ['g']);
  await planner.deleteNode('a');
  assert.equal(f.row("SELECT COUNT(*) AS n FROM node_groups WHERE node_id='a'").n, 0);
  assert.equal(f.row("SELECT COUNT(*) AS n FROM sqlite_master WHERE name='readd_ungrouped_if_empty'").n, 1);
  assert.equal((await planner.getNodeGroups('b')).length, 1);
});

test('task completion is idempotent and reopening removes its completion log', async t => {
  const f = fixture(t); f.node('a');
  await planner.completeNode('a'); await planner.completeNode('a');
  assert.equal(f.row('SELECT COUNT(*) AS n FROM productivity_logs').n, 1);
  await planner.uncompleteNode('a');
  assert.equal(f.row('SELECT COUNT(*) AS n FROM productivity_logs').n, 0);
  assert.equal(f.row("SELECT is_completed FROM nodes WHERE id='a'").is_completed, 0);
});

test('failed arc/project deletion preserves child relationships; successful deletion uses FKs', async t => {
  const f = fixture(t); f.node('a');
  f.sqlite.exec(`INSERT INTO arcs(id,name) VALUES ('arc','Arc');
    INSERT INTO projects(id,name,arc_id) VALUES ('project','Project','arc');
    UPDATE nodes SET arc_id='arc',project_id='project' WHERE id='a';
    CREATE TRIGGER block_project_delete BEFORE DELETE ON projects BEGIN SELECT RAISE(ABORT,'blocked project'); END;
    CREATE TRIGGER block_arc_delete BEFORE DELETE ON arcs BEGIN SELECT RAISE(ABORT,'blocked arc'); END;`);
  await assert.rejects(planner.deleteProject('project'), /blocked project/);
  await assert.rejects(planner.deleteArc('arc'), /blocked arc/);
  assert.equal(f.row("SELECT project_id FROM nodes WHERE id='a'").project_id, 'project');
  assert.equal(f.row("SELECT arc_id FROM nodes WHERE id='a'").arc_id, 'arc');
  assert.equal(f.row("SELECT arc_id FROM projects WHERE id='project'").arc_id, 'arc');
  f.sqlite.exec('DROP TRIGGER block_project_delete; DROP TRIGGER block_arc_delete;');
  await planner.deleteProject('project');
  assert.equal(f.row("SELECT project_id FROM nodes WHERE id='a'").project_id, null);
  await planner.deleteArc('arc');
  assert.equal(f.row("SELECT arc_id FROM nodes WHERE id='a'").arc_id, null);
  assert.equal(f.row("SELECT COUNT(*) AS n FROM nodes WHERE id='a'").n, 1);
});

test('100 task hydration uses two selects and targeted loading only queries requested groups', async t => {
  const f = fixture(t);
  for (let i = 0; i < 100; i++) f.node(`n${i}`);
  const rows = await planner.loadNodes();
  assert.equal(rows.length, 100);
  assert.equal(f.calls.length, 2);
  assert.ok(rows.every(row => row.groups.length === 1));
  f.calls.length = 0;
  await planner.loadNodeById('n1');
  assert.equal(f.calls.length, 2);
  assert.deepEqual(f.calls[1].params, ['n1']);
});

test('pauses are clipped and overlapping/open pauses are counted once', () => {
  const at = minute => `2026-09-09T00:${String(minute).padStart(2,'0')}:00Z`;
  assert.equal(netSessionMinutes(at(10), at(50), [
    { paused_at: at(0), resumed_at: at(15) },
    { paused_at: at(20), resumed_at: at(30) },
    { paused_at: at(25), resumed_at: at(35) },
    { paused_at: at(45), resumed_at: null },
  ]), 15);
  assert.equal(netSessionMinutes(at(50), at(10), []), 0);
});

test('queue/restart preserves effort; carry-over totals all sessions; repeated finish cannot double count', async t => {
  const f = fixture(t); f.node('a'); f.session('s1'); f.session('s2');
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-09-09T00:00:00Z') });
  await sessions.addNodesToSession('s1', ['a']);
  await sessions.startNode('s1', 'a');
  t.mock.timers.tick(10 * 60_000);
  await sessions.returnNodeToQueue('s1', 'a');
  assert.equal(f.row("SELECT total_minutes FROM session_nodes WHERE session_id='s1'").total_minutes, 10);
  await sessions.startNode('s1', 'a');
  t.mock.timers.tick(10 * 60_000);
  await sessions.moveUnfinishedToSession('s1', 's2');
  assert.equal(f.row("SELECT total_minutes FROM session_nodes WHERE session_id='s1'").total_minutes, 20);
  assert.equal(f.row("SELECT status FROM work_sessions WHERE id='s1'").status, 'interrupted');
  await sessions.startNode('s2', 'a');
  t.mock.timers.tick(30 * 60_000);
  await sessions.finishNode('s2', 'a'); await sessions.finishNode('s2', 'a');
  assert.equal((await sessions.loadTaskSessionMinutes())[0].total_minutes, 50);
  assert.equal(f.row('SELECT COUNT(*) AS n FROM productivity_logs').n, 1);
});

test('failed session finish/move cannot partially settle time or complete planner task', async t => {
  const f = fixture(t); f.node('a'); f.session('s');
  await sessions.addNodesToSession('s', ['a']); await sessions.startNode('s', 'a');
  const before = f.row('SELECT * FROM session_nodes');
  f.fail(1);
  await assert.rejects(sessions.finishNode('s', 'a'), /interruption/);
  assert.deepEqual(f.row('SELECT * FROM session_nodes'), before);
  assert.equal(f.row("SELECT is_completed FROM nodes WHERE id='a'").is_completed, 0);
  assert.equal(f.row('SELECT COUNT(*) AS n FROM productivity_logs').n, 0);
  f.fail(-1);
  await assert.rejects(sessions.moveUnfinishedToSession('s', 'missing'), /FOREIGN KEY/);
  assert.deepEqual(f.row('SELECT * FROM session_nodes'), before);
  assert.equal(f.row("SELECT status FROM work_sessions WHERE id='s'").status, 'active');
  await assert.rejects(sessions.finishNode('missing', 'a'), /not part/);
});

function delayNextPauseRead() {
  const db = globalThis.__plannerDb;
  const select = db.select;
  let entered;
  let release;
  const waiting = new Promise(resolve => { entered = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  let intercepted = false;
  db.select = async (sql, params = []) => {
    const rows = await select(sql, params);
    if (!intercepted && sql.includes('SELECT paused_at, resumed_at')) {
      intercepted = true;
      entered();
      await gate;
    }
    return rows;
  };
  return { waiting, release };
}

test('delayed settlement cannot overwrite a later queued restart', async t => {
  const f = fixture(t); f.node('a'); f.session('s');
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-09-09T00:00:00Z') });
  await sessions.addNodesToSession('s', ['a']); await sessions.startNode('s', 'a');
  t.mock.timers.tick(10 * 60_000);
  const delay = delayNextPauseRead();
  const first = sessions.returnNodeToQueue('s', 'a');
  await delay.waiting;
  const restart = sessions.returnNodeToQueue('s', 'a').then(() => sessions.startNode('s', 'a'));
  await new Promise(resolve => setImmediate(resolve));
  t.mock.timers.tick(5 * 60_000);
  delay.release();
  await Promise.all([first, restart]);
  const row = f.row("SELECT status,time_started,total_minutes FROM session_nodes WHERE session_id='s'");
  assert.equal(row.status, 'in_progress');
  assert.equal(row.time_started, '2026-09-09T00:15:00.000Z');
  assert.equal(row.total_minutes, 10);
});

test('moving tasks reserves both sessions before target operations start', async t => {
  const f = fixture(t); f.node('a'); f.session('from'); f.session('to');
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-09-09T00:00:00Z') });
  await sessions.addNodesToSession('from', ['a']); await sessions.startNode('from', 'a');
  t.mock.timers.tick(10 * 60_000);
  const delay = delayNextPauseRead();
  const moving = sessions.moveUnfinishedToSession('from', 'to');
  await delay.waiting;
  const starting = sessions.startNode('to', 'a');
  await new Promise(resolve => setImmediate(resolve));
  delay.release();
  await Promise.all([moving, starting]);
  assert.equal(f.row("SELECT status FROM session_nodes WHERE session_id='to'").status, 'in_progress');
  assert.equal(f.row("SELECT total_minutes FROM session_nodes WHERE session_id='from'").total_minutes, 10);
});

test('a failed settlement rolls back and lets the next session operation proceed', async t => {
  const f = fixture(t); f.node('a'); f.session('s');
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-09-09T00:00:00Z') });
  await sessions.addNodesToSession('s', ['a']); await sessions.startNode('s', 'a');
  t.mock.timers.tick(10 * 60_000);
  const before = f.row('SELECT * FROM session_nodes');
  const delay = delayNextPauseRead();
  f.fail(1);
  const finishing = assert.rejects(sessions.finishNode('s', 'a'), /interruption/);
  await delay.waiting;
  const restarting = sessions.startNode('s', 'a');
  delay.release();
  await Promise.all([finishing, restarting]);
  assert.deepEqual(f.row('SELECT * FROM session_nodes'), before);
  assert.equal(f.row("SELECT is_completed FROM nodes WHERE id='a'").is_completed, 0);
  assert.equal(f.row('SELECT COUNT(*) AS n FROM productivity_logs').n, 0);
  f.fail(-1);
  await sessions.finishNode('s', 'a');
  assert.equal(f.row('SELECT total_minutes FROM session_nodes').total_minutes, 10);
});

test('opposite moves complete in invocation order without blocking an unrelated session', async t => {
  const f = fixture(t); f.node('a'); f.node('b'); f.session('from'); f.session('to'); f.session('other');
  await sessions.addNodesToSession('from', ['a']); await sessions.startNode('from', 'a');
  const delay = delayNextPauseRead();
  const outgoing = sessions.moveUnfinishedToSession('from', 'to');
  await delay.waiting;
  const returning = sessions.moveUnfinishedToSession('to', 'from');
  await sessions.addNodesToSession('other', ['b']);
  assert.equal(f.row("SELECT node_id FROM session_nodes WHERE session_id='other'").node_id, 'b');
  delay.release();
  await Promise.all([outgoing, returning]);
  assert.equal(f.row("SELECT COUNT(*) AS n FROM session_nodes WHERE session_id='to'").n, 0);
  assert.equal(f.row("SELECT COUNT(*) AS n FROM session_nodes WHERE session_id='from'").n, 1);
});

test('calendar queries include local midnight with offset formats and exclude next day/future', async t => {
  const oldTz = process.env.TZ; process.env.TZ = 'Asia/Seoul';
  t.after(() => { if (oldTz === undefined) delete process.env.TZ; else process.env.TZ = oldTz; });
  const f = fixture(t);
  const times = ['2026-09-08T14:59:59Z', '2026-09-08T15:00:00Z', '2026-09-09T10:00:00+09:00', '2026-09-09T15:00:00Z'];
  times.forEach((time,i) => { f.node(`n${i}`); f.sqlite.prepare('UPDATE nodes SET is_completed=1, actual_completed_at=? WHERE id=?').run(time, `n${i}`); });
  assert.deepEqual(localDateRange('2026-09-09','2026-09-09'), ['2026-09-08T15:00:00.000Z','2026-09-09T15:00:00.000Z']);
  assert.equal((await planner.loadCompletionsForRange('2026-09-09','2026-09-09')).length, 2);
  assert.deepEqual((await planner.loadIrfTaskData(1, new Date('2026-09-09T00:00:00Z'))).map(n => n.id), ['n1']);
  process.env.TZ = 'America/New_York';
  const [start,end] = localDateRange('2026-03-08','2026-03-08');
  assert.equal((Date.parse(end)-Date.parse(start))/3_600_000, 23);
});
