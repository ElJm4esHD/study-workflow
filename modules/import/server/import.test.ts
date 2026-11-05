import { expect, test } from 'vitest';
import { makeTestApp } from '../../../core/server/testing.ts';
import { calendar } from '../../calendar/server/index.ts';
import type { CalendarService } from '../../calendar/server/service.ts';
import { todo } from '../../todo/server/index.ts';
import type { TodoService } from '../../todo/server/service.ts';
import { importModule } from './index.ts';

const FENCE = '`'.repeat(3);
const planText = (items: object[] = [
  { tipo: 'tarea', fecha: '2026-11-10', titulo: 'Leer cap 1' },
  { tipo: 'tarea', fecha: '2026-11-11', hora: '10:00', titulo: 'Ejercicios' },
  { tipo: 'parcial', fecha: '2026-11-20', hora: '09:00', titulo: 'Parcial 1' },
  { tipo: 'evento', fecha: '2026-11-12', titulo: 'Clase' },
], materia = 'Álgebra') =>
  `Acá va:\n${FENCE}json\n` + JSON.stringify({ studyWorkflow: 'plan', version: 1, titulo: 'Plan A', materia, items }) + `\n${FENCE}`;

const make = async () => {
  const app = await makeTestApp([todo, calendar, importModule]);
  const todos = app.ctx.services.get<TodoService>('todo')!;
  const cal = app.ctx.services.get<CalendarService>('calendar')!;
  const commit = (payload: object) => app.inject({ method: 'POST', url: '/api/import/commit', payload });
  const create = { algebra: { create: { name: 'Álgebra', color: '#f4a3a3' } } };
  return { app, todos, cal, commit, create };
};
type App = Awaited<ReturnType<typeof make>>['app'];
const plans = async (app: App) => (await app.inject('/api/import/plans')).json();

test('commit crea tareas, eventos y el plan; GET plans muestra el progreso', async () => {
  const { app, todos, commit, create } = await make();
  const r = await commit({ text: planText(), include: [0, 1, 2], materias: create });
  expect(r.statusCode).toBe(201);
  expect(r.json()).toMatchObject({ title: 'Plan A', tasksTotal: 2, tasksDone: 0, eventsCount: 0, examsCount: 1 });
  todos.update(todos.list()[0].id, { completed: true });
  expect(await plans(app)).toMatchObject([{ tasksDone: 1, tasksTotal: 2, examsCount: 1 }]);
});

test('commit crea la materia nueva con su color', async () => {
  const { app, commit, create } = await make();
  await commit({ text: planText(), include: [0], materias: create });
  expect(app.ctx.materias.findByNameKey('algebra')).toMatchObject({ name: 'Álgebra', color: '#f4a3a3' });
});

test('create de una materia que ya existe reusa la existente', async () => {
  const { app, todos, commit } = await make();
  const m = app.ctx.materias.create({ name: 'algebra', color: '#f5bf93' });
  const r = await commit({ text: planText(), include: [0], materias: { algebra: { create: { name: 'Álgebra', color: '#f4a3a3' } } } });
  expect(r.statusCode).toBe(201);
  expect(app.ctx.materias.list()).toHaveLength(1);
  expect(todos.list()[0].materiaId).toBe(m.id);
});

test('materiaId inexistente → 400 materia_inexistente', async () => {
  const { commit } = await make();
  const r = await commit({ text: planText(), include: [0], materias: { algebra: { materiaId: 'nope' } } });
  expect(r.json().error.code).toBe('materia_inexistente');
});

test('reimportar el mismo texto: preview marca todo como duplicado', async () => {
  const { app, commit, create } = await make();
  const text = planText();
  await commit({ text, include: [0, 1, 2, 3], materias: create });
  const p = (await app.inject({ method: 'POST', url: '/api/import/preview', payload: { text } })).json();
  expect(p.items.map((i: { duplicate: boolean }) => i.duplicate)).toEqual([true, true, true, true]);
  const bad = await app.inject({ method: 'POST', url: '/api/import/preview', payload: { text: 'nada' } });
  expect(bad.json().error.code).toBe('plan_invalido');
});

test('include con un ítem inválido → 400 item_invalido y no crea nada', async () => {
  const { app, todos, commit, create } = await make();
  const text = planText([{ tipo: 'tarea', fecha: '2026-11-10', titulo: 'ok' }, { tipo: 'tarea', fecha: '2026-02-30', titulo: 'mal' }]);
  expect((await commit({ text, include: [0, 1], materias: create })).json().error.code).toBe('item_invalido');
  expect((await commit({ text, include: [7], materias: create })).json().error.code).toBe('item_invalido');
  expect((await commit({ text, include: [], materias: create })).json().error.code).toBe('validacion');
  expect(todos.list()).toHaveLength(0);
  expect(app.ctx.materias.list()).toHaveLength(0);
});

test('falta resolver materia → 400 materia_sin_resolver', async () => {
  const { todos, commit } = await make();
  const r = await commit({ text: planText(), include: [0], materias: {} });
  expect(r.json().error.code).toBe('materia_sin_resolver');
  expect(todos.list()).toHaveLength(0);
});

const seed = async () => {
  const k = await make();
  const text = planText([
    { tipo: 'tarea', fecha: '2026-11-10', titulo: 'a' }, { tipo: 'tarea', fecha: '2026-11-11', titulo: 'b' },
    { tipo: 'evento', fecha: '2026-11-12', titulo: 'c' }, { tipo: 'parcial', fecha: '2026-11-20', titulo: 'd' },
  ]);
  const plan = (await k.commit({ text, include: [0, 1, 2, 3], materias: k.create })).json();
  k.todos.update(k.todos.list().find((t) => t.title === 'a')!.id, { completed: true });
  return { ...k, plan };
};
const del = (app: App, id: string, qs = '') => app.inject({ method: 'DELETE', url: `/api/import/plans/${id}${qs}` });

test('borrar plan por defecto: borra pendientes y eventos comunes, mantiene completadas y exámenes', async () => {
  const { app, todos, cal, plan } = await seed();
  expect((await del(app, plan.id)).json()).toEqual({ deletedTodos: 1, deletedEvents: 1 });
  expect(todos.list().map((t) => t.title)).toEqual(['a']);
  expect(cal.findByDates(['2026-11-20'])).toHaveLength(1);
  expect(await plans(app)).toEqual([]);
});

test('borrar plan con includeCompleted=true&keepExams=false borra todo', async () => {
  const { app, todos, cal, plan } = await seed();
  expect((await del(app, plan.id, '?includeCompleted=true&keepExams=false')).json()).toEqual({ deletedTodos: 2, deletedEvents: 2 });
  expect(todos.list()).toHaveLength(0);
  expect(cal.findByDates(['2026-11-12', '2026-11-20'])).toHaveLength(0);
});

test('borrar plan con ítems ya borrados a mano no falla', async () => {
  const { app, todos, plan } = await seed();
  for (const t of todos.list()) todos.remove(t.id);
  expect((await del(app, plan.id)).statusCode).toBe(200);
  expect((await del(app, plan.id)).json().error.code).toBe('no_encontrado');
});

test('progreso excluye ítems borrados a mano', async () => {
  const { app, todos, plan } = await seed();
  todos.remove(todos.list().find((t) => t.title === 'b')!.id);
  expect(await plans(app)).toMatchObject([{ id: plan.id, tasksTotal: 1, tasksDone: 1 }]);
});
