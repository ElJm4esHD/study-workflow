import type { TodoItem } from '../server/service.ts';
import { addDays, formatDate } from '../../../core/shared/dates.ts';

export type TodoView = 'hoy' | 'proximas' | 'sin-fecha' | 'materia' | 'completadas';
export type TodoGroup = { key: string; label: string; items: TodoItem[]; reorderable: boolean };

export const sortDay = (items: TodoItem[]): TodoItem[] =>
  [...items].sort((a, b) =>
    a.dueTime && b.dueTime ? a.dueTime.localeCompare(b.dueTime)
      : a.dueTime ? -1 : b.dueTime ? 1 : a.sortOrder - b.sortOrder);

// Sort estable: dentro de cada fecha queda el orden de sortDay.
const byDate = (items: TodoItem[]) => sortDay(items).sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));

export const orderBetween = (prev?: number, next?: number): number =>
  prev === undefined ? (next === undefined ? 1 : next - 1) : next === undefined ? prev + 1 : (prev + next) / 2;

export function groupTodos(items: TodoItem[], view: TodoView, today: string, materiaFilter?: string | null): TodoGroup[] {
  const pending = items.filter((i) => !i.completed);
  const group = (key: string, label: string, its: TodoItem[], reorderable: boolean): TodoGroup => ({ key, label, items: its, reorderable });
  switch (view) {
    case 'hoy': {
      const late = pending.filter((i) => i.dueDate !== null && i.dueDate < today);
      const now = pending.filter((i) => i.dueDate === today);
      return [
        ...(late.length ? [group('vencidas', 'Vencidas', byDate(late), true)] : []),
        group('hoy', 'Hoy', sortDay(now), true),
      ];
    }
    case 'proximas': {
      const days = [...new Set(pending.filter((i) => i.dueDate !== null && i.dueDate > today).map((i) => i.dueDate!))].sort();
      return days.map((d) => group(d, d === addDays(today, 1) ? 'Mañana' : formatDate(d), sortDay(pending.filter((i) => i.dueDate === d)), true));
    }
    case 'sin-fecha':
      return [group('sin-fecha', 'Sin fecha', sortDay(pending.filter((i) => i.dueDate === null)), true)];
    case 'materia': {
      const its = byDate(pending.filter((i) => (!materiaFilter || (materiaFilter === 'none' ? i.materiaId === null : i.materiaId === materiaFilter))));
      return [group('materia', 'Por materia', its, false)];
    }
    case 'completadas':
      return [group('completadas', 'Completadas', items.filter((i) => i.completed).sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '')), false)];
  }
}

export const groupMinutes = (items: TodoItem[]) => ({
  minutes: items.reduce((a, i) => a + (i.durationMin ?? 0), 0),
  unestimated: items.filter((i) => i.durationMin === null).length,
});

const LATE_MAX = 5;
/** Datos de la tarjeta Hoy: vencidas (las 5 más viejas + cuántas sobran) y todas las de hoy. */
export function hoyCardData(items: TodoItem[], today: string) {
  const [late, now] = groupTodos(items, 'hoy', today);
  const all = late?.key === 'vencidas' ? late.items : [];
  return { late: all.slice(0, LATE_MAX), lateMore: Math.max(0, all.length - LATE_MAX), today: (late?.key === 'vencidas' ? now : late)?.items ?? [] };
}

/** Query a conservar al abrir/cerrar la edición (vista y filtro); `fecha` es solo del prefill de /todo/nueva. */
export const keepSearch = (search: string): string => {
  const p = new URLSearchParams(search);
  p.delete('fecha'); p.delete('volver');
  const s = p.toString();
  return s ? `?${s}` : '';
};
