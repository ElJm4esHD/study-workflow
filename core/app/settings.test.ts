import { expect, test } from 'vitest';
import { PALETTE } from '../shared/palette.ts';
import { makeTestApp } from './testing.ts';

test('settings: PATCH mergea claves y GET las devuelve', async () => {
  const app = await makeTestApp();
  await app.inject({ method: 'PATCH', url: '/api/settings', payload: { a: 1, b: { x: true } } });
  await app.inject({ method: 'PATCH', url: '/api/settings', payload: { a: 2 } });
  expect((await app.inject('/api/settings')).json()).toEqual({ a: 2, b: { x: true } });
});

test('modules.isEnabled: true por defecto, false si settings lo dice', async () => {
  const app = await makeTestApp();
  expect(app.ctx.modules.isEnabled('todo')).toBe(true);
  app.ctx.settings.set('modules.enabled', { todo: false });
  expect(app.ctx.modules.isEnabled('todo')).toBe(false);
  expect(app.ctx.modules.isEnabled('calendar')).toBe(true);
});

test('backup v2: exporta y restaura reemplazando; rechaza lo que no es un backup', async () => {
  const app = await makeTestApp();
  await app.inject({ method: 'POST', url: '/api/materias', payload: { name: 'Álgebra', color: PALETTE[0]!.hex } });
  await app.inject({ method: 'PATCH', url: '/api/settings', payload: { a: 1 } });
  const b = (await app.inject('/api/backup')).json();
  expect(b).toMatchObject({ format: 'study-workflow-backup', version: 2 });
  await app.inject({ method: 'POST', url: '/api/materias', payload: { name: 'Extra', color: PALETTE[1]!.hex } });
  expect((await app.inject({ method: 'POST', url: '/api/backup', payload: b })).statusCode).toBe(200);
  expect((await app.inject('/api/materias')).json().map((m: { name: string }) => m.name)).toEqual(['Álgebra']);
  for (const mal of [{}, { ...b, format: 'otra' }, { ...b, version: 1 }, { ...b, records: [{ t: 'inventada', id: 'x', data: {} }] }]) {
    expect((await app.inject({ method: 'POST', url: '/api/backup', payload: mal })).statusCode).toBe(400);
  }
  expect((await app.inject('/api/materias')).json()).toHaveLength(1);
});

test('el cuerpo mal tipado da 400 validacion en vez de romper', async () => {
  const app = await makeTestApp();
  const r = await app.inject({ method: 'POST', url: '/api/materias', payload: { name: 5, color: 'x' } });
  expect([r.statusCode, r.json().error.code]).toEqual([400, 'validacion']);
});
