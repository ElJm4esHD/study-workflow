import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test } from 'vitest';
import { openDb } from './db.ts';
import { runMigrations } from './migrate.ts';

function dir(files: Record<string, string>): URL {
  const d = mkdtempSync(join(tmpdir(), 'mig-'));
  for (const [n, sql] of Object.entries(files)) writeFileSync(join(d, n), sql);
  return pathToFileURL(d + '/');
}
const rows = (db: ReturnType<typeof openDb>) =>
  db.prepare('SELECT module, version FROM migrations ORDER BY module, version').all();

test('aplica en orden numérico y registra cada versión', () => {
  const db = openDb(':memory:');
  const d = dir({ '002_b.sql': 'INSERT INTO t VALUES (1);', '001_a.sql': 'CREATE TABLE t (x);' });
  runMigrations(db, [{ module: 'm', dir: d }]);
  expect(rows(db)).toEqual([{ module: 'm', version: 1 }, { module: 'm', version: 2 }]);
});

test('no reaplica migraciones ya aplicadas', () => {
  const db = openDb(':memory:');
  const sets = [{ module: 'm', dir: dir({ '001_a.sql': 'CREATE TABLE t (x);' , '002_b.sql': 'CREATE TABLE u (x);' }) }];
  runMigrations(db, sets);
  runMigrations(db, sets);
  expect(rows(db)).toHaveLength(2);
});

test('las versiones son por módulo', () => {
  const db = openDb(':memory:');
  runMigrations(db, [
    { module: 'core', dir: dir({ '001_a.sql': 'CREATE TABLE a (x);' }) },
    { module: 'todo', dir: dir({ '001_a.sql': 'CREATE TABLE b (x);' }) },
  ]);
  expect(rows(db)).toEqual([{ module: 'core', version: 1 }, { module: 'todo', version: 1 }]);
});

test('una migración que falla no deja cambios a medias ni se registra', () => {
  const db = openDb(':memory:');
  const d = dir({ '001_a.sql': 'CREATE TABLE t (x); INSERT INTO nope VALUES (1);' });
  expect(() => runMigrations(db, [{ module: 'm', dir: d }])).toThrow();
  expect(rows(db)).toEqual([]);
  expect(db.prepare("SELECT name FROM sqlite_master WHERE name = 't'").all()).toEqual([]);
});
