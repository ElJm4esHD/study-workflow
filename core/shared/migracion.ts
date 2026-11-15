import { nameKey } from './normalize.ts';
import { PALETTE, strongOf } from './palette.ts';
import { makeSigla } from './sigla.ts';
import { fmtHlc, type Rec } from './sync.ts';

/**
 * Conversor del backup v1 (tablas SQL de la 1.x) a registros de sincronización (2.0) y la vuelta.
 * Lo usa scripts/migrar-local-first.mjs; la vuelta (`aV1`) es el plan de vuelta atrás y la prueba de que no se pierde nada.
 */
export type Row = Record<string, unknown>;
export type BackupV1 = { format: 'study-workflow-backup'; version: 1; exportedAt: string; tables: Record<string, Row[]> };
type Doc = Record<string, unknown> & { id: string };

const s = (v: unknown) => (v === null || v === undefined ? null : String(v));
const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const nearest = (hex: string) => {
  const a = rgb(hex);
  const dist = (p: { hex: string }) => rgb(p.hex).reduce((t, v, i) => t + (v - a[i]!) ** 2, 0);
  return PALETTE.reduce((best, p) => (dist(p) < dist(best) ? p : best)).hex;
};

export function esBackupV1(b: unknown): b is BackupV1 {
  const x = b as BackupV1 | null;
  return !!x && x.format === 'study-workflow-backup' && x.version === 1 && typeof x.tables === 'object' && x.tables !== null;
}

/** Registros de la 2.0 a partir de un backup v1. El HLC sale de `updated_at`/`created_at` (nodo `migr`): lo que se edite después siempre gana. */
export function aV2(b: BackupV1): Rec[] {
  const t = (name: string) => b.tables[name] ?? [];
  const exportMs = Date.parse(b.exportedAt) || Date.now();
  const hlcOf = (r: Row) => fmtHlc(Date.parse(String(r.updated_at ?? r.created_at ?? '')) || exportMs, 0, 'migr');
  const out: Rec[] = [];
  const add = (col: string, d: Doc, r: Row) => out.push({ t: col, id: d.id, data: d, hlc: hlcOf(r) });

  for (const r of t('materias')) {
    const color = PALETTE.some((p) => p.hex === r.color) ? String(r.color) : nearest(String(r.color));
    add('materias', {
      id: String(r.id), name: String(r.name), color, colorStrong: strongOf(color), sigla: s(r.sigla) || makeSigla(String(r.name)),
      archived: n(r.archived) === 1, createdAt: String(r.created_at), updatedAt: String(r.updated_at),
    }, r);
  }
  for (const r of t('settings')) add('settings', { id: String(r.key), value: JSON.parse(String(r.value)) }, r);
  for (const r of t('todo_items')) {
    add('todo_items', {
      id: String(r.id), title: String(r.title), notes: s(r.notes), dueDate: s(r.due_date), dueTime: s(r.due_time), materiaId: s(r.materia_id),
      completed: n(r.completed) === 1, completedAt: s(r.completed_at), sortOrder: Number(r.sort_order), createdAt: String(r.created_at),
      updatedAt: String(r.updated_at), durationMin: n(r.duration_min), category: String(r.category ?? 'tarea'),
      subtasks: JSON.parse(String(r.subtasks ?? '[]')), reminderMin: n(r.reminder_min), reminderInsistent: n(r.reminder_insistent) === 1,
    }, r);
  }
  const ex = new Map<string, string[]>();
  for (const r of t('calendar_exdates')) (ex.get(String(r.event_id)) ?? ex.set(String(r.event_id), []).get(String(r.event_id))!).push(String(r.date));
  for (const r of t('calendar_events')) {
    add('calendar_events', {
      id: String(r.id), title: String(r.title), notes: s(r.notes), kind: String(r.kind), materiaId: s(r.materia_id), allDay: n(r.all_day) === 1,
      startDate: String(r.start_date), startTime: s(r.start_time), endDate: String(r.end_date), endTime: s(r.end_time),
      repeatWeekdays: r.repeat_weekdays === null || r.repeat_weekdays === undefined ? null : String(r.repeat_weekdays).split(',').map(Number),
      repeatUntil: s(r.repeat_until), seriesId: s(r.series_id), originalDate: s(r.original_date), createdAt: String(r.created_at), updatedAt: String(r.updated_at),
      reminderMin: n(r.reminder_min), reminderInsistent: n(r.reminder_insistent) === 1, exdates: ex.get(String(r.id)) ?? [],
    }, r);
  }
  for (const r of t('finals_dates')) add('finals_dates', { id: String(r.id), materiaId: String(r.materia_id), date: String(r.date), time: s(r.time) }, r);
  for (const r of t('finals_chosen')) add('finals_chosen', { id: String(r.materia_id), materiaId: String(r.materia_id), eventId: String(r.event_id) }, r);
  const items = new Map<string, { type: string; id: string }[]>();
  for (const r of t('import_plan_items')) (items.get(String(r.plan_id)) ?? items.set(String(r.plan_id), []).get(String(r.plan_id))!).push({ type: String(r.item_type), id: String(r.item_id) });
  for (const r of t('import_plans')) add('import_plans', { id: String(r.id), title: s(r.title), createdAt: String(r.created_at), items: items.get(String(r.id)) ?? [] }, r);
  return out;
}

/** La vuelta: registros (o un backup v2) a las tablas del backup v1, para restaurar en la 1.1.x con POST /api/backup. */
export function aV1(input: Pick<Rec, 't' | 'id' | 'data'>[], exportedAt = new Date().toISOString()): BackupV1 {
  const docs = (col: string) => input.filter((r) => r.t === col && r.data !== null).map((r) => r.data as Doc);
  const tables: Record<string, Row[]> = {};
  tables.materias = docs('materias').map((d) => ({
    id: d.id, name: d.name, name_key: nameKey(String(d.name)), color: d.color, archived: d.archived ? 1 : 0, created_at: d.createdAt, updated_at: d.updatedAt, sigla: d.sigla,
  }));
  tables.settings = docs('settings').map((d) => ({ key: d.id, value: JSON.stringify(d.value) }));
  tables.todo_items = docs('todo_items').map((d) => ({
    id: d.id, title: d.title, notes: d.notes, due_date: d.dueDate, due_time: d.dueTime, materia_id: d.materiaId, completed: d.completed ? 1 : 0,
    completed_at: d.completedAt, sort_order: d.sortOrder, created_at: d.createdAt, updated_at: d.updatedAt, duration_min: d.durationMin,
    category: d.category, subtasks: JSON.stringify(d.subtasks ?? []), reminder_min: d.reminderMin, reminder_insistent: d.reminderInsistent ? 1 : 0,
  }));
  const events = docs('calendar_events');
  tables.calendar_events = events.map((d) => ({
    id: d.id, title: d.title, notes: d.notes, kind: d.kind, materia_id: d.materiaId, all_day: d.allDay ? 1 : 0, start_date: d.startDate, start_time: d.startTime,
    end_date: d.endDate, end_time: d.endTime, repeat_weekdays: d.repeatWeekdays ? (d.repeatWeekdays as number[]).join(',') : null, repeat_until: d.repeatUntil,
    series_id: d.seriesId, original_date: d.originalDate, created_at: d.createdAt, updated_at: d.updatedAt, reminder_min: d.reminderMin, reminder_insistent: d.reminderInsistent ? 1 : 0,
  }));
  tables.calendar_exdates = events.flatMap((d) => ((d.exdates as string[]) ?? []).map((date) => ({ event_id: d.id, date })));
  tables.finals_dates = docs('finals_dates').map((d) => ({ id: d.id, materia_id: d.materiaId, date: d.date, time: d.time }));
  tables.finals_chosen = docs('finals_chosen').map((d) => ({ materia_id: d.materiaId, event_id: d.eventId }));
  const plans = docs('import_plans');
  tables.import_plans = plans.map((d) => ({ id: d.id, title: d.title, created_at: d.createdAt }));
  tables.import_plan_items = plans.flatMap((d) => ((d.items as { type: string; id: string }[]) ?? []).map((i) => ({ plan_id: d.id, item_type: i.type, item_id: i.id })));
  return { format: 'study-workflow-backup', version: 1, exportedAt, tables };
}

export type Linea = { nombre: string; antes: number; despues: number; ok: boolean };

/** Cantidades antes (tablas v1) y después (registros v2), más la ida y vuelta fila por fila. */
export function informe(b: BackupV1, recs: Rec[]): { lineas: Linea[]; idaYVuelta: string[]; ok: boolean } {
  const t = (name: string) => b.tables[name] ?? [];
  const docs = (col: string) => recs.filter((r) => r.t === col && r.data !== null).map((r) => r.data as Doc);
  const sub = (v: unknown) => (JSON.parse(String(v ?? '[]')) as unknown[]).length;
  const sum = (xs: number[]) => xs.reduce((a, x) => a + x, 0);
  const linea = (nombre: string, antes: number, despues: number): Linea => ({ nombre, antes, despues, ok: antes === despues });
  const lineas = [
    linea('materias', t('materias').length, docs('materias').length),
    linea('tareas', t('todo_items').length, docs('todo_items').length),
    linea('tareas completadas', t('todo_items').filter((r) => n(r.completed) === 1).length, docs('todo_items').filter((d) => d.completed).length),
    linea('subtareas', sum(t('todo_items').map((r) => sub(r.subtasks))), sum(docs('todo_items').map((d) => (d.subtasks as unknown[]).length))),
    linea('eventos', t('calendar_events').length, docs('calendar_events').length),
    linea('eventos que se repiten', t('calendar_events').filter((r) => r.repeat_weekdays != null).length, docs('calendar_events').filter((d) => d.repeatWeekdays !== null).length),
    linea('excepciones de series', t('calendar_exdates').length, sum(docs('calendar_events').map((d) => (d.exdates as unknown[]).length))),
    linea('planes importados', t('import_plans').length, docs('import_plans').length),
    linea('ítems de planes', t('import_plan_items').length, sum(docs('import_plans').map((d) => (d.items as unknown[]).length))),
    linea('fechas de finales', t('finals_dates').length, docs('finals_dates').length),
    linea('finales elegidos', t('finals_chosen').length, docs('finals_chosen').length),
    linea('ajustes', t('settings').length, docs('settings').length),
    linea('recordatorios de tareas', t('todo_items').filter((r) => r.reminder_min != null).length, docs('todo_items').filter((d) => d.reminderMin !== null).length),
    linea('recordatorios de eventos', t('calendar_events').filter((r) => r.reminder_min != null).length, docs('calendar_events').filter((d) => d.reminderMin !== null).length),
  ];
  // Ida y vuelta: v1 → v2 → v1 tiene que dar las mismas filas (las materias fuera de paleta o sin sigla se arreglan a propósito y se avisan).
  const back = aV1(recs, b.exportedAt).tables;
  const norm = (table: string, rows: Row[]) => rows.map((r) => JSON.stringify(Object.fromEntries(Object.entries(r).sort().map(([k, v]) => [k, k === 'subtasks' && typeof v === 'string' ? JSON.parse(v) : v ?? null])))).sort();
  const idaYVuelta: string[] = [];
  for (const table of Object.keys(back)) {
    const a = norm(table, t(table));
    const c = norm(table, back[table]!);
    if (JSON.stringify(a) !== JSON.stringify(c)) idaYVuelta.push(`${table}: ${a.length} filas antes, ${c.length} después y no son idénticas`);
  }
  return { lineas, idaYVuelta, ok: lineas.every((l) => l.ok) && idaYVuelta.length === 0 };
}
