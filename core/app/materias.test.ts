import { expect, test } from 'vitest';
import { PALETTE } from '../shared/palette.ts';
import { makeTestApp } from './testing.ts';

const c = PALETTE[0]!.hex;
const post = (app: Awaited<ReturnType<typeof makeTestApp>>, payload: object) =>
  app.inject({ method: 'POST', url: '/api/materias', payload });

test('crear, listar y editar materia', async () => {
  const app = await makeTestApp();
  const r = await post(app, { name: 'Análisis', color: c });
  expect(r.statusCode).toBe(201);
  const m = r.json();
  expect(m).toMatchObject({ name: 'Análisis', color: c, archived: false });
  const p = await app.inject({ method: 'PATCH', url: `/api/materias/${m.id}`, payload: { name: 'Análisis II', color: PALETTE[1]!.hex } });
  expect(p.json()).toMatchObject({ name: 'Análisis II', color: PALETTE[1]!.hex });
  expect((await app.inject('/api/materias')).json()).toHaveLength(1);
  expect((await app.inject({ method: 'PATCH', url: '/api/materias/nope', payload: {} })).json().error.code).toBe('no_encontrado');
});

test('nombre vacío o muy largo → 400 validacion', async () => {
  const app = await makeTestApp();
  for (const name of ['  ', 'x'.repeat(61)]) {
    const r = await post(app, { name, color: c });
    expect([r.statusCode, r.json().error.code]).toEqual([400, 'validacion']);
  }
});

test('nombre duplicado ignorando tildes y mayúsculas → 409 materia_duplicada', async () => {
  const app = await makeTestApp();
  await post(app, { name: 'Álgebra', color: c });
  const r = await post(app, { name: 'algebra', color: c });
  expect(r.statusCode).toBe(409);
  expect(r.json().error.code).toBe('materia_duplicada');
});

test('color fuera de la paleta → 400 color_invalido', async () => {
  const app = await makeTestApp();
  const r = await post(app, { name: 'X', color: '#123456' });
  expect([r.statusCode, r.json().error.code]).toEqual([400, 'color_invalido']);
});

test('archivar: GET sigue devolviéndola con archived: true', async () => {
  const app = await makeTestApp();
  const m = (await post(app, { name: 'X', color: c })).json();
  await app.inject({ method: 'PATCH', url: `/api/materias/${m.id}`, payload: { archived: true } });
  expect((await app.inject('/api/materias')).json()[0].archived).toBe(true);
});

test('no existe DELETE /api/materias/:id → 404', async () => {
  const app = await makeTestApp();
  expect((await app.inject({ method: 'DELETE', url: '/api/materias/x' })).statusCode).toBe(404);
});

test('POST con el mismo id dos veces devuelve la misma materia', async () => {
  const app = await makeTestApp();
  const a = (await post(app, { id: 'm1', name: 'X', color: c })).json();
  const b = await post(app, { id: 'm1', name: 'X', color: c });
  expect(b.json()).toEqual(a);
  expect((await app.inject('/api/materias')).json()).toHaveLength(1);
});

test('create sin sigla la genera; con sigla la normaliza a mayúsculas', async () => {
  const app = await makeTestApp();
  expect((await post(app, { name: 'Análisis Matemático II', color: c })).json().sigla).toBe('AM2');
  expect((await post(app, { name: 'Física', color: c, sigla: ' fis1 ' })).json().sigla).toBe('FIS1');
});

test('PATCH sigla inválida → 400 sigla_invalida', async () => {
  const app = await makeTestApp();
  const m = (await post(app, { name: 'X', color: c })).json();
  for (const sigla of ['', 'ABCDEF', 'A-B']) {
    const r = await app.inject({ method: 'PATCH', url: `/api/materias/${m.id}`, payload: { sigla } });
    expect([r.statusCode, r.json().error.code]).toEqual([400, 'sigla_invalida']);
  }
  const ok = await app.inject({ method: 'PATCH', url: `/api/materias/${m.id}`, payload: { sigla: 'ab1' } });
  expect(ok.json().sigla).toBe('AB1');
});

test('materias incluyen colorStrong del par de la paleta', async () => {
  const app = await makeTestApp();
  await post(app, { name: 'Física', color: PALETTE[0]!.hex });
  const [m] = (await app.inject('/api/materias')).json();
  expect(m.colorStrong).toBe(PALETTE[0]!.strong);
});
