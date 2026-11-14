import { randomUUID } from 'node:crypto';
import { isValidDate, isValidTime } from '../../../core/shared/dates.ts';
import { isValidReminder } from '../../../core/shared/reminder.ts';
import { httpError } from '../../../core/server/errors.ts';
import type { CoreContext } from '../../../core/server/registry.ts';
import { TODO_CATEGORIES } from '../shared.ts';
import type { TodoCategory } from '../shared.ts';

export type Subtask = { id: string; title: string; done: boolean };
export type TodoItem = {
  id: string; title: string; notes: string | null; dueDate: string | null; dueTime: string | null;
  materiaId: string | null; completed: boolean; completedAt: string | null; sortOrder: number;
  createdAt: string; updatedAt: string; durationMin: number | null; category: TodoCategory; subtasks: Subtask[];
  reminderMin: number | null; reminderInsistent: boolean;
};
export type TodoInput = {
  id?: string; title: string; notes?: string | null; dueDate?: string | null; dueTime?: string | null;
  materiaId?: string | null; sortOrder?: number; durationMin?: number | null; category?: TodoCategory;
  subtasks?: { id?: string; title: string; done?: boolean }[];
  reminderMin?: number | null; reminderInsistent?: boolean;
};
export type TodoPatch = Partial<Omit<TodoInput, 'id'>> & { completed?: boolean };

export interface TodoService {
  list(): TodoItem[];
  get(id: string): TodoItem | undefined;
  create(i: TodoInput): TodoItem;
  update(id: string, p: TodoPatch): TodoItem;
  remove(id: string): void;
  createMany(i: TodoInput[]): TodoItem[];
  findByDates(dates: string[]): TodoItem[];
  listDated(from: string, to: string): TodoItem[];
  getByIds(ids: string[]): TodoItem[];
  deleteByIds(ids: string[], o: { includeCompleted: boolean }): number;
}

type Row = {
  id: string; title: string; notes: string | null; due_date: string | null; due_time: string | null;
  materia_id: string | null; completed: number; completed_at: string | null; sort_order: number;
  created_at: string; updated_at: string; duration_min: number | null; category: TodoCategory; subtasks: string;
  reminder_min: number | null; reminder_insistent: number;
};
const toItem = (r: Row): TodoItem => ({
  id: r.id, title: r.title, notes: r.notes, dueDate: r.due_date, dueTime: r.due_time, materiaId: r.materia_id,
  completed: r.completed === 1, completedAt: r.completed_at, sortOrder: r.sort_order,
  createdAt: r.created_at, updatedAt: r.updated_at, durationMin: r.duration_min, category: r.category,
  subtasks: JSON.parse(r.subtasks) as Subtask[], reminderMin: r.reminder_min, reminderInsistent: r.reminder_insistent === 1,
});
const marks = (n: number) => Array(n).fill('?').join(',');
const ORDER = 'ORDER BY sort_order, created_at';

export function makeTodo(ctx: CoreContext): TodoService {
  const { db } = ctx;
  const all = (sql: string, ...args: string[]) => (db.prepare(sql).all(...args) as Row[]).map(toItem);

  function check(f: { title: string; dueDate: string | null; dueTime: string | null; materiaId: string | null; durationMin: unknown; category: string; reminderMin: unknown }) {
    const title = f.title.trim();
    if (!title || title.length > 200) throw httpError(400, 'validacion', 'Datos inválidos: el título debe tener entre 1 y 200 caracteres.');
    if (f.dueDate !== null && !isValidDate(f.dueDate)) throw httpError(400, 'fecha_invalida', 'La fecha no es válida.');
    if (f.dueTime !== null && !isValidTime(f.dueTime)) throw httpError(400, 'hora_invalida', 'La hora no es válida.');
    if (f.dueTime !== null && f.dueDate === null) throw httpError(400, 'hora_sin_fecha', 'Para poner hora, primero elegí una fecha.');
    if (f.materiaId !== null && !ctx.materias.get(f.materiaId)) throw httpError(400, 'materia_inexistente', 'La materia no existe.');
    if (f.durationMin !== null && !(Number.isInteger(f.durationMin) && (f.durationMin as number) >= 1 && (f.durationMin as number) <= 1440)) {
      throw httpError(400, 'duracion_invalida', 'La duración tiene que ser un número entero de minutos entre 1 y 1440.');
    }
    if (f.reminderMin !== null && !isValidReminder(f.reminderMin)) throw httpError(400, 'recordatorio_invalido', 'El recordatorio no es válido.');
    if (!TODO_CATEGORIES.some((c) => c.id === f.category)) throw httpError(400, 'categoria_invalida', 'La categoría no es válida.');
    return title;
  }

  // Sin fecha no hay cuándo sonar: el recordatorio se descarta.
  const rem = (f: { dueDate: string | null; reminderMin: unknown }) => (f.dueDate === null ? null : (f.reminderMin as number | null));

  function subs(raw: unknown): Subtask[] {
    const bad = () => httpError(400, 'subtareas_invalidas', 'Las subtareas no son válidas: hasta 50, cada una con un título de 1 a 120 caracteres.');
    if (!Array.isArray(raw) || raw.length > 50) throw bad();
    return raw.map((s: { id?: unknown; title?: unknown; done?: unknown }) => {
      const title = typeof s?.title === 'string' ? s.title.trim() : '';
      if (!title || title.length > 120) throw bad();
      return { id: typeof s.id === 'string' && s.id ? s.id : randomUUID(), title, done: s.done === true };
    });
  }

  const svc: TodoService = {
    list: () => all(`SELECT * FROM todo_items ${ORDER}`),
    get(id) {
      const r = db.prepare('SELECT * FROM todo_items WHERE id = ?').get(id) as Row | undefined;
      return r && toItem(r);
    },
    create(i) {
      if (i.id) { const ex = svc.get(i.id); if (ex) return ex; }
      const f = { title: i.title, dueDate: i.dueDate ?? null, dueTime: i.dueTime ?? null, materiaId: i.materiaId ?? null, durationMin: i.durationMin ?? null, category: i.category ?? 'tarea', reminderMin: i.reminderMin ?? null };
      const title = check(f);
      const st = subs(i.subtasks ?? []);
      const max = (db.prepare('SELECT MAX(sort_order) AS m FROM todo_items').get() as { m: number | null }).m ?? 0;
      const id = i.id ?? randomUUID();
      const now = new Date().toISOString();
      db.prepare(`INSERT INTO todo_items (id, title, notes, due_date, due_time, materia_id, completed, sort_order, created_at, updated_at, duration_min, category, subtasks, reminder_min, reminder_insistent)
        VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, title, i.notes ?? null, f.dueDate, f.dueTime, f.materiaId, i.sortOrder ?? max + 1, now, now, f.durationMin as number | null, f.category, JSON.stringify(st),
          rem(f), i.reminderInsistent ? 1 : 0);
      return svc.get(id)!;
    },
    update(id, p) {
      const cur = svc.get(id);
      if (!cur) throw httpError(404, 'no_encontrado', 'La tarea no existe.');
      const f = {
        title: p.title ?? cur.title, dueDate: p.dueDate === undefined ? cur.dueDate : p.dueDate,
        dueTime: p.dueTime === undefined ? cur.dueTime : p.dueTime,
        materiaId: p.materiaId === undefined ? cur.materiaId : p.materiaId,
        durationMin: p.durationMin === undefined ? cur.durationMin : p.durationMin, category: p.category ?? cur.category,
        reminderMin: p.reminderMin === undefined ? cur.reminderMin : p.reminderMin,
      };
      const title = check(f);
      const now = new Date().toISOString();
      const st = p.subtasks === undefined ? cur.subtasks : subs(p.subtasks);
      // Con subtareas, tildarlas todas completa la tarea y destildar una la reabre; un `completed` explícito manda.
      const completed = p.completed ?? (p.subtasks !== undefined && st.length ? st.every((s) => s.done) : cur.completed);
      const completedAt = !completed ? null : cur.completed ? cur.completedAt : now;
      db.prepare(`UPDATE todo_items SET title = ?, notes = ?, due_date = ?, due_time = ?, materia_id = ?,
        completed = ?, completed_at = ?, sort_order = ?, updated_at = ?, duration_min = ?, category = ?, subtasks = ?,
        reminder_min = ?, reminder_insistent = ? WHERE id = ?`)
        .run(title, p.notes === undefined ? cur.notes : p.notes, f.dueDate, f.dueTime, f.materiaId,
          completed ? 1 : 0, completedAt, p.sortOrder ?? cur.sortOrder, now, f.durationMin as number | null, f.category, JSON.stringify(st),
          rem(f), (p.reminderInsistent ?? cur.reminderInsistent) ? 1 : 0, id);
      return svc.get(id)!;
    },
    remove(id) {
      if (db.prepare('DELETE FROM todo_items WHERE id = ?').run(id).changes === 0) {
        throw httpError(404, 'no_encontrado', 'La tarea no existe.');
      }
    },
    createMany: (items) => items.map((i) => svc.create(i)),
    findByDates: (dates) => dates.length ? all(`SELECT * FROM todo_items WHERE due_date IN (${marks(dates.length)}) ${ORDER}`, ...dates) : [],
    listDated: (from, to) => all('SELECT * FROM todo_items WHERE due_date BETWEEN ? AND ? ORDER BY due_date, due_time, sort_order', from, to),
    getByIds: (ids) => ids.length ? all(`SELECT * FROM todo_items WHERE id IN (${marks(ids.length)}) ${ORDER}`, ...ids) : [],
    deleteByIds(ids, { includeCompleted }) {
      if (!ids.length) return 0;
      const extra = includeCompleted ? '' : ' AND completed = 0';
      return Number(db.prepare(`DELETE FROM todo_items WHERE id IN (${marks(ids.length)})${extra}`).run(...ids).changes);
    },
  };
  return svc;
}
