CREATE TABLE IF NOT EXISTS personal_settings (
  id TEXT PRIMARY KEY CHECK (id = 'current'),
  revision INTEGER NOT NULL CHECK (revision > 0),
  schema_version INTEGER NOT NULL CHECK (schema_version > 0),
  settings_json TEXT NOT NULL CHECK (json_valid(settings_json)),
  saved_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS personal_settings_history (
  revision INTEGER PRIMARY KEY CHECK (revision > 0),
  schema_version INTEGER NOT NULL CHECK (schema_version > 0),
  settings_json TEXT NOT NULL CHECK (json_valid(settings_json)),
  saved_at TEXT NOT NULL
);
