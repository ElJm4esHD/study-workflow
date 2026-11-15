import { contains } from '../../../core/shared/normalize.ts';
import { isValidDate, isValidTime } from '../../../core/shared/dates.ts';
import { isValidReminder } from '../../../core/shared/reminder.ts';
import { httpError } from '../../../core/shared/errors.ts';
import type { AppContext } from '../../../core/app/registry.ts';
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
  /** Por título o notas, sin distinguir mayúsculas; las pendientes primero. */
  search(q: string): TodoItem[];
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

/** Comparador (null al final, como en SQL ascendente con NULLS LAST). */
const cmp = (a: string | number | null, b: string | number | null) => (a === b ? 0 : a === null ? 1 : b === null ? -1 : a < b ? -1 : 1);
const byOrder = (a: TodoItem, b: TodoItem) => cmp(a.sortOrder, b.sortOrder) || cmp(a.createdAt, b.createdAt);

export function makeTodo(ctx: AppContext): TodoService {
  const col = ctx.col<TodoItem>('todo_items');

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
      return { id: typeof s.id === 'string' && s.id ? s.id : crypto.randomUUID(), title, done: s.done === true };
    });
  }
  const pick = (ids: string[]) => { const s = new Set(ids); return col.all().filter((t) => s.has(t.id)).sort(byOrder); };

  const svc: TodoService = {
    list: () => col.all().sort(byOrder),
    search: (q) => col.all()
      .sort((a, b) => cmp(+a.completed, +b.completed) || cmp(a.dueDate, b.dueDate))
      .filter((t) => contains(q, t.title, t.notes)).slice(0, 20),
    get: (id) => col.get(id),
    create(i) {
      if (i.id) { const ex = col.get(i.id); if (ex) return ex; }
      const f = { title: i.title, dueDate: i.dueDate ?? null, dueTime: i.dueTime ?? null, materiaId: i.materiaId ?? null, durationMin: i.durationMin ?? null, category: i.category ?? 'tarea', reminderMin: i.reminderMin ?? null };
      const title = check(f);
      const st = subs(i.subtasks ?? []);
      const max = col.all().reduce((m, t) => Math.max(m, t.sortOrder), 0);
      const now = new Date().toISOString();
      const doc: TodoItem = {
        id: i.id ?? crypto.randomUUID(), title, notes: i.notes ?? null, dueDate: f.dueDate, dueTime: f.dueTime, materiaId: f.materiaId,
        completed: false, completedAt: null, sortOrder: i.sortOrder ?? max + 1, createdAt: now, updatedAt: now,
        durationMin: f.durationMin as number | null, category: f.category as TodoCategory, subtasks: st,
        reminderMin: rem(f), reminderInsistent: !!i.reminderInsistent,
      };
      col.put(doc);
      return doc;
    },
    update(id, p) {
      const cur = col.get(id);
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
      // Tildar la última subtarea completa la tarea y destildar una la reabre. Solo cuenta ese cambio:
      // guardar otra edición no pisa un tilde manual de la principal. Un `completed` explícito manda.
      const allDone = (x: Subtask[]) => x.length > 0 && x.every((s) => s.done);
      const completed = p.completed ?? (allDone(st) !== allDone(cur.subtasks) ? allDone(st) : cur.completed);
      const doc: TodoItem = {
        ...cur, title, notes: p.notes === undefined ? cur.notes : p.notes, dueDate: f.dueDate, dueTime: f.dueTime, materiaId: f.materiaId,
        completed, completedAt: !completed ? null : cur.completed ? cur.completedAt : now, sortOrder: p.sortOrder ?? cur.sortOrder, updatedAt: now,
        durationMin: f.durationMin as number | null, category: f.category as TodoCategory, subtasks: st,
        reminderMin: rem(f), reminderInsistent: p.reminderInsistent ?? cur.reminderInsistent,
      };
      col.put(doc);
      return doc;
    },
    remove(id) {
      if (!col.get(id)) throw httpError(404, 'no_encontrado', 'La tarea no existe.');
      col.remove(id);
    },
    // Todo o nada lo garantiza quien llama (ctx.transaction).
    createMany: (items) => items.map((i) => svc.create(i)),
    findByDates: (dates) => { const s = new Set(dates); return col.all().filter((t) => t.dueDate !== null && s.has(t.dueDate)).sort(byOrder); },
    listDated: (from, to) => col.all().filter((t) => t.dueDate !== null && t.dueDate >= from && t.dueDate <= to)
      .sort((a, b) => cmp(a.dueDate, b.dueDate) || cmp(a.dueTime, b.dueTime) || cmp(a.sortOrder, b.sortOrder)),
    getByIds: pick,
    deleteByIds(ids, { includeCompleted }) {
      const victims = pick(ids).filter((t) => includeCompleted || !t.completed);
      victims.forEach((t) => col.remove(t.id));
      return victims.length;
    },
  };
  return svc;
}
