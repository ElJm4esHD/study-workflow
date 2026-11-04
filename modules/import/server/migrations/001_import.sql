CREATE TABLE import_plans (id TEXT PRIMARY KEY, title TEXT, created_at TEXT NOT NULL);
CREATE TABLE import_plan_items (
  plan_id TEXT NOT NULL REFERENCES import_plans(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('todo','event')),
  item_id TEXT NOT NULL,
  PRIMARY KEY (plan_id, item_type, item_id));
