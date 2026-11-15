import { randomUUID } from 'node:crypto';
import { contains } from '../../../core/shared/normalize.ts';
import { isValidDate, isValidTime } from '../../../core/shared/dates.ts';
import { isValidReminder } from '../../../core/shared/reminder.ts';
import { httpError } from '../../../core/server/errors.ts';
import type { CoreContext } from '../../../core/server/registry.ts';
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

type Row = {
  id: string; title: string; notes: string | null; kind: EventKind; materia_id: string | null;
  all_day: number; start_date: string; start_time: string | null; end_date: string; end_time: string | null;
  repeat_weekdays: string | null; repeat_until: string | null; series_id: string | null;
  original_date: string | null; created_at: string; updated_at: string;
  reminder_min: number | null; reminder_insistent: number;
};
const toEvent = (r: Row): CalendarEvent => ({
  id: r.id, title: r.title, notes: r.notes, kind: r.kind, materiaId: r.materia_id, allDay: r.all_day === 1,
  startDate: r.start_date, startTime: r.start_time, endDate: r.end_date, endTime: r.end_time,
  repeatWeekdays: r.repeat_weekdays === null ? null : r.repeat_weekdays.split(',').map(Number),
  repeatUntil: r.repeat_until, seriesId: r.series_id, originalDate: r.original_date,
  createdAt: r.created_at, updatedAt: r.updated_at,
  reminderMin: r.reminder_min, reminderInsistent: r.reminder_insistent === 1,
});
const marks = (n: number) => Array(n).fill('?').join(',');
const ORDER = 'ORDER BY start_date, start_time, created_at';

export function makeCalendar(ctx: CoreContext): CalendarService {
  const { db } = ctx;
  const all = (sql: string, ...args: string[]) => (db.prepare(sql).all(...args) as Row[]).map(toEvent);
  const byId = (id: string) => all('SELECT * FROM calendar_events WHERE id = ?', id)[0];

  const detached = (seriesId: string, date: string) =>
    all('SELECT * FROM calendar_events WHERE series_id = ? AND original_date = ?', seriesId, date)[0];
  const checkOccurrence = (seriesId: string, date: string) => {
    const s = byId(seriesId);
    if (!s) throw httpError(404, 'no_encontrado', 'El evento no existe.');
    if (s.repeatWeekdays === null) throw httpError(400, 'no_es_serie', 'El evento no se repite.');
    if (!isValidDate(date) || !seriesDates(s, date, date).length) throw httpError(400, 'fecha_fuera_de_serie', 'Esa fecha no es parte de la serie.');
  };

  const svc: CalendarService = {
    create(i) {
      if (i.id) { const ex = byId(i.id); if (ex) return ex; }
      const msg = validateEvent(i);
      if (msg) throw httpError(400, 'validacion', msg);
      const materiaId = i.materiaId ?? null;
      if (materiaId !== null && !ctx.materias.get(materiaId)) throw httpError(400, 'materia_inexistente', 'La materia no existe.');
      const id = i.id ?? randomUUID();
      const now = new Date().toISOString();
      db.prepare(`INSERT INTO calendar_events (id, title, notes, kind, materia_id, all_day, start_date, start_time,
        end_date, end_time, repeat_weekdays, repeat_until, created_at, updated_at, reminder_min, reminder_insistent)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(id, i.title.trim(), i.notes ?? null, i.kind, materiaId, i.allDay ? 1 : 0, i.startDate, i.startTime ?? null,
          i.endDate ?? i.startDate, i.endTime ?? null, i.repeatWeekdays?.join(',') ?? null, i.repeatUntil ?? null, now, now,
          i.reminderMin ?? null, i.reminderInsistent ? 1 : 0);
      return byId(id)!;
    },
    // El que llama lo envuelve en ctx.transaction para que sea todo o nada (igual que todo).
    createMany: (items) => items.map((i) => svc.create(i)),
    getOne: byId,
    update(id, patch) {
      const ex = byId(id);
      if (!ex) throw httpError(404, 'no_encontrado', 'El evento no existe.');
      const m: EventInput = { ...ex, ...patch };
      // Una serie es de un solo día: si mueve el inicio, el fin lo acompaña.
      if (m.repeatWeekdays != null && patch.endDate === undefined) m.endDate = m.startDate;
      const msg = validateEvent(m);
      if (msg) throw httpError(400, 'validacion', msg);
      const materiaId = m.materiaId ?? null;
      if (materiaId !== null && !ctx.materias.get(materiaId)) throw httpError(400, 'materia_inexistente', 'La materia no existe.');
      db.prepare(`UPDATE calendar_events SET title=?, notes=?, kind=?, materia_id=?, all_day=?, start_date=?, start_time=?,
        end_date=?, end_time=?, repeat_weekdays=?, repeat_until=?, updated_at=?, reminder_min=?, reminder_insistent=? WHERE id=?`)
        .run(m.title.trim(), m.notes ?? null, m.kind, materiaId, m.allDay ? 1 : 0, m.startDate, m.startTime ?? null,
          m.endDate ?? m.startDate, m.endTime ?? null, m.repeatWeekdays?.join(',') ?? null, m.repeatUntil ?? null,
          new Date().toISOString(), m.reminderMin ?? null, m.reminderInsistent ? 1 : 0, id);
      return byId(id)!;
    },
    // shortcut: en memoria para ignorar tildes; ver el de todo.
    search: (q) => all("SELECT * FROM calendar_events ORDER BY ABS(julianday(start_date) - julianday('now'))").filter((e) => contains(q, e.title, e.notes)).slice(0, 20),
    remove(id) {
      if (!byId(id)) throw httpError(404, 'no_encontrado', 'El evento no existe.');
      db.prepare('DELETE FROM calendar_events WHERE id = ?').run(id); // el cascade borra separados y exdates
    },
    listRange(from, to) {
      const events = all(`SELECT * FROM calendar_events WHERE start_date <= ? AND (end_date >= ? OR repeat_weekdays IS NOT NULL) ${ORDER}`, to, from);
      // shortcut: carga todos los exdates, alcanza para un usuario; filtrar por event_id si crece.
      const exdates = new Map<string, Set<string>>();
      for (const r of db.prepare('SELECT event_id, date FROM calendar_exdates').all() as { event_id: string; date: string }[]) {
        (exdates.get(r.event_id) ?? exdates.set(r.event_id, new Set()).get(r.event_id)!).add(r.date);
      }
      return expandEvents(events, exdates, from, to);
    },
    detachOccurrence(seriesId, date, input) {
      checkOccurrence(seriesId, date);
      return ctx.transaction(() => {
        // PUT reemplaza completo: lo omitido queda en null, no hereda del separado previo.
        const solo = { notes: null, startTime: null, endTime: null, materiaId: null, ...input, endDate: input.endDate ?? input.startDate, repeatWeekdays: null, repeatUntil: null };
        const prev = detached(seriesId, date);
        db.prepare('INSERT OR IGNORE INTO calendar_exdates (event_id, date) VALUES (?, ?)').run(seriesId, date);
        if (prev) return svc.update(prev.id, solo);
        const e = svc.create({ ...solo, id: undefined });
        db.prepare('UPDATE calendar_events SET series_id = ?, original_date = ? WHERE id = ?').run(seriesId, date, e.id);
        return byId(e.id)!;
      });
    },
    deleteOccurrence(seriesId, date) {
      checkOccurrence(seriesId, date);
      ctx.transaction(() => {
        db.prepare('INSERT OR IGNORE INTO calendar_exdates (event_id, date) VALUES (?, ?)').run(seriesId, date);
        db.prepare('DELETE FROM calendar_events WHERE series_id = ? AND original_date = ?').run(seriesId, date);
      });
    },
    getByIds: (ids) => ids.length ? all(`SELECT * FROM calendar_events WHERE id IN (${marks(ids.length)}) ${ORDER}`, ...ids) : [],
    findByDates: (dates) => dates.length
      ? all(`SELECT * FROM calendar_events WHERE repeat_weekdays IS NULL AND start_date IN (${marks(dates.length)}) ${ORDER}`, ...dates)
      : [],
    deleteByIds(ids, o) {
      if (!ids.length) return 0;
      const ex = o?.exceptKinds ?? [];
      const extra = ex.length ? ` AND kind NOT IN (${marks(ex.length)})` : '';
      return Number(db.prepare(`DELETE FROM calendar_events WHERE id IN (${marks(ids.length)})${extra}`).run(...ids, ...ex).changes);
    },
  };
  return svc;
}
