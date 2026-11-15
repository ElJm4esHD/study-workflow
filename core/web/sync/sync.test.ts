import { expect, test } from 'vitest';
import { makeTestApp } from '../../server/testing.ts';
import { purgeTombstones } from '../../server/sync.ts';
import { Clock, fmtHlc, parseHlc, tombstoneExpired } from '../../shared/sync.ts';
import { LocalDb } from './db.ts';
import { makeSyncer, sync, type SyncTarget } from './engine.ts';
import { memoryStore } from './stores.ts';
import { serverTarget, type Call } from './target.ts';

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 10, 15, 12);

type App = Awaited<ReturnType<typeof makeTestApp>>;
const callOf = (app: App): Call => async (method, url, body) => {
  const r = await app.inject({ method, url, payload: body as object | undefined });
  if (r.statusCode >= 400) throw new Error(`${r.statusCode} ${r.body}`);
  return r.json();
};
/** Un dispositivo: su base local, con su propio reloj (modificable), contra el server. */
async function device(app: App, pageSize = 1000, start = T0) {
  const clock = { t: start };
  const store = memoryStore();
  const db = await LocalDb.open(store, () => clock.t);
  const target = serverTarget(callOf(app), pageSize);
  return { db, clock, store, target, sync: () => sync(db, target) };
}
const titles = (d: { db: LocalDb }) => d.db.all<{ title: string }>('todo').map((x) => x.title).sort();

test('HLC: formato ordenable, nunca retrocede y lo posterior a ver un cambio ajeno lo supera', () => {
  const now = { t: 1000 };
  const c = new Clock('aaa', () => now.t);
  const a = c.tick();
  now.t = 500; // el reloj del dispositivo va para atrás
  const b = c.tick();
  expect(b > a).toBe(true);
  expect(parseHlc(a)).toEqual({ ms: 1000, c: 0, node: 'aaa' });
  const futuro = fmtHlc(9_000_000, 7, 'zzz');
  c.recv(futuro);
  expect(c.tick() > futuro).toBe(true);
  expect(fmtHlc(2, 0, 'n') < fmtHlc(10, 0, 'n')).toBe(true); // ceros a la izquierda
  expect(tombstoneExpired(fmtHlc(T0, 0, 'n'), T0 + 181 * DAY)).toBe(true);
  expect(tombstoneExpired(fmtHlc(T0, 0, 'n'), T0 + 179 * DAY)).toBe(false);
});

test('dos dispositivos: lo que crea uno aparece en el otro', async () => {
  const app = await makeTestApp();
  const a = await device(app);
  const b = await device(app);
  a.db.put('todo', 'x', { title: 'Estudiar' });
  expect(a.db.pendingCount()).toBe(1);
  await a.sync();
  expect(a.db.pendingCount()).toBe(0);
  await b.sync();
  expect(titles(b)).toEqual(['Estudiar']);
  expect(b.db.pendingCount()).toBe(0);
});

test('offline largo: cada uno edita cosas distintas y al volver quedan los dos cambios', async () => {
  const app = await makeTestApp();
  const a = await device(app);
  const b = await device(app);
  a.db.put('todo', '1', { title: 'uno' });
  a.db.put('todo', '2', { title: 'dos' });
  await a.sync();
  await b.sync();
  a.clock.t += 5 * DAY; b.clock.t += 5 * DAY;
  a.db.put('todo', '1', { title: 'uno (celu)' });
  a.db.put('todo', '3', { title: 'tres' });
  b.db.put('todo', '2', { title: 'dos (compu)' });
  b.db.remove('todo', '3'); // todavía no lo vio: borrar algo que no existe no hace nada
  await a.sync();
  await b.sync();
  await a.sync();
  expect(titles(a)).toEqual(titles(b));
  expect(titles(a)).toEqual(['dos (compu)', 'tres', 'uno (celu)']);
});

test('edición simultánea del mismo registro: gana el cambio más nuevo y los dos convergen', async () => {
  const app = await makeTestApp();
  const a = await device(app);
  const b = await device(app);
  a.db.put('todo', 'x', { title: 'base' });
  await a.sync(); await b.sync();
  a.clock.t += 1000;
  a.db.put('todo', 'x', { title: 'A' });
  b.clock.t += 2000;
  b.db.put('todo', 'x', { title: 'B' }); // B editó después
  await b.sync(); await a.sync(); await b.sync();
  expect(titles(a)).toEqual(['B']);
  expect(titles(b)).toEqual(['B']);
  expect(a.db.pendingCount() + b.db.pendingCount()).toBe(0);
});

test('mismo milisegundo en dos dispositivos: desempata el nodo y convergen igual', async () => {
  const app = await makeTestApp();
  const a = await device(app);
  const b = await device(app);
  a.db.put('todo', 'x', { title: 'A' });
  b.db.put('todo', 'x', { title: 'B' });
  await a.sync(); await b.sync(); await a.sync();
  expect(titles(a)).toEqual(titles(b));
});

test('reloj de un dispositivo muy adelantado: gana lo concurrente, pero lo editado después de verlo le gana', async () => {
  const app = await makeTestApp();
  const a = await device(app, 1000, T0 + 30 * DAY); // hora mal puesta
  const b = await device(app);
  a.db.put('todo', 'x', { title: 'desde el futuro' });
  b.db.put('todo', 'x', { title: 'normal' });
  await a.sync(); await b.sync();
  expect(titles(b)).toEqual(['desde el futuro']);
  b.clock.t += 1000;
  b.db.put('todo', 'x', { title: 'lo corregí' }); // B ya vio el cambio de A
  await b.sync(); await a.sync();
  expect(titles(a)).toEqual(['lo corregí']);
});

test('reloj que retrocede: la edición siguiente igual le gana a la anterior', async () => {
  const app = await makeTestApp();
  const a = await device(app);
  const b = await device(app);
  a.db.put('todo', 'x', { title: 'v1' });
  a.clock.t -= 3 * DAY;
  a.db.put('todo', 'x', { title: 'v2' });
  await a.sync(); await b.sync();
  expect(titles(b)).toEqual(['v2']);
});

test('borrados: un dispositivo atrasado no revive lo borrado y borrar vs editar se decide por el más nuevo', async () => {
  const app = await makeTestApp();
  const a = await device(app);
  const b = await device(app);
  a.db.put('todo', 'x', { title: 'x' });
  a.db.put('todo', 'y', { title: 'y' });
  await a.sync(); await b.sync();
  a.clock.t += 1000;
  a.db.remove('todo', 'x');
  await a.sync();
  b.clock.t += 500; // B edita y ANTES de que A borre (en tiempo)
  b.db.put('todo', 'y', { title: 'y editado' });
  await b.sync(); // sube y; baja la marca de x
  expect(titles(b)).toEqual(['y editado']);
  expect(b.db.get('todo', 'x')).toBeUndefined();
  await a.sync();
  expect(titles(a)).toEqual(['y editado']);
  // B vuelve a subir su copia vieja de x: no la revive (su hlc es menor que la marca)
  b.db.merge([{ t: 'todo', id: 'x', data: { title: 'x' }, hlc: fmtHlc(T0 - 1, 0, 'viejo') }]);
  expect(b.db.get('todo', 'x')).toBeUndefined();
  // editar después del borrado sí lo revive (el cambio más nuevo gana)
  b.clock.t += 10_000;
  b.db.put('todo', 'x', { title: 'x otra vez' });
  await b.sync(); await a.sync();
  expect(titles(a)).toEqual(['x otra vez', 'y editado']);
});

test('paginado: baja todo aunque el server devuelva de a pocos', async () => {
  const app = await makeTestApp();
  const a = await device(app);
  for (let i = 0; i < 25; i++) a.db.put('todo', String(i), { title: `t${i}` });
  await a.sync();
  const b = await device(app, 4);
  const r = await b.sync();
  expect(r.pulled).toBe(25);
  expect(b.db.all('todo')).toHaveLength(25);
  expect((await b.sync()).pulled).toBe(0); // idempotente: el cursor quedó al final
});

test('si se vuelve a editar mientras se sube, queda pendiente para el próximo ciclo', async () => {
  const app = await makeTestApp();
  const a = await device(app);
  a.db.put('todo', 'x', { title: 'v1' });
  const lenta: SyncTarget = { ...a.target, push: async (r) => { await a.target.push(r); a.db.put('todo', 'x', { title: 'v2' }); } };
  await sync(a.db, lenta);
  expect(a.db.pendingCount()).toBe(1);
  await a.sync();
  expect(a.db.pendingCount()).toBe(0);
  const b = await device(app);
  await b.sync();
  expect(titles(b)).toEqual(['v2']);
});

test('si falla la red a mitad, nada se pierde y el próximo ciclo termina', async () => {
  const app = await makeTestApp();
  const a = await device(app);
  a.db.put('todo', 'x', { title: 'x' });
  const caida: SyncTarget = { push: async () => { throw new Error('sin red'); }, pull: a.target.pull };
  await expect(sync(a.db, caida)).rejects.toThrow('sin red');
  expect(a.db.pendingCount()).toBe(1);
  await a.sync();
  expect(a.db.pendingCount()).toBe(0);
});

test('limpieza a 180 días: un dispositivo atrasado hace reset, pierde lo borrado y conserva lo suyo sin subir', async () => {
  const app = await makeTestApp();
  const a = await device(app);
  const b = await device(app);
  a.db.put('todo', 'x', { title: 'x' });
  a.db.put('todo', 'z', { title: 'z' });
  await a.sync(); await b.sync();
  a.clock.t += 1000;
  a.db.remove('todo', 'x');
  await a.sync();
  b.db.put('todo', 'mio', { title: 'mío sin subir' });
  // pasan 181 días: el server limpia la marca
  expect(purgeTombstones(app.db, T0 + 181 * DAY)).toBe(1);
  await b.sync();
  expect(titles(b)).toEqual(['mío sin subir', 'z']); // x se fue (no vino ni está en el server)
  await a.sync();
  expect(titles(a)).toEqual(['mío sin subir', 'z']);
});

test('limpieza: quien arrancó de cero después de la limpieza no hace reset infinito', async () => {
  const app = await makeTestApp();
  const a = await device(app);
  for (let i = 0; i < 10; i++) a.db.put('todo', String(i), { title: `t${i}` });
  for (let i = 0; i < 5; i++) a.db.remove('todo', String(i));
  await a.sync();
  purgeTombstones(app.db, T0 + 181 * DAY);
  const c = await device(app, 2);
  await c.sync();
  expect(c.db.all('todo')).toHaveLength(5);
  expect((await c.sync()).pulled).toBe(0);
});

test('server nuevo o restaurado (otro epoch): el dispositivo vuelve a subir todo lo suyo, no pierde nada', async () => {
  const viejo = await makeTestApp();
  const a = await device(viejo);
  a.db.put('todo', 'x', { title: 'x' });
  await a.sync();
  const nuevo = await makeTestApp();
  const t2 = serverTarget(callOf(nuevo));
  a.db.put('todo', 'y', { title: 'y' });
  await sync(a.db, t2); // sube y, pide con el cursor del server viejo → reset
  expect(titles(a)).toEqual(['x', 'y']); // x estaba sincronizado con el server viejo: se vuelve a subir al nuevo
  const b = await device(nuevo);
  await b.sync();
  expect(titles(b)).toEqual(['x', 'y']);
  expect(a.db.pendingCount()).toBe(0);
});

test('el estado local sobrevive a reabrir la base y el reloj sigue por encima de lo guardado', async () => {
  const app = await makeTestApp();
  const a = await device(app, 1000, T0 + 10 * DAY);
  a.db.put('todo', 'x', { title: 'x' });
  await a.sync();
  await a.db.flushed();
  const again = await LocalDb.open(a.store, () => T0); // reloj atrasado al reabrir
  expect(again.deviceId).toBe(a.db.deviceId);
  expect(again.get<{ title: string }>('todo', 'x')?.title).toBe('x');
  again.put('todo', 'x', { title: 'x2' });
  const hlcs = [...a.store.rows.values()].map((r) => r.hlc);
  expect(again.dirtyRows()[0]!.hlc > hlcs[0]!).toBe(true);
});

test('transaction: guarda todo junto o nada', async () => {
  const app = await makeTestApp();
  const a = await device(app);
  a.db.put('todo', 'x', { title: 'x' });
  expect(() => a.db.transaction(() => { a.db.put('todo', 'x', { title: 'cambiado' }); a.db.put('todo', 'n', { title: 'nuevo' }); throw new Error('falló'); })).toThrow('falló');
  expect(titles(a)).toEqual(['x']);
  a.db.transaction(() => { a.db.put('todo', 'a', { title: 'a' }); a.db.put('todo', 'b', { title: 'b' }); });
  await a.db.flushed();
  expect(a.store.rows.size).toBe(3);
});

test('makeSyncer no superpone ciclos', async () => {
  const app = await makeTestApp();
  const a = await device(app);
  let calls = 0;
  const run = makeSyncer(a.db, { push: async () => { calls++; }, pull: async () => ({ records: [], cursor: 'c', more: false }) });
  a.db.put('todo', 'x', { title: 'x' });
  await Promise.all([run(), run(), run()]);
  expect(calls).toBe(1);
});

test('el server rechaza registros mal formados y no cambia nada', async () => {
  const app = await makeTestApp();
  const call = callOf(app);
  const ok = { t: 'todo', id: 'a', data: { x: 1 }, hlc: fmtHlc(T0, 0, 'abc') };
  for (const bad of [{ ...ok, t: 'Todo!' }, { ...ok, hlc: 'zzz' }, { ...ok, data: [1] }, { ...ok, id: '' }, { ...ok, data: 'texto' }]) {
    await expect(call('POST', '/api/sync/push', { records: [ok, bad] })).rejects.toThrow('400');
  }
  expect((await call('GET', '/api/sync/pull')).records).toEqual([]);
  await call('POST', '/api/sync/push', { records: [ok] });
  expect((await call('GET', '/api/sync/pull')).records).toEqual([ok]);
});
