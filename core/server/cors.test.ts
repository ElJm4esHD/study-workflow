import { afterEach, expect, test } from 'vitest';
import { makeTestApp } from './testing.ts';

const apps: Awaited<ReturnType<typeof makeTestApp>>[] = [];
afterEach(async () => { while (apps.length) await apps.pop()!.close(); });
const mk = async () => { const a = await makeTestApp(); apps.push(a); return a; };

test('GET con Origin https://localhost permite el origen y varía por Origin', async () => {
  const app = await mk();
  const r = await app.inject({ url: '/api/health', headers: { origin: 'https://localhost' } });
  expect(r.statusCode).toBe(200);
  expect(r.headers['access-control-allow-origin']).toBe('https://localhost');
  expect(r.headers.vary).toContain('Origin');
});

test('preflight OPTIONS /api/todo/x desde https://localhost responde 204', async () => {
  const app = await mk();
  const r = await app.inject({ method: 'OPTIONS', url: '/api/todo/x', headers: {
    origin: 'https://localhost', 'access-control-request-method': 'PATCH', 'access-control-request-headers': 'content-type' } });
  expect(r.statusCode).toBe(204);
  expect(r.headers['access-control-allow-origin']).toBe('https://localhost');
  expect(r.headers['access-control-allow-methods']).toBe('GET,POST,PATCH,PUT,DELETE');
  expect(r.headers['access-control-allow-headers']).toBe('content-type');
});

test('Origin ajeno no recibe cabeceras CORS', async () => {
  const app = await mk();
  const r = await app.inject({ url: '/api/health', headers: { origin: 'https://evil.example' } });
  expect(r.headers['access-control-allow-origin']).toBeUndefined();
});

test('sin Origin queda igual que antes', async () => {
  const app = await mk();
  const r = await app.inject({ url: '/api/health' });
  expect(r.statusCode).toBe(200);
  expect(r.headers['access-control-allow-origin']).toBeUndefined();
  expect(r.headers.vary).toBeUndefined();
});

test('los errores conservan el formato y llevan CORS', async () => {
  const app = await mk();
  const r = await app.inject({ url: '/api/nada', headers: { origin: 'https://localhost' } });
  expect(r.statusCode).toBe(404);
  expect(r.json().error.code).toBe('no_encontrado');
  expect(r.headers['access-control-allow-origin']).toBe('https://localhost');
});
