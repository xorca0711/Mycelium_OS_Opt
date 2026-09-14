import { getDb, executeBatch, type SqlStatement } from '@/lib/db';
import { netSessionMinutes } from './sessionTiming';
import { serializeSessionOperation } from './sessionOperations';

export interface WorkLocation {
  id: string;
  name: string;
  created_at: string;
}

export interface WorkSession {
  id: string;
  title: string;
  location_id: string | null;
  location_name?: string;
  planned_date: string;
  actual_start: string | null;
  actual_end: string | null;
  status: 'planned' | 'active' | 'paused' | 'completed' | 'interrupted';
  created_at: string;
}

export interface SessionNode {
  session_id: string;
  node_id: string;
  sort_order: number;
  status: 'queued' | 'in_progress' | 'done' | 'incomplete';
  time_started: string | null;
  time_finished: string | null;
  total_minutes: number | null;
}

export interface SessionNodeWithNode extends SessionNode {
  title: string;
  node_type: string;
  arc_id: string | null;
  project_id: string | null;
  arc_color: string;
  arc_name: string | null;
}

export interface SessionPause {
  id: string;
  session_id: string;
  paused_at: string;
  resumed_at: string | null;
  pause_type: 'manual';
}

export interface BrowsableNode {
  id: string;
  title: string;
  node_type: string;
  is_routine: number; // 0 or 1
  planned_date: string | null;
  arc_color: string;
  arc_name: string | null;
}

// ── Locations ─────────────────────────────────────────────────────────────────

export async function loadLocations(): Promise<WorkLocation[]> {
  return getDb().select('SELECT * FROM work_locations ORDER BY name ASC');
}

export async function createLocation(name: string): Promise<WorkLocation> {
  const id = crypto.randomUUID();
  await getDb().execute('INSERT INTO work_locations (id, name) VALUES (?, ?)', [id, name]);
  return { id, name, created_at: new Date().toISOString() };
}

export async function deleteLocation(id: string): Promise<void> {
  await getDb().execute('DELETE FROM work_locations WHERE id = ?', [id]);
}

// ── Title generation ──────────────────────────────────────────────────────────

export async function generateTitle(locationId: string, date: string): Promise<string> {
  const locs = await getDb().select<{ name: string }[]>(
    'SELECT name FROM work_locations WHERE id = ?', [locationId],
  );
  const slug = locs.length ? locs[0].name.toLowerCase().replace(/\s+/g, '-') : 'session';
  const base = `${date.replace(/-/g, '')}-${slug}`;
  const existing = await getDb().select<{ title: string }[]>(
    'SELECT title FROM work_sessions WHERE title LIKE ?', [`${base}%`],
  );
  if (!existing.length) return base;
  const maxSuffix = existing.reduce((max, r) => {
    const m = r.title.match(/-(\d{2})$/);
    return m ? Math.max(max, parseInt(m[1])) : Math.max(max, 0);
  }, 0);
  return `${base}-${String(maxSuffix + 1).padStart(2, '0')}`;
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export async function loadActiveSession(): Promise<WorkSession | null> {
  const rows = await getDb().select<WorkSession[]>(
    `SELECT ws.*, wl.name as location_name
     FROM work_sessions ws
     LEFT JOIN work_locations wl ON wl.id = ws.location_id
     WHERE ws.status IN ('active','paused') LIMIT 1`,
  );
  return rows[0] ?? null;
}

export async function loadTodaySessions(date: string): Promise<WorkSession[]> {
  return getDb().select<WorkSession[]>(
    `SELECT ws.*, wl.name as location_name
     FROM work_sessions ws
     LEFT JOIN work_locations wl ON wl.id = ws.location_id
     WHERE ws.planned_date = ?
     ORDER BY ws.created_at ASC`,
    [date],
  );
}

export async function loadSessionsForWeek(from: string, to: string): Promise<WorkSession[]> {
  return getDb().select<WorkSession[]>(
    `SELECT ws.*, wl.name as location_name
     FROM work_sessions ws
     LEFT JOIN work_locations wl ON wl.id = ws.location_id
     WHERE ws.actual_start IS NOT NULL
       AND ws.planned_date >= ? AND ws.planned_date <= ?
     ORDER BY ws.actual_start ASC`,
    [from, to],
  );
}

export async function loadAllSessions(limit = 60): Promise<WorkSession[]> {
  return getDb().select<WorkSession[]>(
    `SELECT ws.*, wl.name as location_name
     FROM work_sessions ws
     LEFT JOIN work_locations wl ON wl.id = ws.location_id
     ORDER BY ws.planned_date DESC, ws.created_at DESC
     LIMIT ?`,
    [limit],
  );
}

export async function loadAllTimedSessions(): Promise<WorkSession[]> {
  return getDb().select<WorkSession[]>(
    `SELECT ws.*, wl.name as location_name
     FROM work_sessions ws
     LEFT JOIN work_locations wl ON wl.id = ws.location_id
     WHERE ws.actual_start IS NOT NULL
     ORDER BY ws.actual_start ASC`,
  );
}

export async function createSession(locationId: string, plannedDate: string): Promise<string> {
  const id = crypto.randomUUID();
  const title = await generateTitle(locationId, plannedDate);
  await getDb().execute(
    'INSERT INTO work_sessions (id, title, location_id, planned_date) VALUES (?, ?, ?, ?)',
    [id, title, locationId, plannedDate],
  );
  return id;
}

async function startSessionInternal(sessionId: string): Promise<void> {
  const now = new Date().toISOString();
  await executeBatch([
    { sql: `UPDATE work_sessions SET status = 'active', actual_start = COALESCE(actual_start, ?) WHERE id = ?`, values: [now, sessionId] },
    { sql: `DELETE FROM session_nodes WHERE session_id = ? AND status = 'queued' AND COALESCE(total_minutes, 0) = 0
      AND node_id IN (SELECT id FROM nodes WHERE is_completed = 1)`, values: [sessionId] },
  ]);
}

async function pauseSessionInternal(sessionId: string): Promise<string> {
  const now = new Date().toISOString();
  const pauseId = crypto.randomUUID();
  await executeBatch([
    { sql: `UPDATE work_sessions SET status = 'paused' WHERE id = ?`, values: [sessionId] },
    { sql: `INSERT INTO session_pauses (id, session_id, paused_at, pause_type)
      SELECT ?, ?, ?, 'manual' WHERE NOT EXISTS (SELECT 1 FROM session_pauses WHERE session_id = ? AND resumed_at IS NULL)`, values: [pauseId, sessionId, now, sessionId] },
  ]);
  const active = await getDb().select<{id:string}[]>(`SELECT id FROM session_pauses WHERE session_id = ? AND resumed_at IS NULL ORDER BY paused_at LIMIT 1`, [sessionId]);
  return active[0]?.id ?? pauseId;
}

async function resumeSessionInternal(sessionId: string, pauseId: string): Promise<void> {
  const now = new Date().toISOString();
  await executeBatch([
    { sql: `UPDATE work_sessions SET status = 'active' WHERE id = ?`, values: [sessionId] },
    { sql: `UPDATE session_pauses SET resumed_at = ? WHERE session_id = ? AND resumed_at IS NULL`, values: [now, sessionId] },
  ]);
}

async function endSessionInternal(sessionId: string, status: 'completed' | 'interrupted'): Promise<void> {
  return endSessionAtInternal(sessionId, status, new Date().toISOString());
}

async function updateSessionEndTimeInternal(sessionId: string, endTime: string): Promise<void> {
  await getDb().execute(
    `UPDATE work_sessions SET actual_end = ? WHERE id = ?`,
    [endTime, sessionId],
  );
}

async function endSessionAtInternal(sessionId: string, status: 'completed' | 'interrupted', endTime: string): Promise<void> {
  if (!Number.isFinite(Date.parse(endTime))) throw new Error('Invalid session end time');
  const rows = await getDb().select<{node_id:string}[]>(`SELECT node_id FROM session_nodes WHERE session_id = ? AND status = 'in_progress'`, [sessionId]);
  const statements = await Promise.all(rows.map(row => settleStatement(sessionId, row.node_id, 'incomplete', endTime)));
  await executeBatch([...statements, ...endStatements(sessionId, status, endTime)]);
}

async function deleteSessionInternal(sessionId: string): Promise<void> {
  await getDb().execute('DELETE FROM work_sessions WHERE id = ?', [sessionId]);
}

export async function loadSessionPauses(sessionId: string): Promise<SessionPause[]> {
  return getDb().select<SessionPause[]>(
    'SELECT * FROM session_pauses WHERE session_id = ? ORDER BY paused_at ASC',
    [sessionId],
  );
}

// ── Session nodes ─────────────────────────────────────────────────────────────

export interface SessionNodeMinutes {
  node_id: string;
  total_minutes: number;
}

/** Total recorded effort per task, including work carried over from incomplete sessions. */
export async function loadTaskSessionMinutes(): Promise<SessionNodeMinutes[]> {
  return getDb().select<SessionNodeMinutes[]>(
    `SELECT node_id, SUM(total_minutes) AS total_minutes FROM session_nodes
     WHERE total_minutes > 0 GROUP BY node_id`,
  );
}

export async function loadSessionNodes(sessionId: string): Promise<SessionNodeWithNode[]> {
  return getDb().select<SessionNodeWithNode[]>(
    `SELECT sn.*,
            n.title, n.node_type, n.arc_id, n.project_id,
            COALESCE(a.color_hex, '#888888') as arc_color,
            a.name as arc_name
     FROM session_nodes sn
     JOIN nodes n ON n.id = sn.node_id
     LEFT JOIN arcs a ON a.id = n.arc_id
     WHERE sn.session_id = ?
     ORDER BY
       CASE sn.status WHEN 'in_progress' THEN 0 WHEN 'queued' THEN 1 ELSE 2 END,
       sn.sort_order ASC`,
    [sessionId],
  );
}

async function addNodesToSessionInternal(sessionId: string, nodeIds: string[]): Promise<void> {
  if (!nodeIds.length) return;
  await executeBatch(nodeIds.map(nodeId => ({ sql: `INSERT OR IGNORE INTO session_nodes (session_id, node_id, sort_order)
    SELECT ?, ?, COALESCE(MAX(sort_order), -1) + 1 FROM session_nodes WHERE session_id = ?`, values: [sessionId, nodeId, sessionId] })));
}

async function computeNetMinutes(sessionId: string, timeStarted: string, timeFinished: string): Promise<number> {
  const pauses = await getDb().select<{ paused_at: string; resumed_at: string | null }[]>(
    `SELECT paused_at, resumed_at FROM session_pauses
     WHERE session_id = ?`,
    [sessionId],
  );
  return netSessionMinutes(timeStarted, timeFinished, pauses);
}

async function settleStatement(sessionId: string, nodeId: string, status: SessionNode['status'], now: string): Promise<SqlStatement> {
  const rows = await getDb().select<SessionNode[]>('SELECT * FROM session_nodes WHERE session_id = ? AND node_id = ?', [sessionId, nodeId]);
  const row = rows[0];
  if (!row) throw new Error('Task is not part of this session');
  const started = row?.status === 'in_progress' ? row.time_started : null;
  const net = started ? await computeNetMinutes(sessionId, started, now) : 0;
  return { sql: `UPDATE session_nodes SET
    total_minutes = COALESCE(total_minutes, 0) + CASE WHEN status = 'in_progress' AND time_started = ? THEN ? ELSE 0 END,
    time_finished = CASE WHEN status = 'in_progress' OR time_finished IS NULL THEN ? ELSE time_finished END,
    time_started = CASE WHEN ? = 'queued' THEN NULL ELSE time_started END,
    status = ? WHERE session_id = ? AND node_id = ?`, values: [started, net, now, status, status, sessionId, nodeId] };
}

function completionStatements(nodeId: string, now: string): SqlStatement[] {
  return [
    { sql: `INSERT INTO productivity_logs (id, node_id, completed_at) SELECT ?, id, ? FROM nodes WHERE id = ? AND is_completed = 0`, values: [crypto.randomUUID(), now, nodeId] },
    { sql: `UPDATE nodes SET is_completed = 1, actual_completed_at = COALESCE(actual_completed_at, ?)
      WHERE id = ?`, values: [now, nodeId] },
  ];
}

function endStatements(sessionId: string, status: string, now: string): SqlStatement[] {
  return [
    { sql: `UPDATE session_pauses SET resumed_at = ? WHERE session_id = ? AND resumed_at IS NULL`, values: [now, sessionId] },
    { sql: `UPDATE work_sessions SET status = ?, actual_end = ? WHERE id = ?`, values: [status, now, sessionId] },
  ];
}

async function startNodeInternal(sessionId: string, nodeId: string): Promise<void> {
  await getDb().execute(
    `UPDATE session_nodes SET status = 'in_progress', time_started = ?, time_finished = NULL WHERE session_id = ? AND node_id = ? AND status IN ('queued', 'incomplete')`,
    [new Date().toISOString(), sessionId, nodeId],
  );
}

async function finishNodeInternal(sessionId: string, nodeId: string): Promise<void> {
  const now = new Date().toISOString();
  await executeBatch([await settleStatement(sessionId, nodeId, 'done', now), ...completionStatements(nodeId, now)]);
}

async function markNodeIncompleteInternal(sessionId: string, nodeId: string): Promise<void> {
  await executeBatch([await settleStatement(sessionId, nodeId, 'incomplete', new Date().toISOString())]);
}

async function returnNodeToQueueInternal(sessionId: string, nodeId: string): Promise<void> {
  await executeBatch([await settleStatement(sessionId, nodeId, 'queued', new Date().toISOString())]);
}

async function removeNodeFromSessionInternal(sessionId: string, nodeId: string): Promise<void> {
  await getDb().execute(
    'DELETE FROM session_nodes WHERE session_id = ? AND node_id = ?',
    [sessionId, nodeId],
  );
}

// ── Force-stop helpers ────────────────────────────────────────────────────────

async function carryOverUnfinishedInternal(sessionId: string): Promise<void> {
  await moveUnfinishedToSessionInternal(sessionId, null);
}

async function moveUnfinishedToSessionInternal(fromId: string, toId: string | null): Promise<void> {
  if (fromId === toId) throw new Error('Choose a different target session');
  const db = getDb();
  const now = new Date().toISOString();
  const unfinished = await db.select<{ node_id: string; status: string; time_started: string | null }[]>(
    `SELECT node_id, status, time_started FROM session_nodes
     WHERE session_id = ? AND status IN ('queued','in_progress')`,
    [fromId],
  );
  const statements = await Promise.all(unfinished.filter(n => n.status === 'in_progress')
    .map(sn => settleStatement(fromId, sn.node_id, 'incomplete', now)));
  if (toId && unfinished.length) {
    for (const sn of unfinished) {
      statements.push({ sql: `INSERT OR IGNORE INTO session_nodes (session_id, node_id, sort_order, status)
        SELECT ?, ?, COALESCE(MAX(sort_order), -1) + 1, 'queued' FROM session_nodes WHERE session_id = ?`, values: [toId, sn.node_id, toId] });
    }
  }
  statements.push(
    { sql: `UPDATE session_nodes SET status = 'incomplete' WHERE session_id = ? AND status = 'queued' AND total_minutes > 0`, values: [fromId] },
    { sql: `DELETE FROM session_nodes WHERE session_id = ? AND status = 'queued' AND COALESCE(total_minutes, 0) = 0`, values: [fromId] },
    ...endStatements(fromId, 'interrupted', now),
  );
  await executeBatch(statements);
}

async function markAllNodesDoneInternal(sessionId: string): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  const rows = await db.select<{ node_id: string; time_started: string | null }[]>(
    `SELECT node_id, time_started FROM session_nodes WHERE session_id = ? AND status IN ('in_progress','queued')`,
    [sessionId],
  );
  const statements: SqlStatement[] = [];
  for (const sn of rows) statements.push(await settleStatement(sessionId, sn.node_id, 'done', now), ...completionStatements(sn.node_id, now));
  await executeBatch([...statements, ...endStatements(sessionId, 'completed', now)]);
}

// These queues cover the reads used to calculate time as well as the atomic write.
export const startSession = serializeSessionOperation(startSessionInternal);
export const pauseSession = serializeSessionOperation(pauseSessionInternal);
export const resumeSession = serializeSessionOperation(resumeSessionInternal);
export const endSession = serializeSessionOperation(endSessionInternal);
export const updateSessionEndTime = serializeSessionOperation(updateSessionEndTimeInternal);
export const endSessionAt = serializeSessionOperation(endSessionAtInternal);
export const deleteSession = serializeSessionOperation(deleteSessionInternal);
export const addNodesToSession = serializeSessionOperation(addNodesToSessionInternal);
export const startNode = serializeSessionOperation(startNodeInternal);
export const finishNode = serializeSessionOperation(finishNodeInternal);
export const markNodeIncomplete = serializeSessionOperation(markNodeIncompleteInternal);
export const returnNodeToQueue = serializeSessionOperation(returnNodeToQueueInternal);
export const removeNodeFromSession = serializeSessionOperation(removeNodeFromSessionInternal);
export const carryOverUnfinished = serializeSessionOperation(carryOverUnfinishedInternal);
export const moveUnfinishedToSession = serializeSessionOperation(
  moveUnfinishedToSessionInternal, (fromId, toId) => toId ? [fromId, toId] : [fromId],
);
export const markAllNodesDone = serializeSessionOperation(markAllNodesDoneInternal);

// ── Arc time breakdown ────────────────────────────────────────────────────────

export interface ArcBreakdown {
  arc_name:      string;
  arc_color:     string;
  total_minutes: number;
  task_count:    number;
}

export async function loadArcBreakdown(from: string, to: string): Promise<ArcBreakdown[]> {
  return getDb().select<ArcBreakdown[]>(
    `SELECT
       COALESCE(a.name, 'untracked')    AS arc_name,
       COALESCE(a.color_hex, '#666666') AS arc_color,
       SUM(sn.total_minutes)            AS total_minutes,
       COUNT(DISTINCT sn.node_id)       AS task_count
     FROM session_nodes sn
     JOIN nodes n            ON n.id  = sn.node_id
     LEFT JOIN arcs a        ON a.id  = n.arc_id
     JOIN work_sessions ws   ON ws.id = sn.session_id
     WHERE sn.total_minutes > 0
       AND ws.planned_date >= ? AND ws.planned_date <= ?
     GROUP BY a.id, a.name, a.color_hex
     ORDER BY total_minutes DESC`,
    [from, to],
  );
}

// ── Node browser ──────────────────────────────────────────────────────────────

export async function loadBrowsableNodes(excludeNodeIds: string[] = []): Promise<BrowsableNode[]> {
  const db = getDb();
  if (excludeNodeIds.length) {
    const ph = excludeNodeIds.map(() => '?').join(',');
    return db.select<BrowsableNode[]>(
      `SELECT n.id, n.title, n.node_type, COALESCE(n.is_routine, 0) as is_routine,
              DATE(COALESCE(n.planned_start_at, n.due_at)) as planned_date,
              COALESCE(a.color_hex,'#888888') as arc_color, a.name as arc_name
       FROM nodes n LEFT JOIN arcs a ON a.id = n.arc_id
       WHERE n.is_completed = 0 AND n.id NOT IN (${ph})
       ORDER BY planned_date ASC, n.created_at ASC`,
      excludeNodeIds,
    );
  }
  return db.select<BrowsableNode[]>(
    `SELECT n.id, n.title, n.node_type, COALESCE(n.is_routine, 0) as is_routine,
            DATE(COALESCE(n.planned_start_at, n.due_at)) as planned_date,
            COALESCE(a.color_hex,'#888888') as arc_color, a.name as arc_name
     FROM nodes n LEFT JOIN arcs a ON a.id = n.arc_id
     WHERE n.is_completed = 0
     ORDER BY planned_date ASC, n.created_at ASC`,
  );
}
