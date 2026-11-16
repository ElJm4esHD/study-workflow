import { expect, test } from 'vitest';
import { AuthError, driveRest, driveTarget, NotFound, type DriveFiles } from './drive.ts';
import { LocalDb } from './db.ts';
import { sync } from './engine.ts';
import { memoryStore } from './stores.ts';

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 10, 15, 12);

/** Un Drive en memoria. `freezeNextList` hace que el próximo listado devuelva lo que había (como un Drive atrasado). */
function fakeDrive() {
  const files = new Map<string, { name: string; body: string }>();
  let n = 0;
  let frozen: { id: string; name: string }[] | null = null;
  const api: DriveFiles = {
    async list() {
      if (frozen) { const f = frozen; frozen = null; return f; }
      return [...files].map(([id, f]) => ({ id, name: f.name }));
    },
    async read(id) { const f = files.get(id); if (!f) throw new NotFound(); return f.body; },
    async create(name, body) { files.set(`id${++n}`, { name, body }); },
    async remove(id) { files.delete(id); },
  };
  const names = () => [...files.values()].map((f) => f.name).sort();
  return { api, files, names, freezeNextList: () => { frozen = [...files].map(([id, f]) => ({ id, name: f.name })); } };
}
type Fake = ReturnType<typeof fakeDrive>;

async function device(drive: Fake, opts: { compactAt?: number; page?: number } = {}, start = T0) {
  const clock = { t: start };
  const store = memoryStore();
  const db = await LocalDb.open(store, () => clock.t);
  const target = driveTarget(drive.api, { now: () => clock.t, ...opts });
  return { db, clock, store, sync: () => sync(db, target) };
}
const titles = (d: { db: LocalDb }) => d.db.all<{ title: string }>('todo').map((x) => x.title).sort();

test('dos dispositivos: lo que crea uno aparece en el otro, y no se vuelve a subir', async () => {
  const drive = fakeDrive();
  const a = await device(drive);
  const b = await device(drive);
  a.db.put('todo', 'x', { title: 'Estudiar' });
  await a.sync();
  expect(drive.names().filter((n) => n.startsWith('epoch-'))).toHaveLength(1);
  await b.sync();
  expect(titles(b)).toEqual(['Estudiar']);
  expect(b.db.pendingCount()).toBe(0);
  const antes = drive.names().length;
  await a.sync(); await b.sync();
  expect(drive.names()).toHaveLength(antes);
});

test('ediciones concurrentes de cosas distintas y borrados: quedan todas, gana el HLC mayor', async () => {
  const drive = fakeDrive();
  const a = await device(drive);
  const b = await device(drive);
  a.db.put('todo', 'x', { title: 'X' }); a.db.put('todo', 'y', { title: 'Y' });
  await a.sync(); await b.sync();
  a.clock.t += 1000; b.clock.t += 2000;
  a.db.put('todo', 'x', { title: 'X de A' });
  b.db.put('todo', 'x', { title: 'X de B' }); // más nuevo
  b.db.remove('todo', 'y');
  b.db.put('todo', 'z', { title: 'Z' });
  await a.sync(); await b.sync(); await a.sync();
  expect(titles(a)).toEqual(['X de B', 'Z']);
  expect(titles(b)).toEqual(['X de B', 'Z']);
});

test('un archivo con nombre "anterior" que aparece después igual se lee (el cursor son archivos, no un reloj)', async () => {
  const drive = fakeDrive();
  const futuro = await device(drive, {}, T0 + 400 * DAY);
  const pasado = await device(drive, {}, T0);
  const lector = await device(drive);
  futuro.db.put('todo', 'f', { title: 'Del futuro' });
  await futuro.sync();
  await lector.sync(); // ya pasó el log del futuro
  pasado.db.put('todo', 'p', { title: 'Del pasado' });
  await pasado.sync(); // nombre menor que el que el lector ya leyó
  await lector.sync();
  expect(titles(lector)).toEqual(['Del futuro', 'Del pasado']);
});

test('paginación: con pocos archivos por página se lee todo', async () => {
  const drive = fakeDrive();
  const a = await device(drive);
  for (let i = 0; i < 7; i++) { a.db.put('todo', `t${i}`, { title: `T${i}` }); a.clock.t += 5; await a.sync(); }
  const b = await device(drive, { page: 2 });
  await b.sync();
  expect(titles(b)).toHaveLength(7);
});

test('compactación: un snapshot reemplaza a los logs, y un dispositivo nuevo y uno atrasado quedan igual', async () => {
  const drive = fakeDrive();
  const a = await device(drive, { compactAt: 3 });
  const atrasado = await device(drive, { compactAt: 3 });
  a.db.put('todo', 'x', { title: 'X' }); a.clock.t += 5; await a.sync();
  await atrasado.sync();
  for (let i = 0; i < 4; i++) { a.db.put('todo', `t${i}`, { title: `T${i}` }); a.clock.t += 5; await a.sync(); }
  await a.sync(); // 5 logs > 3: compacta
  expect(drive.names().filter((n) => n.startsWith('log-')).length).toBeLessThan(3); // el resto llegó después de compactar
  expect(drive.names().filter((n) => n.startsWith('snap-'))).toHaveLength(1);
  const nuevo = await device(drive, { compactAt: 3 });
  await nuevo.sync();
  await atrasado.sync(); // no leyó 4 logs, ya borrados: los toma del snapshot
  expect(titles(nuevo)).toEqual(['T0', 'T1', 'T2', 'T3', 'X']);
  expect(titles(atrasado)).toEqual(titles(nuevo));
  nuevo.db.put('todo', 'n', { title: 'N' }); await nuevo.sync(); await a.sync(); // y se sigue trabajando después
  expect(titles(a)).toContain('N');
});

test('compactación con marcas de borrado viejas: se descartan y el dispositivo atrasado baja todo y saca lo que ya no está', async () => {
  const drive = fakeDrive();
  const a = await device(drive, { compactAt: 2 });
  const b = await device(drive, { compactAt: 2 });
  a.db.put('todo', 'viejo', { title: 'Viejo' }); a.db.put('todo', 'queda', { title: 'Queda' });
  await a.sync(); await b.sync();
  a.clock.t += 1000;
  a.db.remove('todo', 'viejo'); await a.sync();
  a.clock.t += 181 * DAY; // la marca ya tiene más de 180 días
  a.db.put('todo', 'nuevo', { title: 'Nuevo' }); await a.sync();
  a.clock.t += 5; a.db.put('todo', 'otro', { title: 'Otro' }); await a.sync();
  await a.sync();
  expect(drive.names().some((n) => n.endsWith('-p.json'))).toBe(true);
  b.clock.t = a.clock.t;
  await b.sync();
  expect(titles(b)).toEqual(['Nuevo', 'Otro', 'Queda']); // "Viejo" no revive
});

test('dos compactaciones a la vez no pierden nada', async () => {
  const drive = fakeDrive();
  const a = await device(drive, { compactAt: 2 });
  const b = await device(drive, { compactAt: 2 });
  for (let i = 0; i < 3; i++) { a.db.put('todo', `a${i}`, { title: `A${i}` }); a.clock.t += 5; await a.sync(); }
  drive.freezeNextList(); // b ve el listado de antes de que a compacte
  await a.sync(); // a compacta
  await b.sync(); // b lee un listado atrasado: 404 → vuelve a listar
  expect(titles(b)).toEqual(['A0', 'A1', 'A2']);
});

test('carpeta borrada o distinta (otro epoch): se vuelve a subir todo lo local, sin perder nada', async () => {
  const drive = fakeDrive();
  const a = await device(drive);
  a.db.put('todo', 'x', { title: 'X' }); await a.sync();
  drive.files.clear(); // el usuario borró los datos de la app en Drive
  await a.sync();
  const b = await device(drive);
  await b.sync();
  expect(titles(b)).toEqual(['X']);
  expect(drive.names().filter((n) => n.startsWith('epoch-'))).toHaveLength(1);
});

test('lo que no tiene forma de registro, o un cursor que no es de Drive, no rompe', async () => {
  const drive = fakeDrive();
  drive.api.create('log-0000000000001-0000-zz-ab.json', JSON.stringify({ records: [{ t: 'Mal', id: '', hlc: 'x', data: 1 }, { t: 'todo', id: 'ok', hlc: '0000000000002-0000-zz', data: { title: 'ok' } }] }));
  const a = await device(drive);
  a.store.meta.cursor = '12:3:0'; // cursor de "Mi servidor" de un destino anterior
  await a.sync();
  expect(titles(a)).toEqual(['ok']);
});

test('REST: listado paginado, subida multipart con parents, 404 y 401', async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const answers = [
    { status: 200, body: { files: [{ id: '1', name: 'a' }], nextPageToken: 'tok' } },
    { status: 200, body: { files: [{ id: '2', name: 'b' }] } },
    { status: 200, body: {} },
    { status: 404, body: {} },
    { status: 401, body: {} },
  ];
  const fake = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const a = answers.shift()!;
    return new Response(JSON.stringify(a.body), { status: a.status });
  }) as unknown as typeof fetch;
  const rest = driveRest(async () => 'T', fake);
  expect(await rest.list()).toEqual([{ id: '1', name: 'a' }, { id: '2', name: 'b' }]);
  expect(calls[1]!.url).toContain('pageToken=tok');
  expect(calls[0]!.url).toContain('spaces=appDataFolder');
  await rest.create('log-x.json', '{"records":[]}');
  expect(String(calls[2]!.init!.body)).toContain('"parents":["appDataFolder"]');
  expect((calls[2]!.init!.headers as Record<string, string>).Authorization).toBe('Bearer T');
  await expect(rest.read('zz')).rejects.toBeInstanceOf(NotFound);
  await expect(rest.read('zz')).rejects.toBeInstanceOf(AuthError);
});
