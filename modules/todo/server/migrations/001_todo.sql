CREATE TABLE todo_items (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, notes TEXT,
  due_date TEXT, due_time TEXT,
  materia_id TEXT REFERENCES materias(id),
  completed INTEGER NOT NULL DEFAULT 0, completed_at TEXT,
  sort_order REAL NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX todo_items_due ON todo_items(due_date);
