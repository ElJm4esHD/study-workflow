import { expect, test } from 'vitest';
import { PALETTE } from '../../../core/shared/palette.ts';
import { makeTestApp } from '../../../core/server/testing.ts';
import { calendar } from './index.ts';
import { validateEvent } from './service.ts';
import type { CalendarService, EventInput } from './service.ts';

const make = async () => {
  const app = await makeTestApp([calendar]);
  return { app, svc: app.ctx.services.get<CalendarService>('calendar')! };
};
const base: EventInput = { title: 'x', kind: 'evento', allDay: true, startDate: '2026-11-10' };

test('createMany crea eventos todo el día y con hora', async () => {
  const { svc } = await make();
  const [a, b] = svc.createMany([
    base,
    { title: 'Clase', kind: 'evento', allDay: false, startDate: '2026-11-10', startTime: '09:00', endTime: '11:00', repeatWeekdays: [1, 3] },
  ]);
  expect(a).toMatchObject({ allDay: true, startTime: null, endDate: '2026-11-10', repeatWeekdays: null, seriesId: null });
  expect(b).toMatchObject({ allDay: false, startTime: '09:00', endTime: '11:00', repeatWeekdays: [1, 3] });
  expect(svc.getByIds([a!.id, b!.id])).toHaveLength(2);
});

test('validateEvent rechaza cada regla', () => {
  const timed = { ...base, allDay: false, startTime: '10:00' };
  const bad: EventInput[] = [
    { ...base, title: ' ' }, { ...base, title: 'x'.repeat(201) },
    { ...base, startTime: '10:00' }, { ...base, allDay: false },
    { ...base, endTime: '10:00' }, { ...base, endDate: '2026-11-09' },
    { ...timed, endTime: '10:00' }, { ...timed, endTime: '09:00' },
    { ...base, repeatWeekdays: [] }, { ...base, repeatWeekdays: [0] }, { ...base, repeatWeekdays: [8] },
    { ...base, repeatWeekdays: [1, 1] }, { ...base, repeatWeekdays: [1], endDate: '2026-11-11' },
    { ...base, repeatWeekdays: [1], repeatUntil: '2026-11-09' },
  ];
  for (const i of bad) expect(validateEvent(i), JSON.stringify(i)).not.toBeNull();
  expect(validateEvent({ ...timed, endTime: '11:00', repeatWeekdays: [1], repeatUntil: '2026-12-01' })).toBeNull();
});

test('createMany con un inválido tira 400 y no crea nada', async () => {
  const { app, svc } = await make();
  expect(() => app.ctx.transaction(() => svc.createMany([base, { ...base, title: '' }]))).toThrow(/título/);
  expect(svc.findByDates(['2026-11-10'])).toHaveLength(0);
  expect(() => svc.create({ ...base, title: '' })).toThrowError(expect.objectContaining({ status: 400, code: 'validacion' }));
});

test('findByDates ignora eventos con repetición', async () => {
  const { svc } = await make();
  svc.createMany([base, { ...base, title: 'rep', repeatWeekdays: [2] }]);
  expect(svc.findByDates(['2026-11-10']).map((e) => e.title)).toEqual(['x']);
});

test('deleteByIds con exceptKinds mantiene los exámenes', async () => {
  const { svc } = await make();
  const [e, p] = svc.createMany([base, { ...base, kind: 'parcial' }]);
  expect(svc.deleteByIds([e!.id, p!.id], { exceptKinds: ['parcial'] })).toBe(1);
  expect(svc.getByIds([e!.id, p!.id]).map((x) => x.kind)).toEqual(['parcial']);
});

test('materia inexistente → 400 materia_inexistente', async () => {
  const { app, svc } = await make();
  expect(() => svc.create({ ...base, materiaId: 'nope' })).toThrow('La materia no existe.');
  const m = app.ctx.materias.create({ name: 'X', color: PALETTE[0]!.hex });
  expect(svc.create({ ...base, materiaId: m.id }).materiaId).toBe(m.id);
});
