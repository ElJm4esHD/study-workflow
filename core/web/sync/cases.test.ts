import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { seriesDates } from '../../../modules/calendar/app/recurrence.ts';
import type { CalendarEvent } from '../../../modules/calendar/app/service.ts';
import { Clock } from '../../shared/sync.ts';
import { LocalDb, type Row } from './db.ts';
import { sync, type SyncTarget } from './engine.ts';
import { memoryStore } from './stores.ts';

// Los mismos casos los corre el motor de Kotlin (android/.../SyncCasesTest): así los dos no se desvían.
const cases = JSON.parse(readFileSync(new URL('../../shared/sync-cases.json', import.meta.url), 'utf8'));
const byKey = (a: { t: string; id: string }, b: { t: string; id: string }) => (a.t + a.id).localeCompare(b.t + b.id);

for (const c of cases.hlc) test(`hlc · ${c.name}`, () => {
  let now = 0;
  const clock = new Clock(c.node, () => now);
  for (const s of c.steps) {
    now = s.now;
    if (s.op === 'tick') expect(clock.tick()).toBe(s.expect);
    else clock.recv(s.hlc);
  }
});

async function dbWith(rows: Row[], meta: Record<string, string>, now: number, node = 'dev') {
  const store = memoryStore();
  rows.forEach((r) => store.rows.set(`${r.t}\0${r.id}`, { ...r }));
  Object.assign(store.meta, { deviceId: node, ...meta });
  return { store, db: await LocalDb.open(store, () => now) };
}

for (const c of cases.merge) test(`merge · ${c.name}`, async () => {
  const { store, db } = await dbWith(c.local, {}, 0);
  expect(db.merge(c.remote)).toBe(c.expectChanged);
  await db.flushed();
  expect([...store.rows.values()].sort(byKey)).toEqual(c.expect);
});

for (const c of cases.flow) test(`flow · ${c.name}`, async () => {
  const { store, db } = await dbWith(c.local, c.meta, c.now, c.node);
  const pages = [...c.pages];
  const pulls: (string | null)[] = [];
  const pushed: string[] = [];
  const target: SyncTarget = {
    push: async (recs) => { recs.forEach((r) => pushed.push(`${r.t}/${r.id}@${r.hlc}`)); },
    pull: async (cursor) => { pulls.push(cursor); return pages.shift(); },
  };
  await sync(db, target);
  await db.flushed();
  expect(pulls).toEqual(c.expectPulls);
  expect(pushed.sort()).toEqual([...c.expectPushed].sort());
  expect([...store.rows.values()].sort(byKey)).toEqual(c.expectRows);
  expect(store.meta.cursor).toBe(c.expectCursor);
});

for (const c of cases.series) test(`series · ${c.name}`, () => {
  expect(seriesDates(c.event as CalendarEvent, c.from, c.to, new Set<string>(c.exdates))).toEqual(c.expect);
});

test('refreshFromStore adopta lo que escribió otro proceso (widget): gana el HLC mayor y el reloj sigue por encima', async () => {
  const { store, db } = await dbWith([], {}, 1_700_000_000_000);
  db.put('todo_items', 'x', { id: 'x', title: 'app' });
  await db.flushed();
  // el widget tilda y otro proceso crea algo; la app todavía no se enteró
  store.rows.set('todo_items\0x', { t: 'todo_items', id: 'x', data: { id: 'x', title: 'widget' }, hlc: '9000000000000-0000-dev-w', dirty: 0 });
  store.rows.set('todo_items\0y', { t: 'todo_items', id: 'y', data: { id: 'y' }, hlc: '9000000000001-0000-dev-w', dirty: 1 });
  await db.refreshFromStore();
  expect(db.get<{ title: string }>('todo_items', 'x')?.title).toBe('widget');
  expect(db.get('todo_items', 'y')).toBeDefined();
  expect(db.pendingCount()).toBe(1); // y: lo del widget sin subir
  db.put('todo_items', 'x', { id: 'x', title: 'app 2' });
  expect(db.dirtyRows().find((r) => r.id === 'x')!.hlc > '9000000000001').toBe(true);
});
