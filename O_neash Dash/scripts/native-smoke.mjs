// Run only against `pnpm tauri dev` launched with WebView2 remote debugging on 9223.
// Creates clearly labelled sample records only after checking native dev storage.
const phase = process.argv[2];
if (!['seed', 'verify'].includes(phase)) throw new Error('Usage: node scripts/native-smoke.mjs seed|verify');
const targets = await (await fetch('http://localhost:9223/json/list')).json();
const target = targets.find(t => t.url === 'http://localhost:1420/');
if (!target) throw new Error('Mycelium development webview not found');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let serial = 0;
const pending = new Map();
ws.onmessage = event => {
  const data = JSON.parse(event.data);
  if (data.id && pending.has(data.id)) {
    const { resolve, reject, timer } = pending.get(data.id);
    clearTimeout(timer); pending.delete(data.id);
    data.error ? reject(new Error(JSON.stringify(data.error))) : resolve(data.result);
  }
};
function command(method, params) {
  return new Promise((resolve, reject) => {
    const id = ++serial;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('Native smoke timed out')); }, 60000);
    pending.set(id, { resolve, reject, timer }); ws.send(JSON.stringify({ id, method, params }));
  });
}
async function inApp(phase) {
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const { getDataLocation } = await import('/src/lib/dataLocation.ts');
  const location = await getDataLocation();
  assert(location.development && /[\\/]O-neash-data-dev$/.test(location.directory), 'Refusing to use non-development storage');
  const { getDb } = await import('/src/lib/db.ts');
  const db = getDb();
  const planner = await import('/src/plugins/PlannerPlugin/lib/plannerDb.ts');
  const clock = await import('/src/plugins/PlannerPlugin/lib/onTheClockDb.ts');
  const notes = await import('/src/plugins/NotesPlugin/lib/notesDb.ts');
  const sleep = await import('/src/plugins/SleepTrackerPlugin/lib/sleepDb.ts');
  const habits = await import('/src/plugins/HabitsPlugin/lib/habitsDb.ts');
  const fonts = await import('/src/lib/fontSettings.ts');
  const media = await import('/src/plugins/NotesPlugin/lib/notesImageLib.ts');
  const key = 'mycelium:smoke:v1';
  let sample = JSON.parse(localStorage.getItem(key) || 'null');
  if (phase === 'seed') {
    assert(!sample, 'Sample already exists; use verify');
    const arc = await planner.createArc({ name: '[TEST] 개인 학습', color_hex: '#00c4a7' });
    const project = await planner.createProject({ name: '[TEST] 로컬 실행 확인', arc_id: arc });
    const task = await planner.createNode({ title: '[TEST] 한글 작업 완료', arc_id: arc, project_id: project, estimated_duration_minutes: 30 });
    const workplace = await clock.createLocation('[TEST] 연습 공간');
    const session = await clock.createSession(workplace.id, '2026-09-09');
    await clock.addNodesToSession(session, [task]); await clock.startSession(session); await clock.startNode(session, task);
    const pause = await clock.pauseSession(session); await clock.resumeSession(session, pause);
    await clock.finishNode(session, task); await clock.endSession(session, 'completed');
    const common = { note_type: 'document', content_plain: null, content_json: null, arc_id: arc, project_id: project };
    const targetNote = await notes.createNote({ ...common, title: '[TEST] 연결 대상' });
    const note = await notes.createNote({ ...common, title: '[TEST] 프로젝트 기록' });
    const pixel = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII='), c => c.charCodeAt(0));
    const imagePath = await media.saveImageBlob(new Blob([pixel], { type: 'image/png' }), 'png');
    const content = JSON.stringify({ type: 'doc', content: [
      { type: 'paragraph', content: [{ type: 'text', text: '[TEST] 한글 메모와 저장 확인 ' }, { type: 'wikiLink', attrs: { title: '[TEST] 연결 대상', targetId: targetNote } }] },
      { type: 'image', attrs: { src: imagePath, alt: '[TEST] sample pixel' } },
    ] });
    await notes.saveDocument(note, '[TEST] 프로젝트 기록', content);
    await notes.saveDocument(targetNote, '[TEST] 이름 변경 후 연결', JSON.stringify({ type: 'doc', content: [] }));
    await sleep.addEntry({ date: '2026-09-09', sleep_start: '2026-09-08T23:00:00+09:00', wake_time: '2026-09-09T07:00:00+09:00', notes: '[TEST] 수면 기록' });
    const habit = await habits.createHabit('[TEST] 독서', '#00c4a7', 'boolean', 'every_day', null);
    await habits.toggleBooleanLog(habit.id, '2026-09-09');
    fonts.setKoreanFont('Gulim');
    sample = { arc, project, task, session, note, targetNote, habit: habit.id, imagePath };
    localStorage.setItem(key, JSON.stringify(sample));
  }
  assert(sample, 'Seed first');
  const task = await planner.loadNodeById(sample.task);
  assert(task?.is_completed && task.project_id === sample.project && task.arc_id === sample.arc, 'Task hierarchy/completion did not persist');
  const sessions = await clock.loadAllSessions();
  assert(sessions.some(s => s.id === sample.session && s.status === 'completed' && s.actual_end), 'Session did not persist');
  const links = await notes.loadAllLinks();
  assert(links.some(l => l.source_id === sample.note && l.target_id === sample.targetNote), 'Stable link did not survive rename');
  const note = await notes.getNoteById(sample.note);
  assert(note?.project_id === sample.project && note.content_json.includes('한글'), 'Linked Korean note did not persist');
  assert((await sleep.getEntries()).some(s => s.notes === '[TEST] 수면 기록'), 'Sleep record missing');
  assert((await habits.getLogsForMonth(2026, 9)).some(l => l.habit_id === sample.habit), 'Habit log missing');
  assert(fonts.getKoreanFont() === 'Gulim', 'Font setting did not persist');
  const image = new Image(); image.src = media.toDisplaySrc(sample.imagePath);
  await image.decode(); assert(image.naturalWidth === 1, 'Native image could not be decoded');
  const violations = await db.select('PRAGMA foreign_key_check'); assert(!violations.length, 'Foreign key violation');
  const migrations = await db.select('SELECT version FROM mycelium_schema_migrations ORDER BY version');
  const { invoke } = await import('/node_modules/@tauri-apps/api/core.js');
  assert(await invoke('supports_pdf_export') === false, 'Windows PDF availability mismatch');
  return { phase, location, migrations, sample, verified: ['arc/project/task', 'session/pause/completion', 'linked Korean note/rename', 'sleep', 'habit', 'native image', 'font setting', 'foreign keys', 'Windows PDF availability'] };
}
try {
  const result = await command('Runtime.evaluate', { expression: `(${inApp.toString()})(${JSON.stringify(phase)})`, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || JSON.stringify(result.exceptionDetails));
  console.log(JSON.stringify(result.result.value, null, 2));
} finally { ws.close(); }
