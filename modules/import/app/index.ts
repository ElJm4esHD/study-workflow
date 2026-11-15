import type { AppModule } from '../../../core/app/registry.ts';
import { created } from '../../../core/app/router.ts';
import { httpError } from '../../../core/shared/errors.ts';
import { nameKey } from '../../../core/shared/normalize.ts';
import type { CalendarService } from '../../calendar/app/service.ts';
import type { EventKind } from '../../calendar/shared.ts';
import { EXAM_KINDS } from '../../calendar/shared.ts';
import type { TodoService } from '../../todo/app/service.ts';
import { parsePlanText } from './parser.ts';
import { buildPreview } from './preview.ts';

export type PlanSummary = {
  id: string; title: string | null; createdAt: string;
  tasksDone: number; tasksTotal: number; eventsCount: number; examsCount: number;
};
type Resolution = { materiaId: string } | { create: { name: string; color: string } };
/** Un plan importado y lo que creó (antes era otra tabla). */
type PlanDoc = { id: string; title: string | null; createdAt: string; items: { type: 'todo' | 'event'; id: string }[] };

export const importModule: AppModule = {
  id: 'import',
  requires: ['todo', 'calendar'],
  collections: ['import_plans'],
  routes(r, ctx) {
    const plans = ctx.col<PlanDoc>('import_plans');
    const todo = ctx.services.get<TodoService>('todo')!;
    const cal = ctx.services.get<CalendarService>('calendar')!;
    const parse = (text: string) => {
      const p = parsePlanText(text);
      if (!p.ok) throw httpError(400, 'plan_invalido', p.error);
      return p;
    };
    const idsOf = (p: PlanDoc, type: 'todo' | 'event') => p.items.filter((l) => l.type === type).map((l) => l.id);
    // Lo que se borró a mano del calendario o del to-do ya no cuenta (las referencias colgantes se ignoran).
    const summarize = (p: PlanDoc): PlanSummary => {
      const tasks = todo.getByIds(idsOf(p, 'todo'));
      const events = cal.getByIds(idsOf(p, 'event'));
      const exams = events.filter((e) => EXAM_KINDS.includes(e.kind)).length;
      return {
        id: p.id, title: p.title, createdAt: p.createdAt,
        tasksDone: tasks.filter((t) => t.completed).length, tasksTotal: tasks.length,
        eventsCount: events.length - exams, examsCount: exams,
      };
    };
    const tooLong = (t: string) => { if (!t || t.length > 500000) throw httpError(400, 'validacion', 'Datos inválidos: text.'); };

    r.post('/preview', { text: 'string!' }, (req) => {
      const text = (req.body as { text: string }).text;
      tooLong(text);
      const parsed = parse(text);
      const dates = [...new Set(parsed.items.filter((i) => i.fecha).map((i) => i.fecha))];
      return buildPreview(parsed, { materias: ctx.materias.list(), todos: todo.findByDates(dates), events: cal.findByDates(dates) });
    });

    r.post('/commit', { text: 'string!', include: 'array!', materias: 'object!' }, (req) => {
      const body = req.body as { text: string; include: number[]; materias: Record<string, Resolution> };
      tooLong(body.text);
      const parsed = parse(body.text);
      if (!body.include.length) throw httpError(400, 'validacion', 'No hay ítems para importar.');
      const chosen = [...new Set(body.include)].sort((a, b) => a - b).map((i) => {
        const it = Number.isInteger(i) ? parsed.items[i] : undefined;
        if (!it) throw httpError(400, 'item_invalido', `El ítem ${i} no existe en el plan.`);
        if (it.errors.length) throw httpError(400, 'item_invalido', `El ítem ${i} tiene errores y no se puede importar.`);
        return it;
      });
      const summary = ctx.transaction(() => {
        const resolved = new Map<string, string>();
        const materiaIdFor = (name: string | null): string | null => {
          if (!name) return null;
          const key = nameKey(name);
          const hit = resolved.get(key) ?? ctx.materias.findByNameKey(key)?.id;
          if (hit) return hit;
          const res = body.materias[key];
          if (!res) throw httpError(400, 'materia_sin_resolver', `Falta resolver la materia "${name}".`);
          let id: string;
          if ('materiaId' in res) {
            if (!ctx.materias.get(res.materiaId)) throw httpError(400, 'materia_inexistente', `La materia elegida para "${name}" no existe.`);
            id = res.materiaId;
          } else if (res.create) {
            id = (ctx.materias.findByNameKey(nameKey(res.create.name)) ?? ctx.materias.create(res.create)).id;
          } else throw httpError(400, 'materia_sin_resolver', `Falta resolver la materia "${name}".`);
          resolved.set(key, id);
          return id;
        };
        const withMateria = chosen.map((it) => ({ it, materiaId: materiaIdFor(it.materiaName) }));
        const tasks = withMateria.filter((x) => x.it.tipo === 'tarea');
        const events = withMateria.filter((x) => x.it.tipo !== 'tarea');
        const createdTodos = todo.createMany(tasks.map(({ it, materiaId }) => ({
          title: it.titulo, notes: it.notas, dueDate: it.fecha, dueTime: it.hora, materiaId, durationMin: it.duracion, category: it.categoria,
          subtasks: it.subtareas.map((title) => ({ title })),
        })));
        const createdEvents = cal.createMany(events.map(({ it, materiaId }) => ({
          title: it.titulo, notes: it.notas, kind: it.tipo as EventKind, materiaId,
          allDay: it.hora == null, startDate: it.fecha, startTime: it.hora,
        })));
        const plan: PlanDoc = {
          id: crypto.randomUUID(), title: parsed.plan.title, createdAt: new Date().toISOString(),
          items: [...createdTodos.map((t) => ({ type: 'todo' as const, id: t.id })), ...createdEvents.map((e) => ({ type: 'event' as const, id: e.id }))],
        };
        plans.put(plan);
        return summarize(plan);
      });
      return created(summary);
    });

    // Los más nuevos primero; a igual fecha, el último creado.
    r.get('/plans', () => plans.all().reverse().sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0)).map(summarize));

    r.delete('/plans/:id', (req) => {
      const id = req.params.id!;
      const includeCompleted = req.query.includeCompleted === 'true';
      const keepExams = req.query.keepExams !== 'false';
      const plan = plans.get(id);
      if (!plan) throw httpError(404, 'no_encontrado', 'El plan no existe.');
      return ctx.transaction(() => {
        const deletedTodos = todo.deleteByIds(idsOf(plan, 'todo'), { includeCompleted });
        const deletedEvents = cal.deleteByIds(idsOf(plan, 'event'), keepExams ? { exceptKinds: EXAM_KINDS } : undefined);
        plans.remove(id);
        return { deletedTodos, deletedEvents };
      });
    });
  },
};
