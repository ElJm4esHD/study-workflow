import type { DatabaseSync } from 'node:sqlite';
import type { SettingsService } from './registry.ts';

export function makeSettings(db: DatabaseSync): SettingsService {
  return {
    getAll: () => Object.fromEntries(
      (db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[])
        .map((r) => [r.key, JSON.parse(r.value)]),
    ),
    get<T>(key: string, fallback: T): T {
      const r = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
      return r ? (JSON.parse(r.value) as T) : fallback;
    },
    set(key, value) {
      db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
        .run(key, JSON.stringify(value));
    },
  };
}
