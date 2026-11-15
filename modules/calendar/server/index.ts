import type { ServerModule } from '../../../core/server/registry.ts';
import { httpError } from '../../../core/server/errors.ts';
import { addDays, formatDate, isValidDate } from '../../../core/shared/dates.ts';
import type { TodoService } from '../../todo/server/service.ts';
import { makeCalendar } from './service.ts';
import type { CalendarService, EventInput } from './service.ts';

const nullableStr = { type: ['string', 'null'] };
const fields = {
  title: { type: 'string' }, notes: nullableStr, kind: { type: 'string' }, materiaId: nullableStr,
  allDay: { type: 'boolean' }, startDate: { type: 'string' }, startTime: nullableStr, endDate: nullableStr,
  endTime: nullableStr, repeatUntil: nullableStr,
  reminderMin: {}, reminderInsistent: { type: 'boolean' }, // reminderMin lo valida el service
  repeatWeekdays: { type: ['array', 'null'], items: { type: 'integer' } },
};
const full = { type: 'object', required: ['title', 'kind', 'allDay', 'startDate'], properties: fields };

export const calendar: ServerModule = {
  id: 'calendar',
  migrationsDir: new URL('./migrations/', import.meta.url),
  service: (ctx) => makeCalendar(ctx),
  search: (ctx, q) => ctx.services.get<CalendarService>('calendar')!.search(q).map((e) => ({
    id: e.id, kind: e.kind, title: e.title, to: `/calendario/evento/${e.id}`,
    detail: [formatDate(e.startDate), e.allDay ? 'Todo el día' : e.startTime, e.repeatWeekdays ? 'Se repite' : null].filter(Boolean).join(' · '),
  })),
  async routes(app, ctx) {
    const svc = ctx.services.get<CalendarService>('calendar')!;
    const params = (req: { params: unknown }) => req.params as { id: string; date: string };
    app.get('/agenda', async (req) => {
      const { from, to } = req.query as { from?: string; to?: string };
      if (!isValidDate(from) || !isValidDate(to) || to < from || to > addDays(from, 400)) {
        throw httpError(400, 'rango_invalido', 'El rango de fechas no es válido (máximo 400 días).');
      }
      const todo = ctx.modules.isEnabled('todo') ? ctx.services.get<TodoService>('todo') : undefined;
      return { events: svc.listRange(from, to), todos: todo?.listDated(from, to) ?? [] };
    });
    app.get('/events/:id', async (req) => {
      const e = svc.getOne(params(req).id);
      if (!e) throw httpError(404, 'no_encontrado', 'El evento no existe.');
      return e;
    });
    app.post('/events', {
      schema: { body: { ...full, properties: { id: { type: 'string', minLength: 1 }, ...fields } } },
    }, async (req, reply) => reply.status(201).send(svc.create(req.body as EventInput)));
    app.patch('/events/:id', {
      schema: { body: { type: 'object', properties: fields } },
    }, async (req) => svc.update(params(req).id, req.body as Partial<EventInput>));
    app.delete('/events/:id', async (req, reply) => { svc.remove(params(req).id); return reply.status(204).send(); });
    app.put('/events/:id/occurrences/:date', { schema: { body: full } }, async (req) => {
      const { id, date } = params(req);
      return svc.detachOccurrence(id, date, req.body as EventInput);
    });
    app.delete('/events/:id/occurrences/:date', async (req, reply) => {
      const { id, date } = params(req);
      svc.deleteOccurrence(id, date);
      return reply.status(204).send();
    });
  },
};
