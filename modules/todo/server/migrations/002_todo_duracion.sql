ALTER TABLE todo_items ADD COLUMN duration_min INTEGER;
ALTER TABLE todo_items ADD COLUMN category TEXT NOT NULL DEFAULT 'tarea';
