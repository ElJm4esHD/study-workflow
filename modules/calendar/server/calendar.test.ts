import { expect, test } from 'vitest';
import { makeTestApp } from '../../../core/server/testing.ts';
import { todo } from '../../todo/server/index.ts';
import { calendar } from './index.ts';

const make = async () => {
  const app = await makeTestApp([todo, calendar]);
  const post = (payload: object) => app.inject({ method: 'POST', url: '/api/calendar/events', payload });
  const patch = (id: string, payload: object) => app.inject({ method: 'PATCH', url: `/api/calendar/events/${id}`, payload });
  const agenda = async (from: string, to: string) => (await app.inject(`/api/calendar/agenda?from=${from}&to=${to}`)).json();
  const serie = async () => (await post({
    title: 'Clase', kind: 'evento', allDay: false, startDate: '2026-11-02', startTime: '10:00',
    repeatWeekdays: [1, 3],
  })).json();
  const detach = (id: string, date: string, startTime: string) => app.inject({
    method: 'PUT', url: ev(`${id}/occurrences/${date}`),
    payload: { title: 'Clase', kind: 'evento', allDay: false, startDate: date, startTime },
  });
  return { app, post, patch, agenda, serie, detach };
};
const ev = (path: string) => `/api/calendar/events/${path}`;

test('CRUD de evento simple', async () => {
  const { app, post, patch } = await make();
  const r = await post({ title: ' Parcial ', kind: 'parcial', allDay: true, startDate: '2026-11-20' });
  expect(r.statusCode).toBe(201);
  const e = r.json();
  expect(e).toMatchObject({ title: 'Parcial', endDate: '2026-11-20', repeatWeekdays: null });
  expect((await app.inject(ev(e.id))).json().id).toBe(e.id);
  expect((await patch(e.id, { title: 'Final', kind: 'final' })).json()).toMatchObject({ title: 'Final', kind: 'final' });
  expect((await app.inject({ method: 'DELETE', url: ev(e.id) })).statusCode).toBe(204);
  expect((await app.inject(ev(e.id))).statusCode).toBe(404);
  expect((await patch('nope', {})).json().error.code).toBe('no_encontrado');
});

test('validación: reglas de validateEvent → 400', async () => {
  const { post, patch } = await make();
  const base = { title: 'x', kind: 'evento', allDay: false, startDate: '2026-11-02', startTime: '10:00' };
  for (const bad of [{ title: ' ' }, { kind: 'otro' }, { startTime: null }, { endDate: '2026-11-01' }, { startDate: '2026-02-30' },
    { repeatWeekdays: [8] }, { repeatWeekdays: [1], endDate: '2026-11-03' }]) {
    expect((await post({ ...base, ...bad })).json().error.code).toBe('validacion');
  }
  const e = (await post(base)).json();
  expect((await patch(e.id, { allDay: true })).statusCode).toBe(400);
});

test('agenda expande series e incluye ocurrencias separadas', async () => {
  const { agenda, serie, detach } = await make();
  const s = await serie();
  await detach(s.id, '2026-11-04', '15:00');
  const { events, todos } = await agenda('2026-11-02', '2026-11-08');
  expect(events.map((e: any) => [e.startDate, e.startTime, e.isRecurring])).toEqual([
    ['2026-11-02', '10:00', true], ['2026-11-04', '15:00', false]]);
  expect(events[0].id).toBe(`${s.id}:2026-11-02`);
  expect(todos).toEqual([]);
});

test('editar solo esta: PUT occurrence → exdate + evento separado; la serie no cambia', async () => {
  const { app, agenda, serie, detach } = await make();
  const s = await serie();
  const d = (await detach(s.id, '2026-11-04', '15:00')).json();
  expect(d).toMatchObject({ seriesId: s.id, originalDate: '2026-11-04', repeatWeekdays: null });
  expect((await app.inject(ev(s.id))).json()).toMatchObject({ startTime: '10:00', repeatWeekdays: [1, 3] });
  expect((await detach(s.id, '2026-11-04', '16:00')).json().id).toBe(d.id); // actualiza, no duplica
  expect((await agenda('2026-11-02', '2026-11-08')).events).toHaveLength(2);
});

test('editar toda la serie: PATCH cambia la hora en todas, el separado queda igual', async () => {
  const { patch, agenda, serie, detach } = await make();
  const s = await serie();
  await detach(s.id, '2026-11-04', '15:00');
  expect((await patch(s.id, { startTime: '08:00' })).statusCode).toBe(200);
  const { events } = await agenda('2026-11-02', '2026-11-09');
  expect(events.map((e: any) => e.startTime)).toEqual(['08:00', '15:00', '08:00']);
});

test('borrar solo esta: DELETE occurrence → desaparece esa fecha', async () => {
  const { app, agenda, serie } = await make();
  const s = await serie();
  expect((await app.inject({ method: 'DELETE', url: ev(`${s.id}/occurrences/2026-11-02`) })).statusCode).toBe(204);
  expect((await agenda('2026-11-02', '2026-11-08')).events.map((e: any) => e.startDate)).toEqual(['2026-11-04']);
});

test('borrar la serie borra también los separados', async () => {
  const { app, agenda, serie, detach } = await make();
  const s = await serie();
  await detach(s.id, '2026-11-04', '15:00');
  await app.inject({ method: 'DELETE', url: ev(s.id) });
  expect((await agenda('2026-11-01', '2026-11-30')).events).toEqual([]);
});

test('agenda incluye to-dos con fecha si todo está habilitado y los excluye si no', async () => {
  const { app, agenda } = await make();
  await app.inject({ method: 'POST', url: '/api/todo', payload: { title: 'Guía', dueDate: '2026-11-03' } });
  expect((await agenda('2026-11-02', '2026-11-08')).todos).toHaveLength(1);
  app.ctx.settings.set('modules.enabled', { todo: false });
  expect((await agenda('2026-11-02', '2026-11-08')).todos).toEqual([]);
});

test('rango inválido o > 400 días → 400 rango_invalido', async () => {
  const { app, agenda } = await make();
  expect((await agenda('2026-01-01', '2027-02-06')).error.code).toBe('rango_invalido');
  expect((await agenda('2026-01-01', '2027-02-05')).events).toEqual([]);
  expect((await agenda('2026-11-08', '2026-11-02')).error.code).toBe('rango_invalido');
  expect((await app.inject('/api/calendar/agenda?from=x&to=y')).json().error.code).toBe('rango_invalido');
});

test('occurrence en un evento sin repetición → 400 no_es_serie; fecha fuera de la serie → 400', async () => {
  const { app, post, serie } = await make();
  const e = (await post({ title: 'x', kind: 'evento', allDay: true, startDate: '2026-11-02' })).json();
  expect((await app.inject({ method: 'DELETE', url: ev(`${e.id}/occurrences/2026-11-02`) })).json().error.code).toBe('no_es_serie');
  const s = await serie();
  expect((await app.inject({ method: 'DELETE', url: ev(`${s.id}/occurrences/2026-11-03`) })).json().error.code).toBe('fecha_fuera_de_serie');
});

test('occurrence con fecha mal formada → 400 fecha_fuera_de_serie (no 500)', async () => {
  const { app, post } = await make();
  const e = (await post({ title: 'x', kind: 'evento', allDay: true, startDate: '2026-11-02', repeatWeekdays: [1] })).json();
  const r = await app.inject({ method: 'DELETE', url: ev(`${e.id}/occurrences/basura`) });
  expect(r.statusCode).toBe(400);
  expect(r.json().error.code).toBe('fecha_fuera_de_serie');
});

test('PUT occurrence sobre una ya separada reemplaza completo', async () => {
  const { app, serie } = await make();
  const s = await serie();
  await app.inject({
    method: 'PUT', url: ev(`${s.id}/occurrences/2026-11-04`),
    payload: { title: 'Clase', kind: 'evento', allDay: false, startDate: '2026-11-04', startTime: '15:00', endTime: '16:00', notes: 'n' },
  });
  const r = await app.inject({
    method: 'PUT', url: ev(`${s.id}/occurrences/2026-11-04`),
    payload: { title: 'Clase', kind: 'evento', allDay: true, startDate: '2026-11-04' },
  });
  expect(r.statusCode).toBe(200);
  expect(r.json()).toMatchObject({ allDay: true, startTime: null, endTime: null, notes: null });
});
