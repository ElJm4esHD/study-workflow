import { expect, test } from 'vitest';
import { makeTestApp } from '../../../core/app/testing.ts';
import { PALETTE } from '../../../core/shared/palette.ts';
import { todo } from '../../todo/app/index.ts';
import { calendar } from '../../calendar/app/index.ts';
import { finals } from './index.ts';

const make = async () => {
  const app = await makeTestApp([todo, calendar, finals]);
  const call = async (method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', url: string, payload?: object) => {
    const r = await app.inject({ method, url, payload });
    return { status: r.statusCode, json: r.body ? r.json() : undefined };
  };
  const materia = async (name: string, sigla: string) => (await call('POST', '/api/materias', { name, sigla, color: PALETTE[0]!.hex })).json.id as string;
  const finalsInCalendar = async () => (await call('GET', '/api/calendar/agenda?from=2026-12-01&to=2026-12-31')).json.events as { kind: string; startDate: string; allDay: boolean; startTime: string | null }[];
  return { call, materia, finalsInCalendar };
};
const json = (materias: object[]) => JSON.stringify({ studyWorkflow: 'finales', version: 1, materias });

test('fechas a mano: alta, edición, baja y validación', async () => {
  const { call, materia } = await make();
  const a = await materia('Álgebra', 'ALG');
  expect((await call('POST', '/api/finals/dates', { materiaId: a, date: '2026-02-30' })).status).toBe(400);
  expect((await call('POST', '/api/finals/dates', { materiaId: 'x', date: '2026-12-03' })).status).toBe(400);
  const d = (await call('POST', '/api/finals/dates', { materiaId: a, date: '2026-12-03', time: '09:00' })).json;
  expect((await call('PATCH', `/api/finals/dates/${d.id}`, { date: '2026-12-04', time: null })).json).toMatchObject({ date: '2026-12-04', time: null });
  expect((await call('DELETE', `/api/finals/dates/${d.id}`)).status).toBe(204);
  expect((await call('GET', '/api/finals')).json).toEqual({ dates: [], chosen: [] });
});

test('importar: matchea por nombre o sigla, usa el mapa y reemplaza las fechas de esas materias', async () => {
  const { call, materia } = await make();
  const a = await materia('Álgebra', 'ALG');
  const f = await materia('Física I', 'FIS');
  await call('POST', '/api/finals/dates', { materiaId: a, date: '2026-12-01' });
  await call('POST', '/api/finals/dates', { materiaId: f, date: '2026-12-02' });
  const text = 'Listo:\n' + json([
    { materia: 'alg', fechas: [{ fecha: '2026-12-03', hora: '09:00' }, { fecha: '2026-12-10' }] },
    { materia: 'Fisica 1', fechas: [{ fecha: '2026-12-05' }] },
    { materia: 'Química', fechas: [{ fecha: '2026-12-06' }] },
  ]);
  expect((await call('POST', '/api/finals/import', { text })).json).toEqual({ materias: 1, fechas: 2 });
  expect((await call('POST', '/api/finals/import', { text, map: { 'fisica 1': f, quimica: null } })).json).toEqual({ materias: 2, fechas: 3 });
  const { dates } = (await call('GET', '/api/finals')).json;
  expect(dates.map((d: { date: string }) => d.date)).toEqual(['2026-12-03', '2026-12-05', '2026-12-10']);
  expect((await call('POST', '/api/finals/import', { text: 'nada' })).status).toBe(400);
});

test('elegir crea los finales en el calendario, elegir otra reemplaza y deshacer los borra', async () => {
  const { call, materia, finalsInCalendar } = await make();
  const a = await materia('Álgebra', 'ALG');
  const f = await materia('Física', 'FIS');
  const add = async (materiaId: string, date: string, time?: string) => (await call('POST', '/api/finals/dates', { materiaId, date, time })).json.id as string;
  const a1 = await add(a, '2026-12-03', '09:00'), a2 = await add(a, '2026-12-10'), f1 = await add(f, '2026-12-15');

  expect((await call('PUT', '/api/finals/chosen', { dateIds: [a1, a2] })).status).toBe(400); // dos de la misma materia
  expect((await call('PUT', '/api/finals/chosen', { dateIds: [a1, 'nope'] })).status).toBe(400);

  const r = await call('PUT', '/api/finals/chosen', { dateIds: [a1, f1] });
  expect(r.json.chosen).toHaveLength(2);
  expect(await finalsInCalendar()).toMatchObject([
    { kind: 'final', startDate: '2026-12-03', allDay: false, startTime: '09:00' },
    { kind: 'final', startDate: '2026-12-15', allDay: true },
  ]);

  await call('PUT', '/api/finals/chosen', { dateIds: [a2, f1] });
  expect((await finalsInCalendar()).map((e) => e.startDate)).toEqual(['2026-12-10', '2026-12-15']);

  expect((await call('DELETE', '/api/finals/chosen')).json.chosen).toEqual([]);
  expect(await finalsInCalendar()).toEqual([]);
});
