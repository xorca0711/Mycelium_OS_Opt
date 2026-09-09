-- ─────────────────── NOTES PLUGIN ────────────────────────────────────────

  CREATE TABLE IF NOT EXISTS notes (
    id            TEXT PRIMARY KEY,
    note_type     TEXT NOT NULL DEFAULT 'memo'
                      CHECK(note_type IN('memo','document')),
    title         TEXT,
    content_plain TEXT,
    content_json  TEXT,
    status        TEXT NOT NULL DEFAULT 'active'
                      CHECK(status IN('active','archived')),
    arc_id        TEXT,
    project_id    TEXT,
    pinned        BOOLEAN NOT NULL DEFAULT 0,
    color_hex     TEXT,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(arc_id)     REFERENCES arcs(id)     ON DELETE SET NULL,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE SET NULL
  );

  CREATE TRIGGER IF NOT EXISTS notes_ts AFTER UPDATE ON notes
  BEGIN
    UPDATE notes SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

  CREATE TABLE IF NOT EXISTS note_groups (
    note_id   TEXT NOT NULL,
    group_id  TEXT NOT NULL,
    PRIMARY KEY(note_id, group_id),
    FOREIGN KEY(note_id)  REFERENCES notes(id)          ON DELETE CASCADE,
    FOREIGN KEY(group_id) REFERENCES planner_groups(id)  ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_notes_type    ON notes(note_type);
  CREATE INDEX IF NOT EXISTS idx_notes_status  ON notes(note_type, status);
  CREATE INDEX IF NOT EXISTS idx_notes_arc     ON notes(arc_id);
  CREATE INDEX IF NOT EXISTS idx_notes_project ON notes(project_id);
  CREATE INDEX IF NOT EXISTS idx_ng_note       ON note_groups(note_id);
  CREATE INDEX IF NOT EXISTS idx_ng_group      ON note_groups(group_id);

  -- ─────────────────── DOC COMMENTS ────────────────────────────────────────

  CREATE TABLE IF NOT EXISTS doc_comments (
    id          TEXT PRIMARY KEY,
    doc_id      TEXT NOT NULL,
    mark_id     TEXT NOT NULL,
    body        TEXT NOT NULL,
    resolved    INTEGER DEFAULT 0,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(doc_id) REFERENCES notes(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_comments_doc ON doc_comments(doc_id);

  -- ─────────────────── NOTE LINKS (wiki-link backlink cache) ───────────────────

  CREATE TABLE IF NOT EXISTS note_links (
    source_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    PRIMARY KEY (source_id, target_id),
    FOREIGN KEY (source_id) REFERENCES notes(id) ON DELETE CASCADE,
    FOREIGN KEY (target_id) REFERENCES notes(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_links_target ON note_links(target_id);

  -- ─────────────────── SLEEP TRACKER ───────────────────────────────────────

  CREATE TABLE IF NOT EXISTS sleep_entries (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    date        TEXT NOT NULL,
    sleep_start TEXT NOT NULL,
    wake_time   TEXT NOT NULL,
    is_nap      INTEGER DEFAULT 0,
    notes       TEXT,
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_sleep_entries_date  ON sleep_entries(date);
  CREATE INDEX IF NOT EXISTS idx_sleep_entries_start ON sleep_entries(sleep_start);

  CREATE TABLE IF NOT EXISTS sleep_targets (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    target_sleep_start TEXT NOT NULL,
    target_duration    REAL NOT NULL,
    set_at             TEXT DEFAULT (datetime('now'))
  );

  -- ─────────────────── DISPATCH PLUGIN ──────────────────────────────────────

  CREATE TABLE IF NOT EXISTS dispatch_locations (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    color       TEXT NOT NULL DEFAULT '#666666',
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS dispatch_work_blocks (
    id          TEXT PRIMARY KEY,
    date        TEXT NOT NULL,
    start_time  INTEGER NOT NULL,
    end_time    INTEGER NOT NULL,
    location_id TEXT,
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(location_id) REFERENCES dispatch_locations(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_dispatch_wb_date ON dispatch_work_blocks(date);

  CREATE TABLE IF NOT EXISTS dispatch_node_placements (
    id                TEXT PRIMARY KEY,
    work_block_id     TEXT NOT NULL,
    node_id           TEXT NOT NULL,
    start_offset      INTEGER NOT NULL DEFAULT 0,
    duration_override INTEGER,
    created_at        TEXT DEFAULT (datetime('now')),
    updated_at        TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(work_block_id) REFERENCES dispatch_work_blocks(id) ON DELETE CASCADE,
    FOREIGN KEY(node_id)       REFERENCES nodes(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_dispatch_np_block ON dispatch_node_placements(work_block_id);
  CREATE INDEX IF NOT EXISTS idx_dispatch_np_node  ON dispatch_node_placements(node_id);

  -- ─────────────────── HABITS PLUGIN ───────────────────────────────────────

  CREATE TABLE IF NOT EXISTS habits (
    id             TEXT PRIMARY KEY,
    name           TEXT NOT NULL,
    color          TEXT NOT NULL DEFAULT '#4a8c6e',
    type           TEXT NOT NULL DEFAULT 'daily'
                       CHECK(type IN('daily','weekly','times_per_week')),
    times_per_week INTEGER,
    sort_order     INTEGER NOT NULL DEFAULT 0,
    created_at     TEXT DEFAULT (datetime('now')),
    archived_at    TEXT
  );

  CREATE TABLE IF NOT EXISTS habit_logs (
    id         TEXT PRIMARY KEY,
    habit_id   TEXT NOT NULL,
    date       TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(habit_id, date),
    FOREIGN KEY(habit_id) REFERENCES habits(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_habit_logs_habit ON habit_logs(habit_id);
  CREATE INDEX IF NOT EXISTS idx_habit_logs_date  ON habit_logs(date);

  -- ─────────────────── JOURNAL PLUGIN ──────────────────────────────────────

  CREATE TABLE IF NOT EXISTS journal_entries (
    id          TEXT PRIMARY KEY,
    date        TEXT NOT NULL UNIQUE,
    content     TEXT NOT NULL DEFAULT '',
    images      TEXT NOT NULL DEFAULT '[]',
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TRIGGER IF NOT EXISTS journal_ts AFTER UPDATE ON journal_entries
  BEGIN
    UPDATE journal_entries SET updated_at = datetime('now') WHERE id = NEW.id;
  END;

  CREATE INDEX IF NOT EXISTS idx_journal_date ON journal_entries(date);

  -- ─────────────────── ACADEMIC PLUGIN ─────────────────────────────────────

  CREATE TABLE IF NOT EXISTS academic_subjects (
    project_id TEXT PRIMARY KEY,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS academic_canvases (
    id         TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name       TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS academic_canvas_nodes (
    canvas_id   TEXT NOT NULL,
    node_id     TEXT NOT NULL,
    day         TEXT NOT NULL,
    x_slot      INTEGER DEFAULT 0,
    is_deadline INTEGER DEFAULT 0,
    PRIMARY KEY (canvas_id, node_id),
    FOREIGN KEY (canvas_id) REFERENCES academic_canvases(id) ON DELETE CASCADE,
    FOREIGN KEY (node_id)   REFERENCES nodes(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS academic_canvas_edges (
    canvas_id    TEXT NOT NULL,
    from_node_id TEXT NOT NULL,
    to_node_id   TEXT NOT NULL,
    PRIMARY KEY (canvas_id, from_node_id, to_node_id),
    FOREIGN KEY (canvas_id)    REFERENCES academic_canvases(id) ON DELETE CASCADE,
    FOREIGN KEY (from_node_id) REFERENCES nodes(id) ON DELETE CASCADE,
    FOREIGN KEY (to_node_id)   REFERENCES nodes(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_ac_project ON academic_canvases(project_id);
  CREATE INDEX IF NOT EXISTS idx_acn_canvas ON academic_canvas_nodes(canvas_id);
  CREATE INDEX IF NOT EXISTS idx_ace_canvas ON academic_canvas_edges(canvas_id);

  -- ─────────────────── ON THE CLOCK ─────────────────────────────────────────

  CREATE TABLE IF NOT EXISTS work_locations (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL UNIQUE,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS work_sessions (
    id           TEXT PRIMARY KEY,
    title        TEXT NOT NULL,
    location_id  TEXT REFERENCES work_locations(id) ON DELETE SET NULL,
    planned_date TEXT NOT NULL,
    actual_start TEXT,
    actual_end   TEXT,
    status       TEXT NOT NULL DEFAULT 'planned'
                 CHECK(status IN('planned','active','paused','completed','interrupted')),
    created_at   TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS session_nodes (
    session_id    TEXT    NOT NULL REFERENCES work_sessions(id) ON DELETE CASCADE,
    node_id       TEXT    NOT NULL,
    sort_order    INTEGER NOT NULL DEFAULT 0,
    status        TEXT    NOT NULL DEFAULT 'queued'
                  CHECK(status IN('queued','in_progress','done','incomplete')),
    time_started  TEXT,
    time_finished TEXT,
    total_minutes REAL,
    PRIMARY KEY (session_id, node_id)
  );

  CREATE TABLE IF NOT EXISTS session_pauses (
    id          TEXT PRIMARY KEY,
    session_id  TEXT NOT NULL REFERENCES work_sessions(id) ON DELETE CASCADE,
    paused_at   TEXT NOT NULL,
    resumed_at  TEXT,
    pause_type  TEXT NOT NULL DEFAULT 'manual'
                CHECK(pause_type IN('manual','pomo_short','pomo_long'))
  );

  CREATE TABLE IF NOT EXISTS session_pomo_blocks (
    id          TEXT PRIMARY KEY,
    session_id  TEXT NOT NULL REFERENCES work_sessions(id) ON DELETE CASCADE,
    started_at  TEXT NOT NULL,
    ended_at    TEXT,
    block_type  TEXT NOT NULL
                CHECK(block_type IN('work','short_break','long_break'))
  );

  CREATE INDEX IF NOT EXISTS idx_ws_status   ON work_sessions(status);
  CREATE INDEX IF NOT EXISTS idx_ws_date     ON work_sessions(planned_date);
  CREATE INDEX IF NOT EXISTS idx_sn_session  ON session_nodes(session_id);
  CREATE INDEX IF NOT EXISTS idx_sp_session  ON session_pauses(session_id);
  CREATE INDEX IF NOT EXISTS idx_spb_session ON session_pomo_blocks(session_id);
