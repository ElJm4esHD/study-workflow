ALTER TABLE calendar_events ADD COLUMN reminder_min INTEGER;
ALTER TABLE calendar_events ADD COLUMN reminder_insistent INTEGER NOT NULL DEFAULT 0;
