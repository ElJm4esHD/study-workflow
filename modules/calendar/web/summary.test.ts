import { describe, expect, it } from 'vitest';
import { cellLevel, countdownLabel, daysUntil, dayCell, dayDetail, examColor, levelOf, nextExams, weekSummary } from './summary.ts';
import type { AgendaData } from './summary.ts';
import type { Occurrence } from '../server/recurrence.ts';
import type { TodoItem } from '../../todo/server/service.ts';
import type { Materia } from '../../../core/server/registry.ts';
import { NEUTRAL, PALETTE } from '../../../core/shared/palette.ts';

const mat = (id: string, i: number): Materia => ({ id, name: id, color: PALETTE[i].hex, sigla: id.toUpperCase(), archived: false, createdAt: '', updatedAt: '' });
const materias = ['a', 'b', 'c', 'd', 'e'].map(mat);
const ev = (o: Partial<Occurrence>): Occurrence => ({
  id: 'e', title: 'ev', notes: null, kind: 'evento', materiaId: null, allDay: true, startDate: '2026-11-10', startTime: null,
  endDate: '2026-11-10', endTime: null, repeatWeekdays: null, repeatUntil: null, seriesId: null, originalDate: null,
  createdAt: '', updatedAt: '', eventId: 'e', occurrenceDate: '2026-11-10', isRecurring: false, ...o,
});
const td = (o: Partial<TodoItem>): TodoItem => ({
  id: 't', title: 't', notes: null, dueDate: '2026-11-10', dueTime: null, materiaId: null, completed: false, completedAt: null,
  sortOrder: 0, createdAt: '', updatedAt: '', durationMin: 30, category: 'tarea', ...o,
});
const D = '2026-11-10';
const data = (events: Occurrence[], todos: TodoItem[]): AgendaData => ({ events, todos });

describe('summary', () => {
  it('levelOf', () => {
    expect([levelOf(0, false), levelOf(0, true), levelOf(45, false), levelOf(46, false), levelOf(90, false), levelOf(91, false)]).toEqual([0, 1, 1, 2, 2, 3]);
  });
  it('dayCell: maxChips recorta y cuenta more', () => {
    const c = dayCell(data([], materias.map((m) => td({ id: m.id, materiaId: m.id }))), D, materias, 3);
    expect(c.chips).toHaveLength(3);
    expect(c.more).toBe(2);
  });
  it('dayCell: dos exámenes → por hora, el segundo como chip exam', () => {
    const e1 = ev({ id: 'x', kind: 'parcial', materiaId: 'a', allDay: false, startTime: '14:00' });
    const e2 = ev({ id: 'y', kind: 'final', materiaId: 'b', allDay: false, startTime: '09:00' });
    const c = dayCell(data([e1, e2], [td({ materiaId: 'a' }), td({ id: 'u', materiaId: 'c' })]), D, materias, 5);
    expect(c.exams.map((e) => e.id)).toEqual(['y', 'x']);
    expect(c.chips.find((k) => k.exam)?.materiaId).toBe('a');
    expect(c.chips.filter((k) => k.materiaId === 'b')).toEqual([]); // materia del primer examen no suma chips
    expect(c.chips.find((k) => k.materiaId === 'c')?.count).toBe(1);
  });
  it('dayCell: sin materia → Otros neutro; examColor neutro', () => {
    const c = dayCell(data([], [td({})]), D, materias, 3);
    expect(c.chips[0]).toMatchObject({ materiaId: null, sigla: 'Otros', color: NEUTRAL.hex });
    expect(examColor(materias, null)).toEqual({ pastel: NEUTRAL.hex, strong: NEUTRAL.strong });
    expect(examColor(materias, 'a')).toEqual({ pastel: PALETTE[0].hex, strong: PALETTE[0].strong });
  });
  it('dayCell: evento 10..12 cuenta el 11', () => {
    const e = ev({ materiaId: 'a', startDate: '2026-11-10', endDate: '2026-11-12' });
    expect(dayCell(data([e], []), '2026-11-11', materias, 3).chips[0].count).toBe(1);
    expect(dayCell(data([e], []), '2026-11-13', materias, 3).chips).toEqual([]);
  });
  it('dayCell: allDone solo si todas completas', () => {
    const a = td({ materiaId: 'a', completed: true });
    const b = td({ id: 'u', materiaId: 'a' });
    expect(dayCell(data([], [a]), D, materias, 3).chips[0].allDone).toBe(true);
    expect(dayCell(data([], [a, b]), D, materias, 3).chips[0]).toMatchObject({ allDone: false, count: 2 });
  });
  it('dayDetail agrupa con subtotales y cuenta sin estimar', () => {
    const d = dayDetail(data([ev({}), ev({ id: 'p', kind: 'parcial' })], [
      td({ id: '1', materiaId: 'a', durationMin: 30, dueTime: '10:00', title: 'z' }),
      td({ id: '2', materiaId: 'a', durationMin: null, completed: true, dueTime: '09:00' }),
      td({ id: '3', materiaId: null, durationMin: 60 }),
      td({ id: '4', dueDate: null }),
    ]), D);
    expect(d.exams.map((e) => e.id)).toEqual(['p']);
    expect(d.events).toHaveLength(1);
    expect(d.groups.map((g) => [g.materiaId, g.minutes, g.todos.map((t) => t.id)])).toEqual([['a', 30, ['2', '1']], [null, 60, ['3']]]);
    expect(d).toMatchObject({ minutes: 90, unestimated: 1, done: 1, total: 3 });
  });
  it('nextExams', () => {
    const r = nextExams([
      ev({ id: 'old', kind: 'parcial', occurrenceDate: '2026-11-01' }),
      ev({ id: 'c' }),
      ev({ id: 'l', kind: 'final', occurrenceDate: '2026-11-12', startTime: '09:00' }),
      ev({ id: 'k', kind: 'parcial', occurrenceDate: '2026-11-05', startTime: '15:00' }),
      ev({ id: 'j', kind: 'parcial', occurrenceDate: '2026-11-05', startTime: '08:00' }),
    ], '2026-11-05');
    expect(r.map((e) => e.id)).toEqual(['j', 'k', 'l']);
  });
  it('weekSummary: una fila por materia con algo', () => {
    const w = weekSummary(data(
      [ev({ id: 'p', kind: 'parcial', materiaId: 'b', occurrenceDate: '2026-11-07', startDate: '2026-11-07', endDate: '2026-11-07' })],
      [td({ materiaId: 'a', dueDate: '2026-11-06', durationMin: 20 }), td({ id: 'u', materiaId: 'a', dueDate: '2026-11-06', durationMin: null }), td({ id: 'f', materiaId: 'c', dueDate: '2026-11-20' })],
    ), '2026-11-06', 7, );
    expect(w.map((r) => r.materiaId)).toEqual(['a', 'b']);
    expect(w[0]).toMatchObject({ count: 2, minutes: 20 });
    expect(w[0].perDay).toHaveLength(7);
    expect(w[0].perDay[0]).toEqual({ minutes: 20, unestimated: true, exam: false, any: true });
    expect(w[1].perDay[1]).toEqual({ minutes: 0, unestimated: false, exam: true, any: true });
  });

  it('cellLevel, daysUntil, countdownLabel', () => {
    expect([cellLevel({ minutes: 0, unestimated: false, any: true }), cellLevel({ minutes: 100, unestimated: false, any: true }), cellLevel({ minutes: 0, unestimated: false, any: false })]).toEqual([1, 3, 0]);
    expect(daysUntil('2026-11-05', '2026-11-20')).toBe(15);
    expect([0, 1, 15].map(countdownLabel)).toEqual(['Hoy', '1 día', '15 días']);
  });
});
