import { expect, test } from 'vitest';
import { addDays, formatDate, isValidDate, isValidTime, lateText, relDate, todayAR, weekdayOf } from './dates.ts';

test('todayAR usa hora argentina: 02:30 UTC es el día anterior', () =>
  expect(todayAR(new Date('2026-11-05T02:30:00Z'))).toBe('2026-11-04'));
test('todayAR a las 03:00 UTC ya es el día nuevo', () =>
  expect(todayAR(new Date('2026-11-05T03:00:00Z'))).toBe('2026-11-05'));
test('isValidDate', () => {
  expect(isValidDate('2028-02-29')).toBe(true);
  for (const s of ['2026-02-29', '2026-02-30', '2026-13-01', '2026-1-05', '05/11/2026', '', 20261105])
    expect(isValidDate(s)).toBe(false);
});
test('isValidTime', () => {
  expect(isValidTime('00:00')).toBe(true); expect(isValidTime('23:59')).toBe(true);
  for (const s of ['24:00', '9:00', '12:60', '12:00:00']) expect(isValidTime(s)).toBe(false);
});
test('addDays cruza mes y año', () => {
  expect(addDays('2026-12-31', 1)).toBe('2027-01-01'); expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
});
test('weekdayOf: lunes=1, domingo=7', () => {
  expect(weekdayOf('2026-11-02')).toBe(1); expect(weekdayOf('2026-11-08')).toBe(7);
});
test('relDate y lateText', () => {
  const t = '2026-11-15';
  expect(['2026-11-15', '2026-11-16', '2026-11-14', '2026-11-18', '2026-11-12', '2026-12-01'].map((d) => relDate(d, t)))
    .toEqual(['Hoy', 'Mañana', 'Ayer', 'En 3 días', 'Hace 3 días', '01/12']);
  expect(['2026-11-14', '2026-11-13', '2026-11-01'].map((d) => lateText(d, t))).toEqual(['Vencida ayer', 'Vencida hace 2 días', 'Vencida el 01/11']);
});
test('formatDate', () => expect(formatDate('2026-11-05')).toBe('05/11/2026'));
