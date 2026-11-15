import { expect, test } from 'vitest';
import { parseDate, parseTime } from './DateTime.tsx';

test('parseTime acepta formas rápidas', () => {
  expect(['930', '9:30', '9.30', '21', '0905', '7', '24:00', '9:60', 'x', ''].map(parseTime))
    .toEqual(['09:30', '09:30', '09:30', '21:00', '09:05', '07:00', null, null, null, null]);
});

test('parseDate acepta formas rápidas y rechaza fechas imposibles', () => {
  const t = '2026-11-15';
  expect(['5/11/2026', '05112026', '5/11', '0511', '5-11-26', '051126', 'hoy', 'mañana', '31/02', '32/01', '5/13', 'x'].map((s) => parseDate(s, t)))
    .toEqual(['2026-11-05', '2026-11-05', '2026-11-05', '2026-11-05', '2026-11-05', '2026-11-05', t, '2026-11-16', null, null, null, null]);
});
