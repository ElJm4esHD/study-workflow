import { expect, test } from 'vitest';
import { expandEvents } from './recurrence.ts';
import type { CalendarEvent } from './service.ts';

const ev = (o: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: 'e', title: 'Clase', notes: null, kind: 'evento', materiaId: null, allDay: false,
  startDate: '2026-11-02', startTime: '10:00', endDate: '2026-11-02', endTime: null,
  repeatWeekdays: [1, 3], repeatUntil: null, seriesId: null, originalDate: null, createdAt: '', updatedAt: '', ...o,
});
const dates = (events: CalendarEvent[], from: string, to: string, ex = new Map<string, Set<string>>()) =>
  expandEvents(events, ex, from, to).map((o) => o.occurrenceDate);

test('serie lun/mié desde 2026-11-02 en la semana 2026-11-02..08 → 02 y 04', () => {
  const r = expandEvents([ev()], new Map(), '2026-11-02', '2026-11-08');
  expect(r.map((o) => o.occurrenceDate)).toEqual(['2026-11-02', '2026-11-04']);
  expect(r[0]).toMatchObject({ id: 'e:2026-11-02', eventId: 'e', isRecurring: true, startDate: '2026-11-02', endDate: '2026-11-02' });
});

test('respeta repeatUntil inclusive', () => {
  expect(dates([ev({ repeatUntil: '2026-11-04' })], '2026-11-01', '2026-11-30')).toEqual(['2026-11-02', '2026-11-04']);
});

test('no genera antes de startDate aunque el rango empiece antes', () => {
  expect(dates([ev({ startDate: '2026-11-04', endDate: '2026-11-04' })], '2026-10-26', '2026-11-08')).toEqual(['2026-11-04']);
});

test('excluye exdates', () => {
  expect(dates([ev()], '2026-11-02', '2026-11-08', new Map([['e', new Set(['2026-11-02'])]]))).toEqual(['2026-11-04']);
});

test('domingo (7) y lunes (1) en el borde del rango', () => {
  const e = ev({ repeatWeekdays: [1, 7], startDate: '2026-10-01', endDate: '2026-10-01' });
  expect(dates([e], '2026-11-01', '2026-11-02')).toEqual(['2026-11-01', '2026-11-02']);
  expect(dates([e], '2026-11-02', '2026-11-08')).toEqual(['2026-11-02', '2026-11-08']);
});

test('evento de varios días se incluye si se cruza con el rango', () => {
  const e = ev({ repeatWeekdays: null, startDate: '2026-11-01', endDate: '2026-11-05' });
  expect(dates([e], '2026-11-05', '2026-11-09')).toEqual(['2026-11-01']);
  expect(dates([e], '2026-11-06', '2026-11-09')).toEqual([]);
  expect(expandEvents([e], new Map(), '2026-11-03', '2026-11-04')[0]).toMatchObject({ id: 'e', isRecurring: false, startDate: '2026-11-01' });
});

test('sin repeatUntil, se corta en el fin del rango', () => {
  expect(dates([ev()], '2026-11-02', '2026-11-16')).toHaveLength(5);
});
