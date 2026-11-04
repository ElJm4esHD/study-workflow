import { readdirSync, readFileSync } from 'node:fs';
import type { DatabaseSync } from 'node:sqlite';

export function runMigrations(db: DatabaseSync, sets: { module: string; dir: URL }[]): void {
  db.exec(`CREATE TABLE IF NOT EXISTS migrations (
    module TEXT NOT NULL, version INTEGER NOT NULL, applied_at TEXT NOT NULL,
    PRIMARY KEY (module, version))`);
  const applied = db.prepare('SELECT 1 FROM migrations WHERE module = ? AND version = ?');
  const record = db.prepare('INSERT INTO migrations (module, version, applied_at) VALUES (?, ?, ?)');
  for (const { module, dir } of sets) {
    const files = readdirSync(dir)
      .map((f) => ({ f, m: /^(\d{3})_.*\.sql$/.exec(f) }))
      .filter((x) => x.m)
      .map((x) => ({ f: x.f, version: Number(x.m![1]) }))
      .sort((a, b) => a.version - b.version);
    for (const { f, version } of files) {
      if (applied.get(module, version)) continue;
      const sql = readFileSync(new URL(f, dir), 'utf8');
      db.exec('BEGIN IMMEDIATE');
      try {
        db.exec(sql);
        record.run(module, version, new Date().toISOString());
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    }
  }
}
