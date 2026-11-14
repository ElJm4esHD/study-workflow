import { expect, test } from 'vitest';
import type { Materia } from '../../../core/server/registry.ts';
import type { CalendarEvent } from '../../calendar/server/service.ts';
import type { TodoItem } from '../../todo/server/service.ts';
import { buildPreview } from './preview.ts';
import type { ParsedItem } from './parser.ts';

const mat = (id: string, name: string, archived = false): Materia => ({ id, name, color: '#000000', colorStrong: '#000000', sigla: 'X', archived, createdAt: '', updatedAt: '' });
const item = (o: Partial<ParsedItem> = {}): ParsedItem => ({ subtareas: [],
  index: 0, tipo: 'tarea', fecha: '2026-11-10', hora: null, titulo: 'Leer', notas: null, duracion: null, categoria: 'tarea', materiaName: 'Álgebra', errors: [], ...o,
});
const run = (items: ParsedItem[], deps: { materias?: Materia[]; todos?: object[]; events?: object[] } = {}) =>
  buildPreview({ ok: true, plan: { title: null, materia: null }, items },
    { materias: deps.materias ?? [mat('m1', 'Álgebra')], todos: (deps.todos ?? []) as TodoItem[], events: (deps.events ?? []) as CalendarEvent[] });

test('resuelve materia por nombre sin tildes ni mayúsculas', () => {
  const p = run([item({ materiaName: 'algebra' })]);
  expect(p.items[0]).toMatchObject({ materiaId: 'm1', materiaArchived: false });
  expect(p.unresolvedMaterias).toEqual([]);
});
test('materia archivada se usa y marca materiaArchived', () => {
  const p = run([item()], { materias: [mat('m1', 'Álgebra', true)] });
  expect(p.items[0]).toMatchObject({ materiaId: 'm1', materiaArchived: true });
});
test('materia inexistente va a unresolvedMaterias una sola vez', () => {
  const p = run([item({ materiaName: 'Física' }), item({ index: 1, materiaName: 'FISICA', titulo: 'Otro' })]);
  expect(p.unresolvedMaterias).toEqual([{ key: 'fisica', name: 'Física' }]);
  expect(p.items[0].materiaId).toBeNull();
});
test('duplicado contra to-do existente', () => {
  expect(run([item()], { todos: [{ dueDate: '2026-11-10', title: 'leer', materiaId: 'm1' }] }).items[0].duplicate).toBe(true);
});
test('duplicado contra evento existente', () => {
  expect(run([item({ tipo: 'parcial' })], { events: [{ startDate: '2026-11-10', title: 'LEER', materiaId: 'm1', repeatWeekdays: null }] }).items[0].duplicate).toBe(true);
});
test('duplicado dentro del mismo plan: el segundo se marca', () => {
  const p = run([item(), item({ index: 1 })]);
  expect(p.items.map((i) => i.duplicate)).toEqual([false, true]);
});
test('mismo título y fecha con distinta materia no es duplicado', () => {
  const p = run([item()], { todos: [{ dueDate: '2026-11-10', title: 'Leer', materiaId: 'm2' }] });
  expect(p.items[0].duplicate).toBe(false);
});
