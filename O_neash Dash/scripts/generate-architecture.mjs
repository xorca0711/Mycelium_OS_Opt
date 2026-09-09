// Run from any directory with Node 24+: node scripts/generate-architecture.mjs
// Reads source SQL only. Never opens a personal or development database.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import dagre from 'dagre';

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(app, '../docs/architecture');
fs.mkdirSync(out, { recursive: true });
const read = p => fs.readFileSync(path.join(app, p), 'utf8');
const remote = 'https://github.com/xorca0711/Mycelium_OS_Opt/blob/codex/local-setup/O_neash%20Dash/';
const url = p => remote + p.split('/').map(encodeURIComponent).join('/');
const esc = x => String(x).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const database = new DatabaseSync(':memory:');
const sourceByTable = new Map();
for (const file of ['planner', 'personal', 'collections']) {
  const source = `src-tauri/src/database/schema/${file}.sql`;
  const sql = read(source);
  database.exec(sql);
  for (const m of sql.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)) sourceByTable.set(m[1], source);
}
const migrationSource = 'src-tauri/src/database/migrations.rs';
const migrations = read(migrationSource);
// Additive column declarations used by migration 2 (skip columns present in fresh schema).
for (const m of migrations.matchAll(/\("(\w+)", "(\w+)", "([^"]+)"\)/g)) {
  if (!sourceByTable.has(m[1])) continue;
  if (!database.prepare(`PRAGMA table_info(${m[1]})`).all().some(c => c.name === m[2])) {
    database.exec(`ALTER TABLE ${m[1]} ADD COLUMN ${m[2]} ${m[3]}`);
  }
}
// Read native CREATE TABLE migration strings; exclude unrelated Rust control flow.
for (const m of migrations.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)\s*\([\s\S]*?\);/g)) {
  database.exec(m[0]);
  sourceByTable.set(m[1], migrationSource);
}
const version = Number(migrations.match(/CURRENT_VERSION: i64 = (\d+)/)[1]);
const tables = database.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(t => ({
  name: t.name, sql: t.sql, source: sourceByTable.get(t.name),
  columns: database.prepare(`PRAGMA table_info(${t.name})`).all(),
  foreignKeys: database.prepare(`PRAGMA foreign_key_list(${t.name})`).all(),
}));
const byName = new Map(tables.map(t => [t.name, t]));
const logical = [
  ['tendril_edges', 'project_id', 'projects', 'id'],
  ['session_nodes', 'node_id', 'nodes', 'id'],
  ['academic_subjects', 'project_id', 'projects', 'id'],
  ['academic_canvases', 'project_id', 'projects', 'id'],
  ['wardrobe_ootd_logs', 'item_ids JSON[]', 'wardrobe_items', 'id'],
  ['filmneg_photos', 'camera_id', 'filmneg_cameras', 'id'],
];
const pages = [];
const palette = { normal: ['#dae8fc', '#6c8ebf'], external: ['#f5f5f5', '#8b949e'], native: ['#d5e8d4', '#82b366'], storage: ['#fff2cc', '#d6b656'], logical: ['#e1d5e7', '#9673a6'] };
function addPage(id, name, nodes, edges, subtitle) {
  const g = new dagre.graphlib.Graph({ multigraph: true });
  g.setGraph({ rankdir: id === '01-runtime' ? 'TB' : 'LR', nodesep: 50, ranksep: 110, marginx: 35, marginy: 40 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of nodes) g.setNode(n.id, { width: 350, height: Math.max(110, 64 + n.lines.length * 23) });
  edges.forEach((e, i) => g.setEdge(e.from, e.to, { width: e.label.length * 7.4, height: 22 }, String(i)));
  dagre.layout(g);
  nodes.forEach(n => Object.assign(n, g.node(n.id)));
  edges.forEach((e, i) => Object.assign(e, g.edge(e.from, e.to, String(i))));
  pages.push({ id, name, nodes, edges, subtitle, width: Math.max(1050, g.graph().width + 40), height: g.graph().height + 115 });
}
function tablePage(id, name, names, subtitle = '') {
  const primary = new Set(names);
  const all = new Set(names);
  const edges = [];
  for (const name of names) {
    const table = byName.get(name);
    if (!table) throw new Error(`Missing table ${name}`);
    for (const fk of table.foreignKeys) {
      all.add(fk.table);
      edges.push({ from: name, to: fk.table, label: `${fk.from}: ${fk.on_delete}`, kind: 'fk' });
    }
    for (const [from, col, to] of logical.filter(l => l[0] === name)) {
      all.add(to);
      edges.push({ from, to, label: `${col}: logical`, kind: 'logical' });
    }
  }
  const nodes = [...all].map(name => {
    const t = byName.get(name);
    const pk = t.columns.filter(c => c.pk).sort((a, b) => a.pk - b.pk).map(c => c.name);
    const lines = [`PK ${pk.join(', ') || '(none declared)'}`];
    for (const fk of t.foreignKeys) lines.push(`FK ${fk.from} -> ${fk.table}.${fk.to}`);
    for (const [, col, target] of logical.filter(l => l[0] === name)) lines.push(`~ ${col} -> ${target}`);
    const important = t.columns.filter(c => !c.pk && !t.foreignKeys.some(f => f.from === c.name)).slice(0, 2).map(c => c.name);
    if (important.length) lines.push(important.join(', '));
    lines.push(`${t.columns.length} columns · full detail in inventory`);
    return { id: name, title: name, lines, link: url(t.source), kind: primary.has(name) ? 'normal' : 'external', primary: primary.has(name) };
  });
  addPage(id, name, nodes, edges, `One SQLite file | arrows: child -> parent | solid: declared FK + ON DELETE | dashed: application/JSON join. ${subtitle}`);
}

addPage('01-runtime', 'Runtime / script architecture', [
  ['main', 'React entry', ['src/main.tsx', 'StrictMode -> App'], 'src/main.tsx'],
  ['app', 'App / initialization gate', ['setupDb() single-flight', 'ready OR error dismisses splash'], 'src/App.tsx'],
  ['nav', 'PluginBox + lazy registry', ['20 plugin routes', 'Suspense / error boundary'], 'src/plugins/PluginBox.tsx'],
  ['shell', 'Persistent shell', ['AlwaysOnTop + FloatingEditor', 'Home: visible feeds and quick actions', 'Hidden WidgetPanel is unmounted'], 'src/always-visible/AOT-elements.tsx'],
  ['state', 'Zustand / UI state', ['Plugin, planner, session, notes views', 'Mutations then scoped refresh/events'], 'src/store/usePluginStore.ts'],
  ['helpers', 'Domain DB helpers', ['plannerDb / onTheClockDb / notesDb', 'Other plugins issue their own queries'], 'src/lib/db.ts'],
  ['init', 'Native initialize_database', ['Resolve dev/release directory', 'Migrate before publishing shared pool'], 'src-tauri/src/database/mod.rs', 'native'],
  ['batch', 'Native execute_batch', ['Related writes on one transaction', 'Commit all or roll back'], 'src-tauri/src/database/mod.rs', 'native'],
  ['sql', 'Tauri plugin-sql', ['Database.get(databaseUrl)', 'Reads + remaining single writes'], 'src/lib/db.ts', 'native'],
  ['db', 'Shared SQLite pool / file', ['oneash-DB.db', 'FK-enabled connections; 10s busy timeout', 'All domains join by IDs or timestamps'], 'src-tauri/src/database/mod.rs', 'storage'],
].map(([id, title, lines, file, kind]) => ({ id, title, lines, link: url(file), kind: kind ?? 'normal' })), [
  ['main', 'app', 'mount'], ['app', 'init', 'initialize'], ['app', 'nav', 'when ready'], ['app', 'shell', 'when ready'],
  ['nav', 'state', 'view actions'], ['shell', 'state', 'quick actions'], ['state', 'helpers', 'load / mutate'],
  ['helpers', 'batch', 'executeBatch()'], ['helpers', 'sql', 'getDb()'], ['init', 'db', 'migrations + pool'], ['batch', 'db', 'atomic writes'], ['sql', 'db', 'SQL'],
].map(([from,to,label]) => ({from,to,label})), 'React + TypeScript / Tauri + Rust. Data flows back through promises, Zustand updates and note-change events.');

addPage('02-storage', 'Storage boundaries / personal inputs', [
  ['sqlfile', 'Primary SQLite data', ['Debug: Documents/O-neash-data-dev/', 'Release: Documents/O-neash-data/', 'Both: oneash-DB.db', 'No personal database read for this map'], 'src-tauri/src/database/mod.rs', 'storage'],
  ['media', 'Media files beside SQLite', ['notes-images/ and journal-images/', 'wardrobe-images/ and filmneg-images/', 'DB stores paths / JSON references'], 'src/lib/dataLocation.ts', 'storage'],
  ['local', 'WebView localStorage', ['Fonts; arc visibility; widget layout', 'Weather location; daily quote cache', 'Separate from SQLite backup'], 'src/lib/fontSettings.ts', 'storage'],
  ['mem', 'Session memory', ['Zustand state / note catalog', 'Feed cache: 15m TTL, deduped fetches', '60s retry cooldown; stale fallback'], 'src/widgets/lib/feedCache.ts', 'logical'],
  ['network', 'External sources', ['HN / BBC / Yonhap / Nature / Cell', 'Weather and quote APIs', 'HTTP reads, distinct from personal DB'], 'src/widgets/widgets/ResearchFeed.tsx', 'external'],
  ['views', 'Personal workspace views', ['Planner, notes, sleep, habits, journal', 'Academic, wardrobe, film, analytics', 'User-entered records and media'], 'src/plugins/registry.ts', 'normal'],
].map(([id,title,lines,file,kind]) => ({id,title,lines,link:url(file),kind})), [
  ['views','sqlfile','domain records'], ['views','media','images'], ['views','local','preferences'], ['network','mem','feed responses'], ['mem','views','cached articles'],
].map(([from,to,label]) => ({from,to,label})), 'One data file per environment, not one database per plugin. SQLite + media + WebView preferences are distinct storage surfaces.');

tablePage('03-planner', 'Planner / projects / task graph', ['arcs','projects','nodes','planner_groups','node_groups','sub_tasks','productivity_logs','user_capacity','tendril_edges']);
tablePage('04-routines', 'Routine templates / rules', ['routines','routine_rules','routine_groups'], 'nodes.routine_id is a fresh-schema FK; upgraded old columns may have no FK. See limitations.');
tablePage('05-sessions', 'On the Clock / session effort', ['work_locations','work_sessions','session_nodes','session_pauses','session_pomo_blocks'], 'session_nodes.node_id is a logical join, deliberately not shown as an FK.');
tablePage('06-notes', 'Notes / wiki graph / aliases', ['notes','note_groups','doc_comments','note_links','note_title_aliases'], 'Alias target IDs survive title changes. Composite legacy note IDs are a different contract.');
tablePage('07-personal', 'Personal tracking / migration ledger', ['sleep_entries','sleep_targets','habits','habit_logs','journal_entries','mycelium_schema_migrations'], 'Sleep -> completed tasks is a temporal analytics join, not a foreign key.');
tablePage('08-academic', 'Academic canvases / shared tasks', ['academic_subjects','academic_canvases','academic_canvas_nodes','academic_canvas_edges']);
tablePage('09-dispatch', 'Dispatch / work blocks', ['dispatch_locations','dispatch_work_blocks','dispatch_node_placements']);
tablePage('10-wardrobe', 'Wardrobe / wiki / daily outfits', ['wardrobe_wiki_entries','wardrobe_wiki_links','wardrobe_wiki_gallery_images','wardrobe_items','wardrobe_ootd_logs']);
tablePage('11-film', 'Film Neg Lab / photos / trails', ['filmneg_photos','filmneg_tags','filmneg_photo_tags','filmneg_trails','filmneg_trail_photos','filmneg_cameras']);

addPage('12-analytics', 'Personal analytics / logical joins', [
  ['sleep', 'Sleep history', ['sleep_entries: wake_time, sleep_start', 'Non-nap records in calendar window'], 'src/plugins/AnalyticsPlugin/panels/planner-sleep/sleepWindowData.ts', 'normal'],
  ['tasks', 'Completed planner tasks', ['nodes: actual_completed_at, arc_id', 'Events excluded; future tasks excluded'], 'src/plugins/PlannerPlugin/lib/plannerDb.ts', 'normal'],
  ['effort', 'Tracked effort', ['session_nodes: node_id, total_minutes', 'SUM across task sessions, including', 'effort from incomplete attempts'], 'src/plugins/PlannerPlugin/lib/onTheClockDb.ts', 'normal'],
  ['window', 'Bounded waking window', ['Local wake date; same cutoff as tasks', '[wake, min(next sleep, now, wake+20h))', 'Missing-night gaps stay unassigned'], 'src/plugins/AnalyticsPlugin/panels/planner-sleep/sleepWindows.ts', 'logical'],
  ['output', 'Daily output / feature rows', ['Task count + duration in same interval', 'CPS = sqrt(count x minutes) / hours', 'Arc counts + sleep features'], 'src/plugins/AnalyticsPlugin/panels/planner-sleep/clusterMath.ts', 'logical'],
  ['views', 'Analytics views', ['Sleep/output scatter and regression', 'Behavior clusters + recurrence', 'IRF: D+n uses local calendar dates'], 'src/plugins/AnalyticsPlugin/panels/planner-sleep/PlannerSleepPanel.tsx', 'normal'],
].map(([id,title,lines,file,kind])=>({id,title,lines,link:url(file),kind})), [
  ['sleep','window','timestamps'], ['tasks','output','completion within interval'], ['effort','output','node_id match'], ['window','output','bounded interval'], ['output','views','derived results'],
].map(([from,to,label])=>({from,to,label,kind:'logical'})), 'Dashed arrows are computed joins, not FK constraints. Current days are provisional. IRF retains its estimated-duration formula. No causal claim is implied.');

// Ensure every current table appears as a primary entity, not merely a cross-domain stub.
const covered = new Set(pages.flatMap(p => p.nodes.filter(n => n.primary).map(n => n.id)));
for (const t of tables) if (!covered.has(t.name)) throw new Error(`Unmapped current table: ${t.name}`);

let xml = `<mxfile host="app.diagrams.net" modified="${new Date().toISOString()}" version="26.0.0">`;
for (const page of pages) {
  xml += `<diagram id="${page.id}" name="${esc(page.name)}"><mxGraphModel page="1" pageWidth="${Math.ceil(page.width)}" pageHeight="${Math.ceil(page.height)}" grid="1" gridSize="10"><root><mxCell id="0"/><mxCell id="1" parent="0"/>`;
  const textCell = (id, value, y, size) => `<mxCell id="${id}" value="${esc(value)}" style="text;html=1;whiteSpace=wrap;fontSize=${size};align=left;" vertex="1" parent="1"><mxGeometry x="35" y="${y}" width="${page.width-70}" height="32" as="geometry"/></mxCell>`;
  xml += textCell(`${page.id}-title`,page.name,10,24) + textCell(`${page.id}-legend`,page.subtitle,47,13);
  for (const [i,e] of page.edges.entries()) {
    const id = `${page.id}-edge-${i}`;
    xml += `<mxCell id="${id}" value="${esc(e.label)}" edge="1" source="${page.id}-${e.from}" target="${page.id}-${e.to}" parent="1" style="edgeStyle=orthogonalEdgeStyle;html=1;fontSize=12;labelBackgroundColor=#ffffff;endArrow=block;${e.kind==='logical'?'dashed=1;strokeColor=#9673a6;':'strokeColor=#65778a;'}"><mxGeometry relative="1" as="geometry"><Array as="points">${e.points.slice(1,-1).map(pt=>`<mxPoint x="${Math.round(pt.x)}" y="${Math.round(pt.y+90)}"/>`).join('')}</Array></mxGeometry></mxCell>`;
  }
  for (const n of page.nodes) {
    const [fill,stroke] = palette[n.kind];
    const label = `<b>${esc(n.title)}</b><br><br>${n.lines.map(esc).join('<br>')}`;
    xml += `<mxCell id="${page.id}-${n.id}" value="${esc(label)}" link="${esc(n.link)}" tooltip="${esc(n.link)}" vertex="1" parent="1" style="rounded=1;whiteSpace=wrap;html=1;align=left;verticalAlign=top;spacing=14;fontSize=14;fillColor=${fill};strokeColor=${stroke};"><mxGeometry x="${Math.round(n.x-n.width/2)}" y="${Math.round(n.y-n.height/2+90)}" width="${n.width}" height="${n.height}" as="geometry"/></mxCell>`;
  }
  xml += '</root></mxGraphModel></diagram>';
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(page.width)}" height="${Math.ceil(page.height)}" viewBox="0 0 ${Math.ceil(page.width)} ${Math.ceil(page.height)}"><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#65778a"/></marker></defs><rect width="100%" height="100%" fill="#fff"/><text x="35" y="35" font-family="Arial,sans-serif" font-size="26" font-weight="bold" fill="#172d40">${esc(page.name)}</text>`;
  // Short subtitle lines stay readable even on narrow single-domain pages.
  const subtitleLines = page.subtitle.match(/.{1,115}(?:\s|$)/g) ?? [page.subtitle];
  svg += subtitleLines.map((line,i)=>`<text x="35" y="${59+i*17}" font-family="Arial,sans-serif" font-size="13" fill="#536574">${esc(line.trim())}</text>`).join('');
  for (const e of page.edges) {
    svg += `<polyline points="${e.points.map(pt=>`${pt.x},${pt.y+90}`).join(' ')}" fill="none" stroke="${e.kind==='logical'?'#9673a6':'#65778a'}" stroke-width="1.8" ${e.kind==='logical'?'stroke-dasharray="7 5"':''} marker-end="url(#arrow)"/>`;
    svg += `<rect x="${e.x-e.width/2-4}" y="${e.y+78}" width="${e.width+8}" height="23" fill="white"/><text x="${e.x}" y="${e.y+94}" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" fill="#526679">${esc(e.label)}</text>`;
  }
  for (const n of page.nodes) {
    const x=n.x-n.width/2, y=n.y-n.height/2+90;
    const [fill,stroke] = palette[n.kind];
    svg += `<a href="${esc(n.link)}" target="_blank"><rect x="${x}" y="${y}" width="${n.width}" height="${n.height}" rx="9" fill="${fill}" stroke="${stroke}" stroke-width="1.6"/><text x="${x+14}" y="${y+28}" font-family="Arial,sans-serif" font-size="17" font-weight="bold" fill="#18334d">${esc(n.title)}</text>`;
    n.lines.forEach((line,i)=>{svg+=`<text x="${x+14}" y="${y+58+i*23}" font-family="Arial,sans-serif" font-size="14" fill="#334b60">${esc(line)}</text>`;});
    svg += '</a>';
  }
  fs.writeFileSync(path.join(out,`${page.id}.svg`),svg+'</svg>');
}
fs.writeFileSync(path.join(out,'mycelium-architecture.drawio'),xml+'</mxfile>');
fs.writeFileSync(path.join(out,'schema-inventory.json'), JSON.stringify({ schemaVersion:version, provenance:'Source-only fresh-install schema; no personal database opened', tables, logicalJoins:logical },null,2)+'\n');

let inventory = `# SQLite schema inventory\n\nGenerated from source schema and additive migrations through version ${version}. **${tables.length} application tables, one SQLite file.** Internal SQLite tables (for example sqlite_sequence) are excluded. No personal database was inspected.\n\n`;
inventory += 'Fresh-install constraints are shown. Existing databases retain historical columns/tables; adding an old missing column does not recreate fresh-schema foreign keys. `routine_occurrences` is preserved when present, but not created by the current schema. `note_task_links` is referenced by legacy planner code but is not declared by the current schema; its existence and constraints are not assumed. The version ledger is `mycelium_schema_migrations`, not a `schema_version` table.\n\n';
for(const t of tables){
  inventory+=`## ${t.name}\n\n[Schema source](${url(t.source)})\n\n| Column | SQLite type | Key | Required | Default |\n|---|---|---|---|---|\n`;
  for(const c of t.columns){
    const keys=[c.pk?`PK(${c.pk})`:'',...t.foreignKeys.filter(f=>f.from===c.name).map(f=>`FK → ${f.table}.${f.to} / DELETE ${f.on_delete}`)].filter(Boolean).join('; ');
    inventory+=`| ${c.name} | ${c.type} | ${keys} | ${c.notnull?'NOT NULL':'—'} | ${String(c.dflt_value??'—').replaceAll('|','\\|')} |\n`;
  }
  inventory+='\n';
}
inventory+='## Logical joins (not foreign keys)\n\n| From | To | Enforcement |\n|---|---|---|\n'+logical.map(([t,c,p,k])=>`| ${t}.${c} | ${p}.${k} | Application / JSON convention |`).join('\n')+'\n\nSleep/output analytics joins `sleep_entries.wake_time` to `nodes.actual_completed_at` using bounded local-calendar waking windows; task effort joins `session_nodes.node_id` and sums session minutes. These are not cross-database joins.\n';
fs.writeFileSync(path.join(out,'schema-inventory.md'),inventory);
const gallery = '# Diagram previews\n\n[Customization map](customization-map.md) · [Personal data sources and local connections](local-data-connections.md)\n\nEditable source: [mycelium-architecture.drawio](mycelium-architecture.drawio). SVG nodes link to source code. Solid ER arrows are declared foreign keys from child to parent with delete actions; dashed arrows are logical application joins. Gray nodes reference another domain.\n\n'+pages.map(p=>`## ${p.name}\n\n[Open SVG](${p.id}.svg)\n\n![${p.name}](${p.id}.svg)\n`).join('\n');
fs.writeFileSync(path.join(out,'previews.md'),gallery);
console.log(JSON.stringify({ tables: tables.length, foreignKeys: tables.reduce((s,t)=>s+t.foreignKeys.length,0), pages:pages.length, schemaVersion:version, output:out },null,2));
