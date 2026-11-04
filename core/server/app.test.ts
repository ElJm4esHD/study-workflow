import { expect, test } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp } from './app.ts';
import { httpError } from './errors.ts';
import { orderModules, type ServerModule } from './registry.ts';
import { makeTestApp } from './testing.ts';

const base = { migrationsDir: new URL('../shared/', import.meta.url) }; // sin .sql: no migra nada
const mod = (id: string, extra: Partial<ServerModule> = {}): ServerModule => ({
  id, ...base, routes: async () => {}, ...extra,
});

test('GET /api/health → 200 { ok: true }', async () => {
  const app = await makeTestApp();
  const r = await app.inject('/api/health');
  expect(r.statusCode).toBe(200);
  expect(r.json().ok).toBe(true);
});

test('monta las rutas de un módulo bajo /api/<id>', async () => {
  const app = await makeTestApp([mod('demo', { routes: async (a) => { a.get('/ping', async () => ({ pong: 1 })); } })]);
  expect((await app.inject('/api/demo/ping')).statusCode).toBe(200);
});

test('orderModules ordena por requires y falla si falta una dependencia', () => {
  const ids = orderModules([mod('b', { requires: ['a'] }), mod('a')]).map((m) => m.id);
  expect(ids).toEqual(['a', 'b']);
  expect(() => orderModules([mod('b', { requires: ['a'] })])).toThrow('Módulo b requiere a');
});

test('HttpError → { error: { code, message } } con su status', async () => {
  const app = await makeTestApp([mod('demo', { routes: async (a) => { a.get('/x', async () => { throw httpError(409, 'choque', 'Choca.'); }); } })]);
  const r = await app.inject('/api/demo/x');
  expect(r.statusCode).toBe(409);
  expect(r.json()).toEqual({ error: { code: 'choque', message: 'Choca.' } });
});

test('error de validación de Fastify → 400 code "validacion"', async () => {
  const app = await makeTestApp([mod('demo', { routes: async (a) => {
    a.post('/v', { schema: { body: { type: 'object', required: ['n'], properties: { n: { type: 'number' } } } } }, async () => ({}));
  } })]);
  const r = await app.inject({ method: 'POST', url: '/api/demo/v', payload: {} });
  expect(r.statusCode).toBe(400);
  expect(r.json().error.code).toBe('validacion');
  expect(r.json().error.message).toBe('Datos inválidos: n.');
});

test('otro 4xx de Fastify → solicitud_invalida en español', async () => {
  const app = await makeTestApp();
  const r = await app.inject({ method: 'POST', url: '/api/settings', payload: '{', headers: { 'content-type': 'application/json' } });
  expect(r.statusCode).toBe(400);
  expect(r.json().error).toEqual({ code: 'solicitud_invalida', message: 'Solicitud inválida.' });
});

test('error inesperado → 500 error_interno', async () => {
  const app = await makeTestApp([mod('demo', { routes: async (a) => { a.get('/boom', async () => { throw new Error('secreto'); }); } })]);
  const r = await app.inject('/api/demo/boom');
  expect(r.statusCode).toBe(500);
  expect(r.json()).toEqual({ error: { code: 'error_interno', message: 'Error interno del servidor.' } });
});

test('ruta /api inexistente → 404 JSON code "no_encontrado"', async () => {
  const app = await makeTestApp();
  const r = await app.inject('/api/nada');
  expect(r.statusCode).toBe(404);
  expect(r.json().error.code).toBe('no_encontrado');
});

test('services: un módulo obtiene el service de otro por ctx.services.get', async () => {
  const app = await makeTestApp([
    mod('a', { service: () => ({ hi: () => 'hola' }) }),
    mod('b', { requires: ['a'], routes: async (x, ctx) => {
      x.get('/s', async () => ({ v: ctx.services.get<{ hi(): string }>('a')!.hi() }));
    } }),
  ]);
  expect((await app.inject('/api/b/s')).json()).toEqual({ v: 'hola' });
});

test('ctx.transaction hace rollback si falla', async () => {
  const app = await makeTestApp();
  const { db, transaction } = app.ctx;
  db.exec('CREATE TABLE z (x)');
  expect(() => transaction(() => { db.exec('INSERT INTO z VALUES (1)'); throw new Error('x'); })).toThrow();
  expect(db.prepare('SELECT * FROM z').all()).toEqual([]);
});

async function webApp() {
  const dir = mkdtempSync(join(tmpdir(), 'web-'));
  writeFileSync(join(dir, 'index.html'), '<!doctype html><title>SPA</title>');
  return buildApp({ dbPath: ':memory:', modules: [], webDist: dir });
}

test('con webDist: GET / sirve index.html', async () => {
  const r = await (await webApp()).inject('/');
  expect(r.statusCode).toBe(200);
  expect(r.body).toContain('<title>SPA</title>');
});

test('con webDist: GET /todo/123 (ruta SPA) sirve index.html', async () => {
  const r = await (await webApp()).inject('/todo/123');
  expect(r.statusCode).toBe(200);
  expect(r.body).toContain('<title>SPA</title>');
});

test('con webDist: GET /apple y /apis no son API y sirven index.html', async () => {
  const app = await webApp();
  for (const url of ['/apple', '/apis']) {
    const r = await app.inject(url);
    expect(r.statusCode).toBe(200);
    expect(r.body).toContain('<title>SPA</title>');
  }
});

test('con webDist: GET /api/inexistente, /api y /api?x siguen siendo 404 JSON', async () => {
  const app = await webApp();
  for (const url of ['/api/inexistente', '/api', '/api?x=1']) {
    const r = await app.inject(url);
    expect(r.statusCode).toBe(404);
    expect(r.json().error.code).toBe('no_encontrado');
  }
});
