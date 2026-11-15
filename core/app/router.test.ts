import { expect, test, vi } from 'vitest';
import { HttpError } from '../shared/errors.ts';
import { created, LocalRouter, noContent } from './router.ts';

test('params, query, prefijo y status; lo que sale es una copia', () => {
  const state = { n: 1 };
  const r = new LocalRouter().prefixed('/api/x');
  r.get('/:id', (req) => ({ id: req.params.id, q: req.query.q, state }));
  r.post('/', { t: 'string!' }, () => created({ ok: 1 }));
  r.delete('/:id', () => noContent());
  const got = r.handle('GET', '/api/x/a%20b?q=1');
  expect(got).toEqual({ status: 200, body: { id: 'a b', q: '1', state: { n: 1 } } });
  (got.body as { state: { n: number } }).state.n = 99;
  expect(state.n).toBe(1);
  expect(r.handle('POST', '/api/x', { t: 's' })).toEqual({ status: 201, body: { ok: 1 } });
  expect(r.handle('DELETE', '/api/x/a')).toEqual({ status: 204, body: undefined });
});

test('cuerpo inválido → 400 validacion; ruta inexistente → 404; HttpError → su status; otro error → 500 sin detalles', () => {
  const r = new LocalRouter();
  r.post('/a', { t: 'string!', n: 'number' }, () => 1);
  r.get('/http', () => { throw new HttpError(409, 'choque', 'Choca.'); });
  r.get('/boom', () => { throw new Error('secreto'); });
  expect(r.handle('POST', '/a', {}).status).toBe(400);
  expect(r.handle('POST', '/a', { t: 's', n: 'x' }).body).toEqual({ error: { code: 'validacion', message: 'Datos inválidos: n.' } });
  expect(r.handle('GET', '/nada').status).toBe(404);
  expect(r.handle('GET', '/http')).toEqual({ status: 409, body: { error: { code: 'choque', message: 'Choca.' } } });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  expect(r.handle('GET', '/boom')).toEqual({ status: 500, body: { error: { code: 'error_interno', message: 'Error interno de la app.' } } });
});
