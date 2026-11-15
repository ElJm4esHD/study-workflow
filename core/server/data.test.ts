import { expect, test } from 'vitest';
import { calendar } from '../../modules/calendar/server/index.ts';
import { todo } from '../../modules/todo/server/index.ts';
import { PALETTE } from '../shared/palette.ts';
import { exportBackup, importBackup } from './data.ts';
import { makeTestApp } from './testing.ts';

const seed = async () => {
  const app = await makeTestApp([todo, calendar]);
  const m = app.ctx.materias.create({ name: 'Álgebra', color: PALETTE[0].hex });
  await app.inject({ method: 'POST', url: '/api/todo', payload: { title: 'Guía de álgebra lineal', materiaId: m.id, dueDate: '2026-11-20' } });
  await app.inject({ method: 'POST', url: '/api/todo', payload: { title: 'Comprar café', notes: 'ALGEBRA no' } });
  await app.inject({ method: 'POST', url: '/api/calendar/events', payload: { title: 'Parcial de Álgebra', kind: 'parcial', materiaId: m.id, allDay: true, startDate: '2026-11-25' } });
  return { app, m };
};

test('exportar y restaurar en otra base devuelve lo mismo', async () => {
  const { app } = await seed();
  const b = JSON.parse(JSON.stringify(exportBackup(app.ctx)));
  expect(b.tables.todo_items).toHaveLength(2);
  const other = await makeTestApp([todo, calendar]);
  expect(importBackup(other.ctx, b).filas).toBe(4);
  expect(exportBackup(other.ctx).tables).toEqual(b.tables);
  // GET /api/backup baja como archivo
  const r = await app.inject('/api/backup');
  expect(r.headers['content-disposition']).toMatch(/attachment; filename="study-workflow-d{4}-d{2}-d{2}.json"/);
});

test('restaurar reemplaza lo que había y rechaza archivos que no son del backup sin cambiar nada', async () => {
  const { app } = await seed();
  const b = JSON.parse(JSON.stringify(exportBackup(app.ctx)));
  await app.inject({ method: 'POST', url: '/api/todo', payload: { title: 'Extra' } });
  importBackup(app.ctx, b);
  expect((await app.inject('/api/todo')).json()).toHaveLength(2);
  for (const mal of [{}, { ...b, format: 'otra' }, { ...b, tables: { ...b.tables, inventada: [] } }, { ...b, tables: { todo_items: [{ id: 'x', title: 't', zzz: 1 }] } }]) {
    expect(() => importBackup(app.ctx, mal)).toThrow();
  }
  // datos inconsistentes (FK a una materia que no existe): vuelve atrás y deja todo como estaba
  const roto = { ...b, tables: { ...b.tables, todo_items: b.tables.todo_items.map((t: object) => ({ ...t, materia_id: 'no-existe' })) } };
  expect(() => importBackup(app.ctx, roto)).toThrow(/No se cambió nada/);
  expect((await app.inject('/api/todo')).json()).toHaveLength(2);
});

test('búsqueda global: tareas y eventos, sin distinguir mayúsculas; mínimo 2 letras', async () => {
  const { app } = await seed();
  const hits = (q: string) => app.inject(`/api/search?q=${encodeURIComponent(q)}`).then((r) => r.json() as { kind: string; title: string; to: string }[]);
  expect((await hits('álgebra')).map((h) => h.title).sort()).toEqual(['Comprar café', 'Guía de álgebra lineal', 'Parcial de Álgebra']);
  expect((await hits('lineal')).map((h) => h.title)).toEqual(['Guía de álgebra lineal']);
  expect((await hits('ALGEBRA')).map((h) => h.title).sort()).toEqual(['Comprar café', 'Guía de álgebra lineal', 'Parcial de Álgebra']); // sin tildes ni mayúsculas, también en las notas
  expect(await hits('a')).toEqual([]);
  expect((await hits('100%'))).toEqual([]);
  expect((await hits("Parcial"))[0]).toMatchObject({ kind: "parcial", to: expect.stringMatching(/^[/]calendario[/]evento[/]/) });
});
