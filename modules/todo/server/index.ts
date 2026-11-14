import type { ServerModule } from '../../../core/server/registry.ts';
import { httpError } from '../../../core/server/errors.ts';
import { makeTodo } from './service.ts';
import type { TodoInput, TodoPatch, TodoService } from './service.ts';

const nullableStr = { type: ['string', 'null'] };
const fields = {
  title: { type: 'string' }, notes: nullableStr, dueDate: nullableStr, dueTime: nullableStr,
  materiaId: nullableStr, sortOrder: { type: 'number' },
  durationMin: {}, // schema vacío: Ajv no tipa ni coerciona; el service valida entero 1–1440
  category: { type: 'string' },
  reminderMin: {}, reminderInsistent: { type: 'boolean' }, // reminderMin lo valida el service, igual que durationMin
  subtasks: { type: 'array', items: { type: 'object' } }, // el service valida cantidad y títulos
};

export const todo: ServerModule = {
  id: 'todo',
  migrationsDir: new URL('./migrations/', import.meta.url),
  service: (ctx) => makeTodo(ctx),
  async routes(app, ctx) {
    const svc = ctx.services.get<TodoService>('todo')!;
    const idOf = (req: { params: unknown }) => (req.params as { id: string }).id;
    app.get('/', async () => svc.list());
    app.get('/:id', async (req) => {
      const t = svc.get(idOf(req));
      if (!t) throw httpError(404, 'no_encontrado', 'La tarea no existe.');
      return t;
    });
    app.post('/', {
      schema: { body: { type: 'object', required: ['title'], properties: { id: { type: 'string', minLength: 1 }, ...fields } } },
    }, async (req, reply) => reply.status(201).send(svc.create(req.body as TodoInput)));
    app.patch('/:id', {
      schema: { body: { type: 'object', properties: { ...fields, completed: { type: 'boolean' } } } },
    }, async (req) => svc.update(idOf(req), req.body as TodoPatch));
    app.delete('/:id', async (req, reply) => { svc.remove(idOf(req)); return reply.status(204).send(); });
  },
};
