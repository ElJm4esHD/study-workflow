CREATE TABLE calendar_events (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, notes TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('evento','parcial','recuperatorio','final')),
  materia_id TEXT REFERENCES materias(id),
  all_day INTEGER NOT NULL,
  start_date TEXT NOT NULL, start_time TEXT,
  end_date TEXT NOT NULL, end_time TEXT,
  repeat_weekdays TEXT,
  repeat_until TEXT,
  series_id TEXT REFERENCES calendar_events(id) ON DELETE CASCADE,
  original_date TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE calendar_exdates (
  event_id TEXT NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  date TEXT NOT NULL, PRIMARY KEY (event_id, date));
CREATE INDEX calendar_events_start ON calendar_events(start_date);
