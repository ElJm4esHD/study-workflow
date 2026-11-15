import { contains } from '../../../core/shared/normalize.ts';
import { isValidDate, isValidTime } from '../../../core/shared/dates.ts';
import { isValidReminder } from '../../../core/shared/reminder.ts';
import { httpError } from '../../../core/shared/errors.ts';
import type { AppContext } from '../../../core/app/registry.ts';
import type { EventKind } from '../shared.ts';
import { expandEvents, seriesDates } from './recurrence.ts';
import type { Occurrence } from './recurrence.ts';

export type CalendarEvent = {
  id: string; title: string; notes: string | null; kind: EventKind; materiaId: string | null;
  allDay: boolean; startDate: string; startTime: string | null; endDate: string; endTime: string | null;
  repeatWeekdays: number[] | null; repeatUntil: string | null; seriesId: string | null;
  originalDate: string | null; createdAt: string; updatedAt: string;
  reminderMin: number | null; reminderInsistent: boolean;
};
export type EventInput = {
  id?: string; title: string; notes?: string | null; kind: EventKind; materiaId?: string | null;
  allDay: boolean; startDate: string; startTime?: string | null; endDate?: string | null;
  endTime?: string | null; repeatWeekdays?: number[] | null; repeatUntil?: string | null;
  reminderMin?: number | null; reminderInsistent?: boolean;
};

export interface CalendarService {
  create(i: EventInput): CalendarEvent;
  /** Por título o notas, sin distinguir mayúsculas; los más cercanos a hoy primero. */
  search(q: string): CalendarEvent[];
  createMany(i: EventInput[]): CalendarEvent[];
  getByIds(ids: string[]): CalendarEvent[];
  findByDates(dates: string[]): CalendarEvent[];
  deleteByIds(ids: string[], o?: { exceptKinds?: EventKind[] }): number;
  getOne(id: string): CalendarEvent | undefined;
  update(id: string, patch: Partial<EventInput>): CalendarEvent;
  remove(id: string): void;
  listRange(from: string, to: string): Occurrence[];
  detachOccurrence(seriesId: string, date: string, input: EventInput): CalendarEvent;
  deleteOccurrence(seriesId: string, date: string): void;
}

const KINDS = ['evento', 'parcial', 'recuperatorio', 'final'];

export function validateEvent(i: EventInput): string | null {
  const title = (i.title ?? '').trim();
  if (!title || title.length > 200) return 'El título debe tener entre 1 y 200 caracteres.';
  if (!KINDS.includes(i.kind)) return 'El tipo de evento no es válido.';
  if (!isValidDate(i.startDate)) return 'La fecha de inicio no es válida.';
  const endDate = i.endDate ?? i.startDate;
  if (!isValidDate(endDate)) return 'La fecha de fin no es válida.';
  const startTime = i.startTime ?? null, endTime = i.endTime ?? null;
  if (i.allDay && startTime !== null) return 'Un evento de todo el día no lleva hora de inicio.';
  if (!i.allDay && startTime === null) return 'Falta la hora de inicio.';
  if (startTime !== null && !isValidTime(startTime)) return 'La hora de inicio no es válida.';
  if (endTime !== null) {
    if (i.allDay) return 'Un evento de todo el día no lleva hora de fin.';
    if (!isValidTime(endTime)) return 'La hora de fin no es válida.';
  }
  if (endDate < i.startDate) return 'La fecha de fin no puede ser anterior a la de inicio.';
  if (endDate === i.startDate && endTime !== null && endTime <= startTime!) return 'La hora de fin debe ser posterior a la de inicio.';
  const wd = i.repeatWeekdays ?? null;
  if (wd !== null) {
    if (!wd.length || wd.some((d) => !Number.isInteger(d) || d < 1 || d > 7) || new Set(wd).size !== wd.length) {
      return 'Los días de repetición deben ser entre 1 y 7, sin repetir.';
    }
    if (endDate !== i.startDate) return 'Un evento que se repite debe empezar y terminar el mismo día.';
    if (i.repeatUntil != null && (!isValidDate(i.repeatUntil) || i.repeatUntil < i.startDate)) {
      return 'La fecha límite de repetición no es válida.';
    }
  }
  if (i.reminderMin != null && !isValidReminder(i.reminderMin)) return 'El recordatorio no es válido.';
  return null;
}

/** Lo que se guarda: el evento y, si es una serie, las fechas excluidas (antes era otra tabla). */
type Doc = CalendarEvent & { exdates: string[] };
const strip = ({ exdates: _x, ...e }: Doc): CalendarEvent => e;

// Nulos primero (un evento "todo el día" va antes que los con hora), como el orden ascendente de SQLite.
const cmp = (a: string | null, b: string | null) => (a === b ? 0 : a === null ? -1 : b === null ? 1 : a < b ? -1 : 1);
const byStart = (a: Doc, b: Doc) => cmp(a.startDate, b.startDate) || cmp(a.startTime, b.startTime) || cmp(a.createdAt, b.createdAt);

export function makeCalendar(ctx: AppContext): CalendarService {
  const col = ctx.col<Doc>('calendar_events');
  const docs = () => col.all();
  const view = (list: Doc[]) => list.sort(byStart).map(strip);
  const detached = (seriesId: string, date: string) => docs().find((e) => e.seriesId === seriesId && e.originalDate === date);
  const checkOccurrence = (seriesId: string, date: string): Doc => {
    const s = col.get(seriesId);
    if (!s) throw httpError(404, 'no_encontrado', 'El evento no existe.');
    if (s.repeatWeekdays === null) throw httpError(400, 'no_es_serie', 'El evento no se repite.');
    if (!isValidDate(date) || !seriesDates(s, date, date).length) throw httpError(400, 'fecha_fuera_de_serie', 'Esa fecha no es parte de la serie.');
    return s;
  };
  const checkMateria = (id: string | null) => {
    if (id !== null && !ctx.materias.get(id)) throw httpError(400, 'materia_inexistente', 'La materia no existe.');
  };

  const svc: CalendarService = {
    create(i) {
      if (i.id) { const ex = col.get(i.id); if (ex) return strip(ex); }
      const msg = validateEvent(i);
      if (msg) throw httpError(400, 'validacion', msg);
      const materiaId = i.materiaId ?? null;
      checkMateria(materiaId);
      const now = new Date().toISOString();
      const doc: Doc = {
        id: i.id ?? crypto.randomUUID(), title: i.title.trim(), notes: i.notes ?? null, kind: i.kind, materiaId, allDay: !!i.allDay,
        startDate: i.startDate, startTime: i.startTime ?? null, endDate: i.endDate ?? i.startDate, endTime: i.endTime ?? null,
        repeatWeekdays: i.repeatWeekdays ?? null, repeatUntil: i.repeatUntil ?? null, seriesId: null, originalDate: null,
        createdAt: now, updatedAt: now, reminderMin: i.reminderMin ?? null, reminderInsistent: !!i.reminderInsistent, exdates: [],
      };
      col.put(doc);
      return strip(doc);
    },
    // El que llama lo envuelve en ctx.transaction para que sea todo o nada (igual que todo).
    createMany: (items) => items.map((i) => svc.create(i)),
    getOne: (id) => { const d = col.get(id); return d && strip(d); },
    update(id, patch) {
      const ex = col.get(id);
      if (!ex) throw httpError(404, 'no_encontrado', 'El evento no existe.');
      const m: EventInput = { ...strip(ex), ...patch };
      // Una serie es de un solo día: si mueve el inicio, el fin lo acompaña.
      if (m.repeatWeekdays != null && patch.endDate === undefined) m.endDate = m.startDate;
      const msg = validateEvent(m);
      if (msg) throw httpError(400, 'validacion', msg);
      const materiaId = m.materiaId ?? null;
      checkMateria(materiaId);
      const doc: Doc = {
        ...ex, title: m.title.trim(), notes: m.notes ?? null, kind: m.kind, materiaId, allDay: !!m.allDay, startDate: m.startDate,
        startTime: m.startTime ?? null, endDate: m.endDate ?? m.startDate, endTime: m.endTime ?? null,
        repeatWeekdays: m.repeatWeekdays ?? null, repeatUntil: m.repeatUntil ?? null,
        updatedAt: new Date().toISOString(), reminderMin: m.reminderMin ?? null, reminderInsistent: !!m.reminderInsistent,
      };
      col.put(doc);
      return strip(doc);
    },
    search: (q) => {
      const now = Date.now();
      return docs().sort((a, b) => Math.abs(Date.parse(a.startDate) - now) - Math.abs(Date.parse(b.startDate) - now))
        .filter((e) => contains(q, e.title, e.notes)).slice(0, 20).map(strip);
    },
    remove(id) {
      if (!col.get(id)) throw httpError(404, 'no_encontrado', 'El evento no existe.');
      for (const e of docs()) if (e.seriesId === id) col.remove(e.id); // sin cascada: se borran a mano los separados
      col.remove(id);
    },
    listRange(from, to) {
      const events = view(docs().filter((e) => e.startDate <= to && (e.endDate >= from || e.repeatWeekdays !== null)));
      const exdates = new Map(docs().filter((e) => e.exdates.length).map((e) => [e.id, new Set(e.exdates)]));
      return expandEvents(events, exdates, from, to);
    },
    detachOccurrence(seriesId, date, input) {
      const series = checkOccurrence(seriesId, date);
      return ctx.transaction(() => {
        // PUT reemplaza completo: lo omitido queda en null, no hereda del separado previo.
        const solo = { notes: null, startTime: null, endTime: null, materiaId: null, ...input, endDate: input.endDate ?? input.startDate, repeatWeekdays: null, repeatUntil: null };
        const prev = detached(seriesId, date);
        if (!series.exdates.includes(date)) col.put({ ...series, exdates: [...series.exdates, date] });
        if (prev) return svc.update(prev.id, solo);
        const e = svc.create({ ...solo, id: undefined });
        col.put({ ...col.get(e.id)!, seriesId, originalDate: date });
        return svc.getOne(e.id)!;
      });
    },
    deleteOccurrence(seriesId, date) {
      const series = checkOccurrence(seriesId, date);
      ctx.transaction(() => {
        if (!series.exdates.includes(date)) col.put({ ...series, exdates: [...series.exdates, date] });
        for (const e of docs()) if (e.seriesId === seriesId && e.originalDate === date) col.remove(e.id);
      });
    },
    getByIds: (ids) => { const s = new Set(ids); return view(docs().filter((e) => s.has(e.id))); },
    findByDates: (dates) => { const s = new Set(dates); return view(docs().filter((e) => e.repeatWeekdays === null && s.has(e.startDate))); },
    deleteByIds(ids, o) {
      const ex = o?.exceptKinds ?? [];
      const s = new Set(ids);
      const victims = docs().filter((e) => s.has(e.id) && !ex.includes(e.kind));
      victims.forEach((e) => col.remove(e.id));
      return victims.length;
    },
  };
  return svc;
}
