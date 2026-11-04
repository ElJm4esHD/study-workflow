import { mkdtempSync, readdirSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { expect, test } from 'vitest';
import { backupTo } from './backup.ts';

const tmp = () => mkdtempSync(join(tmpdir(), 'bk-'));

test('backup crea una copia legible con los mismos datos', () => {
  const d = tmp();
  const src = join(d, 'src.sqlite');
  const db = new DatabaseSync(src);
  db.exec("CREATE TABLE t (x); INSERT INTO t VALUES ('hola')");
  db.close();
  const dest = join(d, 'pre-deploy-1.sqlite');
  backupTo(src, dest);
  const copy = new DatabaseSync(dest);
  expect(copy.prepare('SELECT x FROM t').all()).toEqual([{ x: 'hola' }]);
  copy.close();
});

test('backup conserva solo los 10 pre-deploy más nuevos', () => {
  const d = tmp();
  const src = join(d, 'src.sqlite');
  new DatabaseSync(src).close();
  for (let i = 1; i <= 12; i++) {
    const f = join(d, `pre-deploy-${String(i).padStart(2, '0')}.sqlite`);
    writeFileSync(f, '');
    utimesSync(f, 1000 + i, 1000 + i);
  }
  backupTo(src, join(d, 'pre-deploy-99.sqlite')); // el nuevo (mtime actual) es el más reciente
  const left = readdirSync(d).filter((f) => f.startsWith('pre-deploy-')).sort();
  expect(left).toHaveLength(10);
  expect(left).toContain('pre-deploy-99.sqlite');
  expect(left).not.toContain('pre-deploy-01.sqlite');
  expect(left).not.toContain('pre-deploy-03.sqlite');
  expect(left).toContain('pre-deploy-04.sqlite');
});
