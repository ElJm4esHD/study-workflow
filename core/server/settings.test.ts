import { expect, test } from 'vitest';
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
