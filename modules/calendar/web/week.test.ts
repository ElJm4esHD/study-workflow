import { expect, test } from 'vitest';
import { dayItems, hourRange, lanes } from './week.ts';
import type { AgendaData } from './summary.ts';

test('lanes: los que se pisan se reparten y los sueltos ocupan todo el ancho', () => {
  const r = lanes([{ from: 600, to: 720 }, { from: 660, to: 780 }, { from: 800, to: 860 }, { from: 700, to: 710 }]);
  const at = (f: number, t: number) => r.find((x) => x.from === f && x.to === t)!;
  expect(at(600, 720)).toMatchObject({ lane: 0, lanes: 3 });
  expect(at(660, 720 + 60)).toMatchObject({ lane: 1, lanes: 3 });
  expect(at(700, 710)).toMatchObject({ lane: 2, lanes: 3 });
  expect(at(800, 860)).toMatchObject({ lane: 0, lanes: 1 });
});

test('dayItems: todo el día arriba, con hora en la grilla y eventos de varios días cortados', () => {
  const ev = (o: object) => ({ id: 'e', eventId: 'e', title: 'x', kind: 'evento', allDay: false, startTime: null, endTime: null, materiaId: null, occurrenceDate: '2026-11-16', isRecurring: false, ...o });
  const data = {
    events: [
      ev({ id: 'a', startDate: '2026-11-16', endDate: '2026-11-16', startTime: '09:00', endTime: '11:00' }),
      ev({ id: 'b', startDate: '2026-11-15', endDate: '2026-11-16', startTime: '22:00', endTime: '02:00' }),
      ev({ id: 'c', startDate: '2026-11-16', endDate: '2026-11-16', allDay: true, kind: 'final' }),
    ],
    todos: [
      { id: 't1', title: 'sin hora', dueDate: '2026-11-16', dueTime: null, completed: false, durationMin: null },
      { id: 't2', title: 'con hora', dueDate: '2026-11-16', dueTime: '18:00', completed: false, durationMin: 90 },
    ],
  } as unknown as AgendaData;
  const d = dayItems(data, '2026-11-16');
  expect(d.allDay.map((x) => x.key)).toEqual(['c', 'todo:t1']);
  expect(d.timed.map((x) => [x.key, x.from, x.to])).toEqual([['b:2026-11-16', 0, 120], ['a:2026-11-16', 540, 660], ['todo:t2', 1080, 1170]]);
  expect(hourRange([d])).toEqual([0, 23]);
});
