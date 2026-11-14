ALTER TABLE todo_items ADD COLUMN reminder_min INTEGER;
ALTER TABLE todo_items ADD COLUMN reminder_insistent INTEGER NOT NULL DEFAULT 0;
