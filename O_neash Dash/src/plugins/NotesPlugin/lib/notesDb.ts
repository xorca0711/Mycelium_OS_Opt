import { getDb, executeBatch } from '@/lib/db';
import { prepareDocumentLinks, type LinkDocument } from './noteLinks';
import { publishNoteChange, commitNoteChange } from './noteEvents';

export interface NoteRow {
  id: string;
  note_type: 'memo' | 'document';
  title: string | null;
  content_plain: string | null;
  content_json: string | null;
  status: 'active' | 'archived';
  arc_id: string | null;
  project_id: string | null;
  pinned: number;
  color_hex: string | null;
  created_at: string;
  updated_at: string;
}

const gid = () => Math.random().toString(36).slice(2, 18);
type Statement = { sql: string; values?: (string | number | boolean | null)[] };
let catalog: Promise<LinkDocument[]> | undefined;
export function invalidateDocumentCatalog(): void { catalog = undefined; }
export function getDocumentCatalog(): Promise<LinkDocument[]> {
  return catalog ??= Promise.all([
    getDb().select<{ id: string; title: string | null }[]>(`SELECT id, title FROM notes WHERE note_type = 'document' AND status = 'active'`),
    getDb().select<{ target_id: string; title: string }[]>(`SELECT target_id, title FROM note_title_aliases`),
  ]).then(([docs, aliases]) => docs.map(doc => ({ ...doc, aliases: aliases.filter(a => a.target_id === doc.id).map(a => a.title) })))
    .catch(error => { catalog = undefined; throw error; });
}

async function outgoingLinkStatements(sourceId: string, targetIds: readonly string[]): Promise<Statement[]> {
  const previous = await getDb().select<{ target_id: string }[]>(`SELECT target_id FROM note_links WHERE source_id = ?`, [sourceId]);
  const oldIds = new Set(previous.map(link => link.target_id));
  const nextIds = new Set(targetIds);
  return [
    ...previous.filter(link => !nextIds.has(link.target_id)).map(link => ({ sql: `DELETE FROM note_links WHERE source_id = ? AND target_id = ?`, values: [sourceId, link.target_id] })),
    ...targetIds.filter(id => !oldIds.has(id)).map(id => ({ sql: `INSERT OR IGNORE INTO note_links (source_id, target_id) VALUES (?, ?)`, values: [sourceId, id] })),
  ];
}

export async function saveDocument(id: string, title: string, contentJson: string): Promise<NoteRow> {
  const before = await getNoteById(id);
  if (!before || before.note_type !== 'document') throw new Error('The document no longer exists.');
  const prepared = prepareDocumentLinks(id, contentJson, await getDocumentCatalog());
  const links = await outgoingLinkStatements(id, prepared.targetIds);
  const statements: Statement[] = [];
  if (before.title && before.title !== title) {
    statements.push({ sql: `INSERT OR IGNORE INTO note_title_aliases (target_id, title) VALUES (?, ?)`, values: [id, before.title] });
  }
  statements.push({ sql: `UPDATE notes SET title = ?, content_json = ?, updated_at = STRFTIME('%Y-%m-%d %H:%M:%f', 'now') WHERE id = ?`, values: [title, prepared.contentJson, id] }, ...links);
  return commitNoteChange(async () => {
    await executeBatch(statements);
    if (before.title !== title) catalog = undefined;
    const saved = await getNoteById(id);
    if (!saved) throw new Error('The document was deleted while saving.');
    return saved;
  }, { id, kind: 'updated', linksChanged: links.length > 0 });
}

export async function getNoteById(id: string): Promise<NoteRow | null> {
  const rows = await getDb().select<NoteRow[]>(`SELECT * FROM notes WHERE id = ?`, [id]);
  return rows[0] ?? null;
}

export async function loadArchivedMemos(): Promise<NoteRow[]> {
  const db = getDb();
  return db.select<NoteRow[]>(
    `SELECT * FROM notes WHERE note_type = 'memo' AND status = 'archived' ORDER BY updated_at DESC`,
  );
}

export async function loadNotes(type?: 'memo' | 'document'): Promise<NoteRow[]> {
  const db = getDb();
  if (type) {
    return db.select<NoteRow[]>(
      `SELECT * FROM notes WHERE note_type = ? AND status = 'active' ORDER BY pinned DESC, updated_at DESC`,
      [type],
    );
  }
  return db.select<NoteRow[]>(
    `SELECT * FROM notes WHERE status = 'active' ORDER BY pinned DESC, updated_at DESC`,
  );
}

export async function createNote(
  data: Pick<NoteRow, 'note_type' | 'title' | 'content_plain' | 'content_json' | 'arc_id' | 'project_id'>,
): Promise<string> {
  const id = gid();
  const prepared = data.content_json ? prepareDocumentLinks(id, data.content_json, await getDocumentCatalog()) : null;
  await executeBatch([
    { sql: `INSERT INTO notes (id, note_type, title, content_plain, content_json, arc_id, project_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      values: [id, data.note_type, data.title ?? null, data.content_plain ?? null, prepared?.contentJson ?? null, data.arc_id ?? null, data.project_id ?? null] },
    ...(prepared?.targetIds ?? []).map(target => ({ sql: `INSERT OR IGNORE INTO note_links (source_id, target_id) VALUES (?, ?)`, values: [id, target] })),
  ]);
  catalog = undefined;
  publishNoteChange({ id, kind: 'created', linksChanged: !!prepared?.targetIds.length });
  return id;
}

export async function updateNote(id: string, patch: Partial<Pick<NoteRow, 'title' | 'content_plain' | 'content_json' | 'arc_id' | 'project_id' | 'pinned' | 'color_hex' | 'status'>>): Promise<void> {
  const db = getDb();
  const allowed = new Set(['title', 'content_plain', 'content_json', 'arc_id', 'project_id', 'pinned', 'color_hex', 'status']);
  const entries = Object.entries(patch).filter(([, value]) => value !== undefined);
  if (!entries.length) return;
  if (entries.some(([key]) => !allowed.has(key))) throw new Error('Unsupported note field.');
  if ('title' in patch || 'content_json' in patch) {
    const note = await getNoteById(id);
    if (note?.note_type === 'document') {
      await saveDocument(id, patch.title ?? note.title ?? '', patch.content_json ?? note.content_json ?? '{"type":"doc","content":[]}');
      const rest = entries.filter(([key]) => key !== 'title' && key !== 'content_json');
      if (!rest.length) return;
      await updateNote(id, Object.fromEntries(rest));
      return;
    }
  }
  const fields = entries.map(([key]) => `${key} = ?`).join(', ');
  await db.execute(`UPDATE notes SET ${fields}, updated_at = STRFTIME('%Y-%m-%d %H:%M:%f', 'now') WHERE id = ?`, [...entries.map(([, value]) => value), id]);
  catalog = undefined;
  publishNoteChange({ id, kind: 'updated', linksChanged: false });
}

export async function deleteNote(id: string): Promise<void> {
  await executeBatch([
    { sql: `DELETE FROM note_links WHERE source_id = ? OR target_id = ?`, values: [id, id] },
    { sql: `DELETE FROM doc_comments WHERE doc_id = ?`, values: [id] },
    { sql: `DELETE FROM note_title_aliases WHERE target_id = ?`, values: [id] },
    { sql: `DELETE FROM notes WHERE id = ?`, values: [id] },
  ]);
  catalog = undefined;
  publishNoteChange({ id, kind: 'deleted', linksChanged: true });
}

export async function archiveNote(id: string): Promise<void> {
  await updateNote(id, { status: 'archived' });
}

export async function promoteToDocument(id: string, title: string, contentJson: string): Promise<void> {
  const prepared = prepareDocumentLinks(id, contentJson, await getDocumentCatalog());
  const links = await outgoingLinkStatements(id, prepared.targetIds);
  await executeBatch([
    { sql: `UPDATE notes SET note_type = 'document', title = ?, content_json = ?, updated_at = STRFTIME('%Y-%m-%d %H:%M:%f', 'now') WHERE id = ?`, values: [title, prepared.contentJson, id] },
    ...links,
  ]);
  catalog = undefined;
  publishNoteChange({ id, kind: 'promoted', linksChanged: links.length > 0 });
}

// ── Doc comments ──────────────────────────────────────────────────────────────

export interface CommentRow {
  id: string;
  doc_id: string;
  mark_id: string;
  body: string;
  resolved: number;
  created_at: string;
}

export async function loadComments(docId: string): Promise<CommentRow[]> {
  const db = getDb();
  return db.select<CommentRow[]>(
    `SELECT * FROM doc_comments WHERE doc_id = ? ORDER BY created_at ASC`,
    [docId],
  );
}

export async function createComment(docId: string, markId: string, body: string): Promise<string> {
  const db = getDb();
  const id = gid();
  await db.execute(
    `INSERT INTO doc_comments (id, doc_id, mark_id, body) VALUES (?, ?, ?, ?)`,
    [id, docId, markId, body],
  );
  return id;
}

export async function deleteComment(id: string): Promise<void> {
  const db = getDb();
  await db.execute(`DELETE FROM doc_comments WHERE id = ?`, [id]);
}

export async function updateComment(id: string, body: string): Promise<void> {
  const db = getDb();
  await db.execute(`UPDATE doc_comments SET body = ? WHERE id = ?`, [body, id]);
}

// ── Wiki-link graph ────────────────────────────────────────────────────────────

export interface BacklinkRow {
  id: string;
  title: string | null;
  updated_at: string;
}

export async function loadAllLinks(): Promise<{ source_id: string; target_id: string }[]> {
  const db = getDb();
  return db.select<{ source_id: string; target_id: string }[]>(
    `SELECT source_id, target_id FROM note_links`,
  );
}

export async function getBacklinks(targetId: string): Promise<BacklinkRow[]> {
  const db = getDb();
  return db.select<BacklinkRow[]>(
    `SELECT n.id, n.title, n.updated_at
       FROM note_links l
       JOIN notes n ON n.id = l.source_id
      WHERE l.target_id = ?
      ORDER BY n.updated_at DESC`,
    [targetId],
  );
}
