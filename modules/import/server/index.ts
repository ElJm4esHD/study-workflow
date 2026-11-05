import { randomUUID } from 'node:crypto';
import type { ServerModule } from '../../../core/server/registry.ts';
import { httpError } from '../../../core/server/errors.ts';
import { nameKey } from '../../../core/shared/normalize.ts';
import type { CalendarService } from '../../calendar/server/service.ts';
import type { EventKind } from '../../calendar/shared.ts';
import { EXAM_KINDS } from '../../calendar/shared.ts';
import type { TodoService } from '../../todo/server/service.ts';
import { parsePlanText } from './parser.ts';
import { buildPreview } from './preview.ts';

export type PlanSummary = {
  id: string; title: string | null; createdAt: string;
  tasksDone: number; tasksTotal: number; eventsCount: number; examsCount: number;
};
type Resolution = { materiaId: string } | { create: { name: string; color: string } };
type Link = { item_type: 'todo' | 'event'; item_id: string };

export const importModule: ServerModule = {
  id: 'import',
  migrationsDir: new URL('./migrations/', import.meta.url),
  requires: ['todo', 'calendar'],
  async routes(app, ctx) {
    const todo = ctx.services.get<TodoService>('todo')!;
    const cal = ctx.services.get<CalendarService>('calendar')!;
    const parse = (text: string) => {
      const r = parsePlanText(text);
      if (!r.ok) throw httpError(400, 'plan_invalido', r.error);
      return r;
    };
    const textSchema = { type: 'string', minLength: 1, maxLength: 500000 };

    app.post('/preview', {
      schema: { body: { type: 'object', required: ['text'], properties: { text: textSchema } } },
    }, async (req) => {
      const parsed = parse((req.body as { text: string }).text);
      const dates = [...new Set(parsed.items.filter((i) => i.fecha).map((i) => i.fecha))];
      return buildPreview(parsed, { materias: ctx.materias.list(), todos: todo.findByDates(dates), events: cal.findByDates(dates) });
    });

    const links = (planId: string) =>
      ctx.db.prepare('SELECT item_type, item_id FROM import_plan_items WHERE plan_id = ?').all(planId) as Link[];
    const idsOf = (ls: Link[], type: Link['item_type']) => ls.filter((l) => l.item_type === type).map((l) => l.item_id);
    const summarize = (p: { id: string; title: string | null; created_at: string }): PlanSummary => {
      const ls = links(p.id);
      const tasks = todo.getByIds(idsOf(ls, 'todo'));
      const events = cal.getByIds(idsOf(ls, 'event'));
      const exams = events.filter((e) => EXAM_KINDS.includes(e.kind)).length;
      return {
        id: p.id, title: p.title, createdAt: p.created_at,
        tasksDone: tasks.filter((t) => t.completed).length, tasksTotal: tasks.length,
        eventsCount: events.length - exams, examsCount: exams,
      };
    };

    app.post('/commit', {
      schema: {
        body: {
          type: 'object', required: ['text', 'include', 'materias'],
          properties: {
            text: textSchema,
            include: { type: 'array', items: { type: 'integer' } },
            materias: {
              type: 'object',
              additionalProperties: {
                type: 'object',
                properties: {
                  materiaId: { type: 'string' },
                  create: { type: 'object', required: ['name', 'color'], properties: { name: { type: 'string', minLength: 1 }, color: { type: 'string' } } },
                },
              },
            },
          },
        },
      },
    }, async (req, reply) => {
      const body = req.body as { text: string; include: number[]; materias: Record<string, Resolution> };
      const parsed = parse(body.text);
      if (!body.include.length) throw httpError(400, 'validacion', 'No hay ítems para importar.');
      const chosen = [...new Set(body.include)].sort((a, b) => a - b).map((i) => {
        const it = parsed.items[i];
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
          const r = body.materias[key];
          if (!r) throw httpError(400, 'materia_sin_resolver', `Falta resolver la materia "${name}".`);
          let id: string;
          if ('materiaId' in r) {
            if (!ctx.materias.get(r.materiaId)) throw httpError(400, 'materia_inexistente', `La materia elegida para "${name}" no existe.`);
            id = r.materiaId;
          } else if (r.create) {
            id = (ctx.materias.findByNameKey(nameKey(r.create.name)) ?? ctx.materias.create(r.create)).id;
          } else throw httpError(400, 'materia_sin_resolver', `Falta resolver la materia "${name}".`);
          resolved.set(key, id);
          return id;
        };
        const withMateria = chosen.map((it) => ({ it, materiaId: materiaIdFor(it.materiaName) }));
        const tasks = withMateria.filter((x) => x.it.tipo === 'tarea');
        const events = withMateria.filter((x) => x.it.tipo !== 'tarea');
        const createdTodos = todo.createMany(tasks.map(({ it, materiaId }) => ({
          title: it.titulo, notes: it.notas, dueDate: it.fecha, dueTime: it.hora, materiaId, durationMin: it.duracion, category: it.categoria,
        })));
        const createdEvents = cal.createMany(events.map(({ it, materiaId }) => ({
          title: it.titulo, notes: it.notas, kind: it.tipo as EventKind, materiaId,
          allDay: it.hora == null, startDate: it.fecha, startTime: it.hora,
        })));
        const id = randomUUID();
        const createdAt = new Date().toISOString();
        ctx.db.prepare('INSERT INTO import_plans (id, title, created_at) VALUES (?, ?, ?)').run(id, parsed.plan.title, createdAt);
        const ins = ctx.db.prepare('INSERT INTO import_plan_items (plan_id, item_type, item_id) VALUES (?, ?, ?)');
        for (const t of createdTodos) ins.run(id, 'todo', t.id);
        for (const e of createdEvents) ins.run(id, 'event', e.id);
        return summarize({ id, title: parsed.plan.title, created_at: createdAt });
      });
      return reply.status(201).send(summary);
    });

    app.get('/plans', async () =>
      (ctx.db.prepare('SELECT id, title, created_at FROM import_plans ORDER BY created_at DESC, rowid DESC').all() as
        { id: string; title: string | null; created_at: string }[]).map(summarize));

    app.delete('/plans/:id', {
      schema: { querystring: { type: 'object', properties: { includeCompleted: { type: 'boolean', default: false }, keepExams: { type: 'boolean', default: true } } } },
    }, async (req) => {
      const { id } = req.params as { id: string };
      const q = req.query as { includeCompleted: boolean; keepExams: boolean };
      if (!ctx.db.prepare('SELECT 1 FROM import_plans WHERE id = ?').get(id)) throw httpError(404, 'no_encontrado', 'El plan no existe.');
      return ctx.transaction(() => {
        const ls = links(id);
        const deletedTodos = todo.deleteByIds(idsOf(ls, 'todo'), { includeCompleted: q.includeCompleted });
        const deletedEvents = cal.deleteByIds(idsOf(ls, 'event'), q.keepExams ? { exceptKinds: EXAM_KINDS } : undefined);
        ctx.db.prepare('DELETE FROM import_plan_items WHERE plan_id = ?').run(id);
        ctx.db.prepare('DELETE FROM import_plans WHERE id = ?').run(id);
        return { deletedTodos, deletedEvents };
      });
    });
  },
};
