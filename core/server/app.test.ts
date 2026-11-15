import { expect, test } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp } from './app.ts';
import { makeTestApp } from './testing.ts';

test('GET /api/health → 200 { ok: true }', async () => {
  const app = await makeTestApp();
  const r = await app.inject('/api/health');
  expect(r.statusCode).toBe(200);
  expect(r.json().ok).toBe(true);
});

test('cuerpo JSON inválido → 400 solicitud_invalida en español', async () => {
  const app = await makeTestApp();
  const r = await app.inject({ method: 'POST', url: '/api/sync/push', payload: '{', headers: { 'content-type': 'application/json' } });
  expect(r.statusCode).toBe(400);
  expect(r.json().error).toEqual({ code: 'solicitud_invalida', message: 'Solicitud inválida.' });
});

test('el server ya no tiene rutas de módulos: /api/todo → 404 JSON', async () => {
  const app = await makeTestApp();
  const r = await app.inject('/api/todo');
  expect(r.statusCode).toBe(404);
  expect(r.json().error.code).toBe('no_encontrado');
});

async function webApp() {
  const dir = mkdtempSync(join(tmpdir(), 'web-'));
  writeFileSync(join(dir, 'index.html'), '<!doctype html><title>SPA</title>');
  return buildApp({ dbPath: ':memory:', webDist: dir });
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
