import type { Occurrence } from '../app/recurrence.ts';
import type { TodoItem } from '../../todo/app/service.ts';
import type { Materia } from '../../../core/app/registry.ts';
import { EXAM_KINDS } from '../shared.ts';
import { NEUTRAL, strongOf } from '../../../core/shared/palette.ts';
import { addDays } from '../../../core/shared/dates.ts';

export type AgendaData = { events: Occurrence[]; todos: TodoItem[] };
type Chip = { materiaId: string | null; sigla: string; color: string; count: number; allDone: boolean; exam: boolean };

const isExam = (e: Occurrence) => EXAM_KINDS.includes(e.kind);
const onDay = (e: Occurrence, date: string) => e.startDate <= date && date <= e.endDate;
const byTime = (a: Occurrence, b: Occurrence) => (a.startTime ?? '').localeCompare(b.startTime ?? '');
const todosOn = (todos: TodoItem[], date: string) => todos.filter((t) => t.dueDate === date);
const sortTodos = (ts: TodoItem[]) => [...ts].sort((a, b) => (a.dueTime ?? '99').localeCompare(b.dueTime ?? '99') || a.title.localeCompare(b.title));
const minutesOf = (ts: TodoItem[]) => ts.reduce((s, t) => s + (t.durationMin ?? 0), 0);

export const levelOf = (minutes: number, unestimated: boolean): 0 | 1 | 2 | 3 =>
  minutes > 90 ? 3 : minutes > 45 ? 2 : minutes > 0 || unestimated ? 1 : 0;

export const examColor = (materias: Materia[], materiaId: string | null): { pastel: string; strong: string } => {
  const m = materias.find((x) => x.id === materiaId);
  return m ? { pastel: m.color, strong: strongOf(m.color) } : { pastel: NEUTRAL.hex, strong: NEUTRAL.strong };
};

export function dayCell(data: AgendaData, date: string, materias: Materia[], maxChips: number): { exams: Occurrence[]; chips: Chip[]; more: number } {
  const evs = data.events.filter((e) => onDay(e, date));
  const exams = evs.filter(isExam).sort(byTime);
  const skip = exams[0] ? exams[0].materiaId : undefined; // undefined = no hay examen que pinte la celda
  const chipOf = (materiaId: string | null, count: number, allDone: boolean, exam: boolean): Chip => {
    const m = materias.find((x) => x.id === materiaId);
    return { materiaId, sigla: m?.sigla ?? 'Otros', color: m?.color ?? NEUTRAL.hex, count, allDone, exam };
  };
  const groups = new Map<string | null, { n: number; done: boolean }>();
  const add = (id: string | null, done: boolean) => {
    const g = groups.get(id) ?? { n: 0, done: true };
    groups.set(id, { n: g.n + 1, done: g.done && done });
  };
  todosOn(data.todos, date).forEach((t) => add(t.materiaId, t.completed));
  evs.filter((e) => !isExam(e)).forEach((e) => add(e.materiaId, false));
  const rank = (id: string | null) => { const i = materias.findIndex((m) => m.id === id); return i < 0 ? Infinity : i; };
  const chips = [
    ...exams.slice(1).map((e) => chipOf(e.materiaId, 1, false, true)),
    ...[...groups].filter(([id]) => id !== skip).sort((a, b) => rank(a[0]) - rank(b[0]))
      .map(([id, g]) => chipOf(id, g.n, g.done, false)),
  ];
  return { exams, chips: chips.slice(0, maxChips), more: Math.max(0, chips.length - maxChips) };
}

export function dayDetail(data: AgendaData, date: string) {
  const evs = data.events.filter((e) => onDay(e, date));
  const todos = sortTodos(todosOn(data.todos, date));
  const byMateria = new Map<string | null, TodoItem[]>(); // orden de primera aparición
  todos.forEach((t) => byMateria.set(t.materiaId, [...(byMateria.get(t.materiaId) ?? []), t]));
  return {
    exams: evs.filter(isExam).sort(byTime),
    events: evs.filter((e) => !isExam(e)).sort(byTime),
    groups: [...byMateria].map(([materiaId, ts]) => ({ materiaId, todos: ts, minutes: minutesOf(ts) }))
      .sort((a, b) => Number(a.materiaId === null) - Number(b.materiaId === null)), // "Sin materia" al final
    minutes: minutesOf(todos),
    unestimated: todos.filter((t) => t.durationMin === null).length,
    done: todos.filter((t) => t.completed).length,
    total: todos.length,
  };
}

export const nextExams = (events: Occurrence[], today: string): Occurrence[] =>
  events.filter((e) => isExam(e) && e.occurrenceDate >= today)
    .sort((a, b) => a.occurrenceDate.localeCompare(b.occurrenceDate) || byTime(a, b));

export function weekSummary(data: AgendaData, from: string, days: number) {
  const dates = Array.from({ length: days }, (_, i) => addDays(from, i));
  const rows = new Map<string | null, { perDay: { minutes: number; unestimated: boolean; exam: boolean; any: boolean }[]; count: number; minutes: number }>();
  const row = (id: string | null) => {
    if (!rows.has(id)) rows.set(id, { perDay: dates.map(() => ({ minutes: 0, unestimated: false, exam: false, any: false })), count: 0, minutes: 0 });
    return rows.get(id)!;
  };
  dates.forEach((d, i) => {
    for (const t of todosOn(data.todos, d)) {
      const r = row(t.materiaId);
      const m = t.durationMin ?? 0;
      r.count++; r.minutes += m; r.perDay[i].minutes += m; r.perDay[i].any = true;
      if (t.durationMin === null) r.perDay[i].unestimated = true;
    }
    for (const e of data.events.filter((x) => onDay(x, d))) {
      const r = row(e.materiaId);
      if (i === dates.findIndex((x) => onDay(e, x))) r.count++; // un evento multi-día cuenta una vez
      r.perDay[i].any = true;
      if (isExam(e)) r.perDay[i].exam = true;
    }
  });
  return [...rows].map(([materiaId, r]) => ({ materiaId, ...r }));
}

/** Nivel de un casillero de regla: algo ese día (aunque sea un evento sin minutos) pinta al menos 1. */
export const cellLevel = (p: { minutes: number; unestimated: boolean; any: boolean }): 0 | 1 | 2 | 3 =>
  Math.max(levelOf(p.minutes, p.unestimated), p.any ? 1 : 0) as 0 | 1 | 2 | 3;

export const daysUntil = (from: string, to: string): number => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

export const countdownLabel = (n: number): string => (n <= 0 ? 'Hoy' : n === 1 ? '1 día' : `${n} días`);

export const examWhat = (kind: string, materia?: string): string => (materia ? `${kind} de ${materia}` : kind);

export const whenLabel = (n: number): string => (n <= 0 ? 'hoy' : n === 1 ? 'mañana' : `en ${n} días`);
