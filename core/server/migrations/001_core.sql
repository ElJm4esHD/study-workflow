CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL); -- value en JSON
CREATE TABLE materias (
  id TEXT PRIMARY KEY, name TEXT NOT NULL,
  name_key TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
