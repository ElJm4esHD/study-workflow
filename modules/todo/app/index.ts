import type { AppModule } from '../../../core/app/registry.ts';
import { created, noContent } from '../../../core/app/router.ts';
import { httpError } from '../../../core/shared/errors.ts';
import { formatDate } from '../../../core/shared/dates.ts';
import { makeTodo } from './service.ts';
import type { TodoInput, TodoPatch, TodoService } from './service.ts';

const fields = {
  title: 'string', notes: 'string?', dueDate: 'string?', dueTime: 'string?', materiaId: 'string?', sortOrder: 'number',
  durationMin: 'any', category: 'string', // durationMin y reminderMin los valida el service
  reminderMin: 'any', reminderInsistent: 'boolean', subtasks: 'array', // el service valida cantidad y títulos
};

export const todo: AppModule = {
  id: 'todo',
  collections: ['todo_items'],
  service: (ctx) => makeTodo(ctx),
  search: (ctx, q) => ctx.services.get<TodoService>('todo')!.search(q).map((t) => ({
    id: t.id, kind: t.category, title: t.title, to: `/todo/${t.id}`,
    detail: [t.completed ? 'Completada' : null, t.dueDate && formatDate(t.dueDate), t.dueTime].filter(Boolean).join(' · ') || undefined,
  })),
  routes(r, ctx) {
    const svc = ctx.services.get<TodoService>('todo')!;
    r.get('/', () => svc.list());
    r.get('/:id', (req) => {
      const t = svc.get(req.params.id!);
      if (!t) throw httpError(404, 'no_encontrado', 'La tarea no existe.');
      return t;
    });
    r.post('/', { ...fields, title: 'string!', id: 'string' }, (req) => created(svc.create(req.body as TodoInput)));
    r.patch('/:id', { ...fields, completed: 'boolean' }, (req) => svc.update(req.params.id!, req.body as TodoPatch));
    r.delete('/:id', (req) => { svc.remove(req.params.id!); return noContent(); });
  },
};
