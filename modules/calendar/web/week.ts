import { addDays } from '../../../core/shared/dates.ts';
import type { TodoItem } from '../../todo/app/service.ts';
import type { Occurrence } from '../app/recurrence.ts';
import type { AgendaData } from './summary.ts';

/** Lógica pura de la vista Semana: qué va en la fila "Todo el día", qué va en la grilla y en qué carril. */
export type Timed = { key: string; from: number; to: number; occ?: Occurrence; todo?: TodoItem; lane: number; lanes: number };
export type DayItems = { allDay: { key: string; occ?: Occurrence; todo?: TodoItem }[]; timed: Timed[] };

export const minutes = (t: string) => +t.slice(0, 2) * 60 + +t.slice(3, 5);
const DAY = 24 * 60;
const MIN_TASK = 30; // una tarea sin duración ocupa media hora

/** Reparte los que se pisan en carriles: cada grupo que se superpone usa el ancho dividido por su cantidad de carriles. */
export function lanes<T extends { from: number; to: number }>(items: T[]): (T & { lane: number; lanes: number })[] {
  const sorted = [...items].sort((a, b) => a.from - b.from || b.to - a.to);
  const out: (T & { lane: number; lanes: number })[] = [];
  let group: (T & { lane: number; lanes: number })[] = [], ends: number[] = [], groupEnd = -1;
  const close = () => { for (const g of group) g.lanes = ends.length; group = []; ends = []; };
  for (const it of sorted) {
    if (it.from >= groupEnd) close();
    let lane = ends.findIndex((e) => e <= it.from);
    if (lane < 0) { lane = ends.length; ends.push(it.to); } else ends[lane] = it.to;
    const x = { ...it, lane, lanes: 1 };
    group.push(x); out.push(x);
    groupEnd = Math.max(groupEnd, it.to);
  }
  close();
  return out;
}

export function dayItems(data: AgendaData, d: string): DayItems {
  const allDay: DayItems['allDay'] = [];
  const timed: Omit<Timed, 'lane' | 'lanes'>[] = [];
  for (const o of data.events) {
    if (o.startDate > d || o.endDate < d) continue;
    if (o.allDay || !o.startTime) { allDay.push({ key: o.id, occ: o }); continue; }
    const from = o.startDate === d ? minutes(o.startTime) : 0;
    const end = o.endTime ? minutes(o.endTime) : minutes(o.startTime) + 60;
    const to = o.endDate === d ? (o.endDate === o.startDate && end <= from ? from + 60 : end) : DAY;
    timed.push({ key: `${o.id}:${d}`, from, to: Math.min(DAY, Math.max(to, from + 15)), occ: o });
  }
  for (const t of data.todos) {
    if (t.dueDate !== d) continue;
    if (!t.dueTime) { allDay.push({ key: `todo:${t.id}`, todo: t }); continue; }
    const from = minutes(t.dueTime);
    timed.push({ key: `todo:${t.id}`, from, to: Math.min(DAY, from + Math.max(MIN_TASK, t.durationMin ?? 0)), todo: t });
  }
  // Exámenes primero, después eventos y al final tareas pendientes antes que hechas.
  const rank = (x: { occ?: Occurrence; todo?: TodoItem }) => (x.occ ? (x.occ.kind === 'evento' ? 1 : 0) : x.todo!.completed ? 3 : 2);
  allDay.sort((a, b) => rank(a) - rank(b));
  return { allDay, timed: lanes(timed) };
}

/** Horas que muestra la grilla: de 7 a 23, estirado si algo de la semana empieza antes o termina después. */
export function hourRange(days: DayItems[]): [number, number] {
  let h0 = 7, h1 = 23;
  for (const d of days) for (const t of d.timed) { h0 = Math.min(h0, Math.floor(t.from / 60)); h1 = Math.max(h1, Math.ceil(t.to / 60)); }
  return [h0, Math.min(24, h1)];
}

/** Primer día visible: en la compu el lunes de esa semana; en el celu el día pedido (se ven 3). */
export const windowStart = (date: string, weekday: number, wide: boolean) => (wide ? addDays(date, 1 - weekday) : date);
