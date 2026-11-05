import { afterEach, expect, test, vi } from 'vitest';
const h = vi.hoisted(() => ({ native: false }));
vi.mock('./server.ts', () => ({ apiBase: () => '', isNative: () => h.native }));
import { api, ApiError } from './api.ts';

afterEach(() => { vi.unstubAllGlobals(); h.native = false; });
const res = (status: number, body?: unknown) =>
  ({ ok: status < 400, status, json: async () => body }) as Response;

test('devuelve el JSON en 200', async () => {
  const f = vi.fn().mockResolvedValue(res(200, { ok: true }));
  vi.stubGlobal('fetch', f);
  expect(await api('POST', '/api/x', { a: 1 })).toEqual({ ok: true });
  expect(f).toHaveBeenCalledWith('/api/x', expect.objectContaining({ method: 'POST', body: '{"a":1}' }));
});

test('error de API → ApiError con status, code y message del body', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res(409, { error: { code: 'materia_duplicada', message: 'Ya existe.' } })));
  const e = (await api('GET', '/api/x').catch((x) => x)) as ApiError;
  expect(e).toBeInstanceOf(ApiError);
  expect([e.status, e.code, e.message]).toEqual([409, 'materia_duplicada', 'Ya existe.']);
});

test('web: fetch rechazado → ApiError sin_conexion, sin copias', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('x')));
  const e = (await api('GET', '/api/x').catch((x) => x)) as ApiError;
  expect([e.status, e.code, e.message]).toEqual([0, 'sin_conexion', 'No hay conexión con el servidor.']);
});

test('204 → undefined', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res(204)));
  expect(await api('DELETE', '/api/x')).toBeUndefined();
});

// --- offline ---
import { saveCopy, pending } from './offline.ts';
import { getConnection, onReload, resync } from './api.ts';

const memStore = () => {
  h.native = true;
  const m = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) });
};
const netDown = () => vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('x')));
const t1 = { id: 'a', title: 'a', completed: false, completedAt: null, updatedAt: 'u1' };

test('GET offline con copia devuelve la copia y marca offline', async () => {
  memStore();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res(200, [t1])));
  await api('GET', '/api/todo');
  expect(getConnection().offline).toBe(false);
  netDown();
  expect(await api('GET', '/api/todo')).toEqual([t1]);
  expect(getConnection().offline).toBe(true);
  expect(getConnection().copyAt).not.toBeNull();
});

test('GET offline sin copia → ApiError sin_conexion', async () => {
  memStore();
  netDown();
  const e = (await api('GET', '/api/nada').catch((x) => x)) as ApiError;
  expect([e.status, e.code, e.message]).toEqual([0, 'sin_conexion', 'Sin conexión y sin datos guardados para esta pantalla.']);
});

test('PATCH {completed} offline → encola y no tira; POST offline → solo podés tildar tareas', async () => {
  memStore();
  saveCopy('/api/todo/a', t1, 't0');
  netDown();
  const r = await api<typeof t1>('PATCH', '/api/todo/a', { completed: true });
  expect(r.completed).toBe(true);
  expect(pending()).toHaveLength(1);
  expect(getConnection().pending).toBe(1);
  const e = (await api('POST', '/api/todo', { title: 'x' }).catch((x) => x)) as ApiError;
  expect([e.code, e.message]).toEqual(['sin_conexion', 'Sin conexión: solo podés tildar tareas.']);
});

test('resync: health OK → flush, online y evento de recarga', async () => {
  memStore();
  saveCopy('/api/todo/a', t1, 't0');
  netDown();
  await api('PATCH', '/api/todo/a', { completed: true });
  const calls: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    calls.push(`${init.method} ${url}`);
    return res(200, url === '/api/todo/a' && init.method === 'GET' ? t1 : { ok: true });
  }));
  let reloads = 0;
  const off = onReload(() => reloads++);
  await resync();
  off();
  expect(calls).toEqual(['GET /api/health', 'GET /api/todo/a', 'PATCH /api/todo/a']);
  expect(getConnection()).toMatchObject({ offline: false, pending: 0 });
  expect(reloads).toBe(1);
});

test('C1a: tilde online actualiza las copias → destildar offline conserva su base', async () => {
  memStore();
  saveCopy('/api/todo', [t1], 't0');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res(200, { ...t1, completed: true, updatedAt: 'u2' })));
  await api('PATCH', '/api/todo/a', { completed: true });
  netDown();
  await api('PATCH', '/api/todo/a', { completed: false });
  expect(pending()[0].baseUpdatedAt).toBe('u2');
});

test('I1: POST /api/todo online agrega el ítem a la copia y toma su base', async () => {
  memStore();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res(200, [t1])));
  await api('GET', '/api/todo'); // vuelve online (el estado del módulo persiste entre tests)
  const n = { ...t1, id: 'n', updatedAt: 'u5' };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res(201, n)));
  await api('POST', '/api/todo', { title: 'n' });
  netDown();
  await api('PATCH', '/api/todo/n', { completed: true });
  expect(pending()[0]).toMatchObject({ id: 'n', baseUpdatedAt: 'u5' });
});

test('I4: resync concurrente comparte la misma promesa (un solo PATCH)', async () => {
  memStore();
  saveCopy('/api/todo/a', t1, 't0');
  netDown();
  await api('PATCH', '/api/todo/a', { completed: true });
  const f = vi.fn(async (url: string, init: RequestInit) => res(200, url === '/api/todo/a' && init.method === 'GET' ? t1 : { ok: true }));
  vi.stubGlobal('fetch', f);
  await Promise.all([resync(), resync()]);
  expect(f.mock.calls.filter(([, i]) => i.method === 'PATCH')).toHaveLength(1);
});

test('I5: GET con pendientes devuelve los datos con el tilde aplicado y dispara resync', async () => {
  memStore();
  saveCopy('/api/todo/a', t1, 't0');
  netDown();
  await api('PATCH', '/api/todo/a', { completed: true });
  const f = vi.fn(async (url: string, init: RequestInit) =>
    res(200, url === '/api/todo' ? [t1] : url === '/api/todo/a' && init.method === 'GET' ? t1 : { ok: true }));
  vi.stubGlobal('fetch', f);
  const list = await api<(typeof t1)[]>('GET', '/api/todo');
  expect(list[0].completed).toBe(true);
  await resync(); // espera el resync en vuelo
  expect(f.mock.calls.some(([u, i]) => u === '/api/todo/a' && i.method === 'PATCH')).toBe(true);
});

test('I6: si no se puede guardar en la cola → ApiError para que el caller revierta', async () => {
  const m = new Map<string, string>();
  h.native = true;
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => { if (k === 'sw.queue') throw new DOMException('cuota', 'QuotaExceededError'); m.set(k, v); },
  });
  netDown();
  const e = (await api('PATCH', '/api/todo/a', { completed: true }).catch((x) => x)) as ApiError;
  expect([e.code, e.message]).toEqual(['sin_conexion', 'No se pudo guardar el cambio sin conexión.']);
});
