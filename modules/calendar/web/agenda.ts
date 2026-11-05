import { api, ApiError } from '../../../core/web/api.ts';
import { readCopy } from '../../../core/web/offline.ts';
import { addDays } from '../../../core/shared/dates.ts';
import type { AgendaData } from './summary.ts';

export const WIDE_FROM = -42;
export const WIDE_TO = 120;
const KEY = 'sw.calendar.wide';

export const wideAgendaUrl = (today: string): string =>
  `/api/calendar/agenda?from=${addDays(today, WIDE_FROM)}&to=${addDays(today, WIDE_TO)}`;

export const sliceAgenda = (data: AgendaData, from: string, to: string): AgendaData => ({
  events: data.events.filter((e) => e.startDate <= to && e.endDate >= from),
  todos: data.todos.filter((t) => t.dueDate !== null && t.dueDate >= from && t.dueDate <= to),
});

/** Para `prefetch`: devuelve la URL ancha y la recuerda para usarla sin conexión. */
export function rememberWide(today: string): string {
  const url = wideAgendaUrl(today);
  localStorage.setItem(KEY, url);
  return url;
}

export async function loadAgenda(from: string, to: string): Promise<AgendaData> {
  try {
    return await api<AgendaData>('GET', `/api/calendar/agenda?from=${from}&to=${to}`);
  } catch (e) {
    if (!(e instanceof ApiError) || e.code !== 'sin_conexion') throw e;
    const url = localStorage.getItem(KEY);
    const copy = url ? readCopy<AgendaData>(url) : undefined;
    if (!copy) throw e;
    return sliceAgenda(copy.data, from, to);
  }
}
