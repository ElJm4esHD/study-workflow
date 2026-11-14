CREATE TABLE finals_dates (
  id TEXT PRIMARY KEY,
  materia_id TEXT NOT NULL REFERENCES materias(id),
  date TEXT NOT NULL, time TEXT);
CREATE INDEX finals_dates_materia ON finals_dates(materia_id);
-- Eventos del calendario creados por la combinación elegida (para deshacer).
CREATE TABLE finals_chosen (materia_id TEXT PRIMARY KEY REFERENCES materias(id), event_id TEXT NOT NULL);
