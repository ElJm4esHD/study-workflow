import { addDays, weekdayOf } from '../../../core/shared/dates.ts';
import type { CalendarEvent } from './service.ts';

export type Occurrence = CalendarEvent & { eventId: string; occurrenceDate: string; isRecurring: boolean };

// Fechas de una serie dentro de [from, to] (ambas inclusive).
export function seriesDates(e: CalendarEvent, from: string, to: string, exdates: Set<string> = new Set()): string[] {
  const last = e.repeatUntil && e.repeatUntil < to ? e.repeatUntil : to;
  const out: string[] = [];
  for (let d = from > e.startDate ? from : e.startDate; d <= last; d = addDays(d, 1)) {
    if (e.repeatWeekdays!.includes(weekdayOf(d)) && !exdates.has(d)) out.push(d);
  }
  return out;
}

export function expandEvents(events: CalendarEvent[], exdates: Map<string, Set<string>>, from: string, to: string): Occurrence[] {
  const out: Occurrence[] = [];
  for (const e of events) {
    if (e.repeatWeekdays === null) {
      if (e.startDate <= to && e.endDate >= from) out.push({ ...e, eventId: e.id, occurrenceDate: e.startDate, isRecurring: false });
      continue;
    }
    for (const d of seriesDates(e, from, to, exdates.get(e.id))) {
      out.push({ ...e, id: `${e.id}:${d}`, eventId: e.id, occurrenceDate: d, isRecurring: true, startDate: d, endDate: d });
    }
  }
  return out.sort((a, b) =>
    a.startDate.localeCompare(b.startDate) || (a.startTime ?? '').localeCompare(b.startTime ?? ''));
}
