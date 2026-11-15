import { expect, test } from 'vitest';
import { aV1, aV2, informe, type BackupV1 } from './migracion.ts';
import { PALETTE } from './palette.ts';

// Datos de ejemplo (nada real): una materia, tareas con subtareas y recordatorio, una serie con excepción y un evento separado, finales, un plan.
const fixture = (): BackupV1 => ({
  format: 'study-workflow-backup', version: 1, exportedAt: '2026-11-15T19:00:00.000Z',
  tables: {
    materias: [
      { id: 'm1', name: 'Álgebra', name_key: 'algebra', color: PALETTE[0]!.hex, archived: 0, created_at: '2026-11-01T10:00:00.000Z', updated_at: '2026-11-02T10:00:00.000Z', sigla: 'ALG' },
      { id: 'm2', name: 'Física', name_key: 'fisica', color: PALETTE[1]!.hex, archived: 1, created_at: '2026-11-01T10:00:00.000Z', updated_at: '2026-11-01T10:00:00.000Z', sigla: 'FIS' },
    ],
    settings: [{ key: 'modules.enabled', value: '{"todo":true}' }],
    todo_items: [
      { id: 't1', title: 'Guía 1', notes: 'n', due_date: '2026-11-20', due_time: '09:00', materia_id: 'm1', completed: 0, completed_at: null, sort_order: 1, created_at: '2026-11-03T10:00:00.000Z', updated_at: '2026-11-03T10:00:00.000Z', duration_min: 60, category: 'estudio', subtasks: '[{"id":"s1","title":"Ej 1","done":true},{"id":"s2","title":"Ej 2","done":false}]', reminder_min: 15, reminder_insistent: 1 },
      { id: 't2', title: 'Hecha', notes: null, due_date: null, due_time: null, materia_id: null, completed: 1, completed_at: '2026-11-04T10:00:00.000Z', sort_order: 2, created_at: '2026-11-03T10:00:00.000Z', updated_at: '2026-11-04T10:00:00.000Z', duration_min: null, category: 'tarea', subtasks: '[]', reminder_min: null, reminder_insistent: 0 },
    ],
    calendar_events: [
      { id: 'e1', title: 'Clase', notes: null, kind: 'evento', materia_id: 'm1', all_day: 0, start_date: '2026-11-02', start_time: '10:00', end_date: '2026-11-02', end_time: '12:00', repeat_weekdays: '1,3', repeat_until: '2026-12-15', series_id: null, original_date: null, created_at: '2026-11-01T10:00:00.000Z', updated_at: '2026-11-01T10:00:00.000Z', reminder_min: 30, reminder_insistent: 0 },
      { id: 'e2', title: 'Clase movida', notes: null, kind: 'evento', materia_id: 'm1', all_day: 0, start_date: '2026-11-04', start_time: '14:00', end_date: '2026-11-04', end_time: null, repeat_weekdays: null, repeat_until: null, series_id: 'e1', original_date: '2026-11-04', created_at: '2026-11-03T10:00:00.000Z', updated_at: '2026-11-03T10:00:00.000Z', reminder_min: null, reminder_insistent: 0 },
      { id: 'e3', title: 'Final', notes: null, kind: 'final', materia_id: 'm1', all_day: 1, start_date: '2026-12-10', start_time: null, end_date: '2026-12-10', end_time: null, repeat_weekdays: null, repeat_until: null, series_id: null, original_date: null, created_at: '2026-11-05T10:00:00.000Z', updated_at: '2026-11-05T10:00:00.000Z', reminder_min: null, reminder_insistent: 0 },
    ],
    calendar_exdates: [{ event_id: 'e1', date: '2026-11-04' }],
    finals_dates: [{ id: 'f1', materia_id: 'm1', date: '2026-12-10', time: null }, { id: 'f2', materia_id: 'm1', date: '2026-12-17', time: '09:00' }],
    finals_chosen: [{ materia_id: 'm1', event_id: 'e3' }],
    import_plans: [{ id: 'p1', title: 'Plan A', created_at: '2026-11-06T10:00:00.000Z' }],
    import_plan_items: [{ plan_id: 'p1', item_type: 'todo', item_id: 't1' }, { plan_id: 'p1', item_type: 'event', item_id: 'e3' }],
  },
});

test('v1 → v2: cada fila pasa a un documento, las tablas hijas van adentro y el HLC sale de updated_at', () => {
  const recs = aV2(fixture());
  const get = (t: string, id: string) => recs.find((r) => r.t === t && r.id === id)!;
  expect(recs).toHaveLength(2 + 1 + 2 + 3 + 2 + 1 + 1);
  expect(get('materias', 'm1').data).toMatchObject({ name: 'Álgebra', colorStrong: PALETTE[0]!.strong, archived: false, sigla: 'ALG' });
  expect(get('materias', 'm2').data).toMatchObject({ archived: true });
  expect(get('todo_items', 't1').data).toMatchObject({ completed: false, reminderMin: 15, reminderInsistent: true, subtasks: [{ id: 's1', title: 'Ej 1', done: true }, { id: 's2', title: 'Ej 2', done: false }] });
  expect(get('calendar_events', 'e1').data).toMatchObject({ repeatWeekdays: [1, 3], exdates: ['2026-11-04'], allDay: false });
  expect(get('calendar_events', 'e2').data).toMatchObject({ seriesId: 'e1', originalDate: '2026-11-04', exdates: [] });
  expect(get('finals_chosen', 'm1').data).toEqual({ id: 'm1', materiaId: 'm1', eventId: 'e3' });
  expect(get('import_plans', 'p1').data).toMatchObject({ items: [{ type: 'todo', id: 't1' }, { type: 'event', id: 'e3' }] });
  expect(get('settings', 'modules.enabled').data).toEqual({ id: 'modules.enabled', value: { todo: true } });
  expect(get('materias', 'm1').hlc).toBe('1794218400000-0000-migr'.replace('1794218400000', String(Date.parse('2026-11-02T10:00:00.000Z'))));
});

test('el informe coincide y la ida y vuelta v1 → v2 → v1 es idéntica', () => {
  const b = fixture();
  const inf = informe(b, aV2(b));
  expect(inf.lineas.filter((l) => !l.ok)).toEqual([]);
  expect(inf.idaYVuelta).toEqual([]);
  expect(inf.ok).toBe(true);
  expect(inf.lineas.find((l) => l.nombre === 'subtareas')).toMatchObject({ antes: 2, despues: 2 });
  expect(inf.lineas.find((l) => l.nombre === 'recordatorios de eventos')).toMatchObject({ antes: 1, despues: 1 });
});

test('el informe detecta si se pierde algo', () => {
  const b = fixture();
  const recs = aV2(b).filter((r) => !(r.t === 'todo_items' && r.id === 't2'));
  const inf = informe(b, recs);
  expect(inf.ok).toBe(false);
  expect(inf.lineas.find((l) => l.nombre === 'tareas')).toMatchObject({ ok: false });
});

test('vuelta atrás: aV1 acepta registros con marcas de borrado y las ignora', () => {
  const recs = [...aV2(fixture()), { t: 'todo_items', id: 'borrada', data: null, hlc: '1794218400000-0000-x' }];
  expect(aV1(recs).tables.todo_items!.map((r) => r.id)).toEqual(['t1', 't2']);
});

test('una materia con color fuera de la paleta o sin sigla se corrige (y se nota en la ida y vuelta)', () => {
  const b = fixture();
  b.tables.materias![0] = { ...b.tables.materias![0]!, color: '#e5484e', sigla: '' };
  const recs = aV2(b);
  expect(recs.find((r) => r.id === 'm1')!.data).toMatchObject({ sigla: 'ALG' });
  expect(PALETTE.some((p) => p.hex === (recs.find((r) => r.id === 'm1')!.data as { color: string }).color)).toBe(true);
  expect(informe(b, recs).idaYVuelta).toEqual([expect.stringContaining('materias')]);
});
