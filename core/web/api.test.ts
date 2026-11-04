import { afterEach, expect, test, vi } from 'vitest';
import { api, ApiError } from './api.ts';

afterEach(() => vi.unstubAllGlobals());
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

test('fetch rechazado → ApiError sin_conexion', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('x')));
  const e = (await api('GET', '/api/x').catch((x) => x)) as ApiError;
  expect([e.status, e.code, e.message]).toEqual([0, 'sin_conexion', 'No hay conexión con el servidor.']);
});

test('204 → undefined', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res(204)));
  expect(await api('DELETE', '/api/x')).toBeUndefined();
});
