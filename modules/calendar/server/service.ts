import { randomUUID } from 'node:crypto';
import { isValidDate, isValidTime } from '../../../core/shared/dates.ts';
import { httpError } from '../../../core/server/errors.ts';
import type { CoreContext } from '../../../core/server/registry.ts';
import type { EventKind } from '../shared.ts';

export type CalendarEvent = {
  id: string; title: string; notes: string | null; kind: EventKind; materiaId: string | null;
  allDay: boolean; startDate: string; startTime: string | null; endDate: string; endTime: string | null;
  repeatWeekdays: number[] | null; repeatUntil: string | null; seriesId: string | null;
  originalDate: string | null; createdAt: string; updatedAt: string;
};
export type EventInput = {
  id?: string; title: string; notes?: string | null; kind: EventKind; materiaId?: string | null;
  allDay: boolean; startDate: string; startTime?: string | null; endDate?: string | null;
  endTime?: string | null; repeatWeekdays?: number[] | null; repeatUntil?: string | null;
};

export interface CalendarService {
  create(i: EventInput): CalendarEvent;
  createMany(i: EventInput[]): CalendarEvent[];
  getByIds(ids: string[]): CalendarEvent[];
  findByDates(dates: string[]): CalendarEvent[];
  deleteByIds(ids: string[], o?: { exceptKinds?: EventKind[] }): number;
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
  return null;
}

type Row = {
  id: string; title: string; notes: string | null; kind: EventKind; materia_id: string | null;
  all_day: number; start_date: string; start_time: string | null; end_date: string; end_time: string | null;
  repeat_weekdays: string | null; repeat_until: string | null; series_id: string | null;
  original_date: string | null; created_at: string; updated_at: string;
};
const toEvent = (r: Row): CalendarEvent => ({
  id: r.id, title: r.title, notes: r.notes, kind: r.kind, materiaId: r.materia_id, allDay: r.all_day === 1,
  startDate: r.start_date, startTime: r.start_time, endDate: r.end_date, endTime: r.end_time,
  repeatWeekdays: r.repeat_weekdays === null ? null : r.repeat_weekdays.split(',').map(Number),
  repeatUntil: r.repeat_until, seriesId: r.series_id, originalDate: r.original_date,
  createdAt: r.created_at, updatedAt: r.updated_at,
});
const marks = (n: number) => Array(n).fill('?').join(',');
const ORDER = 'ORDER BY start_date, start_time, created_at';

export function makeCalendar(ctx: CoreContext): CalendarService {
  const { db } = ctx;
  const all = (sql: string, ...args: string[]) => (db.prepare(sql).all(...args) as Row[]).map(toEvent);
  const byId = (id: string) => all('SELECT * FROM calendar_events WHERE id = ?', id)[0];

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
        end_date, end_time, repeat_weekdays, repeat_until, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(id, i.title.trim(), i.notes ?? null, i.kind, materiaId, i.allDay ? 1 : 0, i.startDate, i.startTime ?? null,
          i.endDate ?? i.startDate, i.endTime ?? null, i.repeatWeekdays?.join(',') ?? null, i.repeatUntil ?? null, now, now);
      return byId(id)!;
    },
    // El que llama lo envuelve en ctx.transaction para que sea todo o nada (igual que todo).
    createMany: (items) => items.map((i) => svc.create(i)),
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
