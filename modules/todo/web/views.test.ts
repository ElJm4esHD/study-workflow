import { expect, test } from 'vitest';
import type { TodoItem } from '../server/service.ts';
import { groupTodos, orderBetween, sortDay } from './views.ts';

const today = '2026-11-04';
let n = 0;
const t = (o: Partial<TodoItem>): TodoItem => ({
  id: `i${++n}`, title: 't', notes: null, dueDate: null, dueTime: null, materiaId: null, completed: false,
  completedAt: null, sortOrder: 0, createdAt: '', updatedAt: '', durationMin: null, category: 'tarea', ...o,
});
const ids = (items: TodoItem[]) => items.map((i) => i.id);

test('hoy: vencidas + hoy, sin completadas ni futuras', () => {
  const late = t({ dueDate: '2026-11-01' }), now = t({ dueDate: today }), fut = t({ dueDate: '2026-11-05' });
  const done = t({ dueDate: today, completed: true }), nod = t({});
  const g = groupTodos([now, late, fut, done, nod], 'hoy', today);
  expect(g.map((x) => x.label)).toEqual(['Vencidas', 'Hoy']);
  expect(ids(g[0]!.items)).toEqual([late.id]);
  expect(ids(g[1]!.items)).toEqual([now.id]);
  expect(g.every((x) => x.reorderable)).toBe(true);
});

test('hoy sin vencidas: solo Hoy', () => {
  expect(groupTodos([t({ dueDate: today })], 'hoy', today).map((x) => x.label)).toEqual(['Hoy']);
});

test('próximas: agrupa por día y etiqueta "Mañana"', () => {
  const a = t({ dueDate: '2026-11-05' }), b = t({ dueDate: '2026-11-07' }), c = t({ dueDate: '2026-11-05' });
  const g = groupTodos([b, a, c, t({ dueDate: today })], 'proximas', today);
  expect(g.map((x) => x.label)).toEqual(['Mañana', '07/11/2026']);
  expect(g[0]!.items).toHaveLength(2);
});

test('sin fecha', () => {
  const a = t({}), g = groupTodos([a, t({ dueDate: today })], 'sin-fecha', today);
  expect(g).toHaveLength(1);
  expect(g[0]!.label).toBe('Sin fecha');
  expect(ids(g[0]!.items)).toEqual([a.id]);
});

test('por materia filtra y "none" = sin materia', () => {
  const a = t({ materiaId: 'm1', dueDate: '2026-11-09' }), b = t({ materiaId: 'm1' }), c = t({ materiaId: 'm1', dueDate: '2026-11-06' });
  const d = t({}), e = t({ materiaId: 'm1', completed: true });
  const g = groupTodos([a, b, c, d, e], 'materia', today, 'm1');
  expect(ids(g[0]!.items)).toEqual([c.id, a.id, b.id]);
  expect(g[0]!.reorderable).toBe(false);
  expect(ids(groupTodos([a, d], 'materia', today, 'none')[0]!.items)).toEqual([d.id]);
});

test('completadas ordenadas por completedAt desc', () => {
  const a = t({ completed: true, completedAt: '2026-11-01T10:00:00Z' }), b = t({ completed: true, completedAt: '2026-11-03T10:00:00Z' });
  const g = groupTodos([a, b, t({})], 'completadas', today);
  expect(ids(g[0]!.items)).toEqual([b.id, a.id]);
  expect(g[0]!.reorderable).toBe(false);
});

test('sortDay: con hora primero (por hora), después sin hora por sortOrder', () => {
  const a = t({ sortOrder: 2 }), b = t({ sortOrder: 1 }), c = t({ dueTime: '15:00' }), d = t({ dueTime: '09:00' });
  expect(ids(sortDay([a, c, b, d]))).toEqual([d.id, c.id, b.id, a.id]);
});

test('orderBetween', () => {
  expect(orderBetween(1, 2)).toBe(1.5); expect(orderBetween(undefined, 1)).toBe(0);
  expect(orderBetween(3, undefined)).toBe(4); expect(orderBetween(undefined, undefined)).toBe(1);
});
