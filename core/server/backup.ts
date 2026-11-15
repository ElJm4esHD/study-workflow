import { readdirSync, statSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const KEEP = 10;

export function backupTo(dbPath: string, dest: string): void {
  const db = new DatabaseSync(dbPath);
  try { db.prepare('VACUUM INTO ?').run(dest); } finally { db.close(); }
  const dir = dirname(dest);
  readdirSync(dir)
    .filter((f) => /^pre-deploy-.*\.sqlite$/.test(f))
    .map((f) => ({ f, t: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t)
    .slice(KEEP)
    .forEach(({ f }) => unlinkSync(join(dir, f)));
}

if (import.meta.main) {
  const dest = process.argv[2];
  if (!dest) { console.error('Uso: node core/server/backup.ts <destino>'); process.exit(1); }
  backupTo(process.env.DB_PATH ?? './data/sync.sqlite', resolve(dest));
}
