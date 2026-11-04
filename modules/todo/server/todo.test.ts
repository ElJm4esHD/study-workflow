import { expect, test } from 'vitest';
import { PALETTE } from '../../../core/shared/palette.ts';
import { makeTestApp } from '../../../core/server/testing.ts';
import { todo } from './index.ts';
import type { TodoService } from './service.ts';

const make = async () => {
  const app = await makeTestApp([todo]);
  const svc = app.ctx.services.get<TodoService>('todo')!;
  const post = (payload: object) => app.inject({ method: 'POST', url: '/api/todo', payload });
  const patch = (id: string, payload: object) => app.inject({ method: 'PATCH', url: `/api/todo/${id}`, payload });
  return { app, svc, post, patch };
};

test('CRUD completo', async () => {
  const { app, post, patch } = await make();
  const r = await post({ title: '  Estudiar  ', notes: 'n', dueDate: '2026-11-10', dueTime: '09:30' });
  expect(r.statusCode).toBe(201);
  const t = r.json();
  expect(t).toMatchObject({ title: 'Estudiar', notes: 'n', dueDate: '2026-11-10', dueTime: '09:30', completed: false, completedAt: null, materiaId: null });
  expect((await app.inject(`/api/todo/${t.id}`)).json().id).toBe(t.id);
  expect((await patch(t.id, { title: 'Otro', dueDate: null, dueTime: null })).json()).toMatchObject({ title: 'Otro', dueDate: null, dueTime: null });
  expect((await app.inject('/api/todo')).json()).toHaveLength(1);
  expect((await app.inject({ method: 'DELETE', url: `/api/todo/${t.id}` })).statusCode).toBe(204);
  expect((await app.inject(`/api/todo/${t.id}`)).statusCode).toBe(404);
  expect((await patch('nope', {})).json().error.code).toBe('no_encontrado');
});

test('título vacío o muy largo → 400 validacion', async () => {
  const { post } = await make();
  for (const title of ['  ', 'x'.repeat(201)]) expect((await post({ title })).json().error.code).toBe('validacion');
});

test('tildar pone completedAt y destildar lo limpia', async () => {
  const { post, patch } = await make();
  const t = (await post({ title: 'a' })).json();
  const done = (await patch(t.id, { completed: true })).json();
  expect(done.completed).toBe(true);
  expect(done.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  expect((await patch(t.id, { completed: false })).json()).toMatchObject({ completed: false, completedAt: null });
});

test('hora sin fecha → 400 hora_sin_fecha', async () => {
  const { post, patch } = await make();
  const r = await post({ title: 'a', dueTime: '10:00' });
  expect([r.statusCode, r.json().error.code]).toEqual([400, 'hora_sin_fecha']);
  const t = (await post({ title: 'a', dueDate: '2026-11-10', dueTime: '10:00' })).json();
  expect((await patch(t.id, { dueDate: null })).json().error.code).toBe('hora_sin_fecha');
});

test('fecha 2026-02-30 → 400', async () => {
  const { post } = await make();
  const r = await post({ title: 'a', dueDate: '2026-02-30' });
  expect(r.statusCode).toBe(400);
  expect((await post({ title: 'a', dueDate: '2026-02-28', dueTime: '25:00' })).statusCode).toBe(400);
});

test('materia inexistente → 400 materia_inexistente', async () => {
  const { app, post } = await make();
  const r = await post({ title: 'a', materiaId: 'nope' });
  expect([r.statusCode, r.json().error.code]).toEqual([400, 'materia_inexistente']);
  const m = app.ctx.materias.create({ name: 'X', color: PALETTE[0]!.hex });
  expect((await post({ title: 'a', materiaId: m.id })).json().materiaId).toBe(m.id);
});

test('sortOrder por defecto queda al final', async () => {
  const { post } = await make();
  const o = [];
  for (const t of ['a', 'b', 'c']) o.push((await post({ title: t })).json().sortOrder);
  expect(o).toEqual([1, 2, 3]);
});

test('PATCH sortOrder fraccional se guarda', async () => {
  const { post, patch } = await make();
  const t = (await post({ title: 'a' })).json();
  expect((await patch(t.id, { sortOrder: 1.5 })).json().sortOrder).toBe(1.5);
});

test('POST idempotente con el mismo id', async () => {
  const { app, post } = await make();
  const a = (await post({ id: 'x1', title: 'a' })).json();
  const b = (await post({ id: 'x1', title: 'distinto' })).json();
  expect(b).toEqual(a);
  expect((await app.inject('/api/todo')).json()).toHaveLength(1);
});

test('service.findByDates y listDated filtran por due_date', async () => {
  const { svc } = await make();
  svc.createMany([
    { title: 'a', dueDate: '2026-11-10' }, { title: 'b', dueDate: '2026-11-12' },
    { title: 'c', dueDate: '2026-11-20' }, { title: 'd' },
  ]);
  expect(svc.findByDates(['2026-11-10', '2026-11-20']).map((t) => t.title).sort()).toEqual(['a', 'c']);
  expect(svc.findByDates([])).toEqual([]);
  expect(svc.listDated('2026-11-10', '2026-11-12').map((t) => t.title)).toEqual(['a', 'b']);
});

test('createMany es todo o nada dentro de una transacción', async () => {
  const { app, svc } = await make();
  expect(() => app.ctx.transaction(() => svc.createMany([{ title: 'ok' }, { title: '' }]))).toThrow();
  expect(svc.list()).toHaveLength(0);
});

test('service.getByIds y deleteByIds respetan includeCompleted y devuelven la cantidad', async () => {
  const { svc } = await make();
  const [a, b, c] = svc.createMany([{ title: 'a' }, { title: 'b' }, { title: 'c' }]);
  svc.update(b!.id, { completed: true });
  expect(svc.getByIds([a!.id, b!.id, 'nope']).map((t) => t.title).sort()).toEqual(['a', 'b']);
  expect(svc.deleteByIds([a!.id, b!.id], { includeCompleted: false })).toBe(1);
  expect(svc.get(b!.id)).toBeDefined();
  expect(svc.deleteByIds([b!.id, c!.id], { includeCompleted: true })).toBe(2);
  expect(svc.list()).toHaveLength(0);
});

test('service.deleteByIds ignora ids inexistentes', async () => {
  const { svc } = await make();
  expect(svc.deleteByIds(['x', 'y'], { includeCompleted: true })).toBe(0);
  expect(svc.deleteByIds([], { includeCompleted: true })).toBe(0);
});
