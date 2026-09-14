-- Import identity and history live beside Notes in the same database.
-- Source deletion is restricted so provenance cannot silently disappear.
CREATE TABLE IF NOT EXISTS import_sources (
  id         TEXT PRIMARY KEY NOT NULL,
  kind       TEXT NOT NULL,
  source_id  TEXT NOT NULL,
  label      TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(kind, source_id)
);

CREATE TABLE IF NOT EXISTS import_records (
  source_id    TEXT NOT NULL REFERENCES import_sources(id) ON DELETE RESTRICT,
  external_id  TEXT NOT NULL,
  note_id      TEXT REFERENCES notes(id) ON DELETE SET NULL,
  content_hash TEXT NOT NULL,
  source_updated_at TEXT,
  imported_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(source_id, external_id)
);

CREATE TABLE IF NOT EXISTS import_runs (
  id            TEXT PRIMARY KEY NOT NULL,
  source_id     TEXT NOT NULL REFERENCES import_sources(id) ON DELETE RESTRICT,
  started_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at  TEXT,
  created_count INTEGER NOT NULL DEFAULT 0 CHECK(created_count >= 0),
  updated_count INTEGER NOT NULL DEFAULT 0 CHECK(updated_count >= 0),
  skipped_count INTEGER NOT NULL DEFAULT 0 CHECK(skipped_count >= 0),
  status        TEXT NOT NULL DEFAULT 'running'
);

CREATE INDEX IF NOT EXISTS idx_import_records_note ON import_records(note_id);
CREATE INDEX IF NOT EXISTS idx_import_runs_source_started ON import_runs(source_id, started_at DESC);

-- notesDb.loadNotes: filter and order without sorting matching note bodies.
CREATE INDEX IF NOT EXISTS idx_notes_type_status_order
  ON notes(note_type, status, pinned DESC, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_status_order
  ON notes(status, pinned DESC, updated_at DESC);

-- onTheClockDb.loadTodaySessions / loadAllSessions.
CREATE INDEX IF NOT EXISTS idx_ws_date_created
  ON work_sessions(planned_date DESC, created_at DESC);

-- plannerDb.uncompleteNode and the node deletion foreign-key lookup.
CREATE INDEX IF NOT EXISTS idx_productivity_logs_node ON productivity_logs(node_id);

-- The old idx_ng_group name belongs to node_groups: index names are database-wide.
CREATE INDEX IF NOT EXISTS idx_note_groups_group ON note_groups(group_id);

-- onTheClockDb.loadTaskSessionMinutes: covering aggregate of positive recorded effort.
CREATE INDEX IF NOT EXISTS idx_session_nodes_effort
  ON session_nodes(node_id, total_minutes) WHERE total_minutes > 0;
