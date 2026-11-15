import type { AppModule } from '../../../core/app/registry.ts';
import { created, noContent } from '../../../core/app/router.ts';
import { httpError } from '../../../core/shared/errors.ts';
import { addDays, formatDate, isValidDate } from '../../../core/shared/dates.ts';
import type { TodoService } from '../../todo/app/service.ts';
import { makeCalendar } from './service.ts';
import type { CalendarService, EventInput } from './service.ts';

const fields = {
  title: 'string', notes: 'string?', kind: 'string', materiaId: 'string?', allDay: 'boolean', startDate: 'string',
  startTime: 'string?', endDate: 'string?', endTime: 'string?', repeatUntil: 'string?',
  reminderMin: 'any', reminderInsistent: 'boolean', // reminderMin lo valida el service
  repeatWeekdays: 'array?', // el service valida que sean enteros 1–7
};
const full = { ...fields, title: 'string!', kind: 'string!', allDay: 'boolean!', startDate: 'string!' };

export const calendar: AppModule = {
  id: 'calendar',
  collections: ['calendar_events'],
  service: (ctx) => makeCalendar(ctx),
  search: (ctx, q) => ctx.services.get<CalendarService>('calendar')!.search(q).map((e) => ({
    id: e.id, kind: e.kind, title: e.title, to: `/calendario/evento/${e.id}`,
    detail: [formatDate(e.startDate), e.allDay ? 'Todo el día' : e.startTime, e.repeatWeekdays ? 'Se repite' : null].filter(Boolean).join(' · '),
  })),
  routes(r, ctx) {
    const svc = ctx.services.get<CalendarService>('calendar')!;
    r.get('/agenda', (req) => {
      const { from, to } = req.query;
      if (!isValidDate(from) || !isValidDate(to) || to < from || to > addDays(from, 400)) {
        throw httpError(400, 'rango_invalido', 'El rango de fechas no es válido (máximo 400 días).');
      }
      const todo = ctx.modules.isEnabled('todo') ? ctx.services.get<TodoService>('todo') : undefined;
      return { events: svc.listRange(from, to), todos: todo?.listDated(from, to) ?? [] };
    });
    r.get('/events/:id', (req) => {
      const e = svc.getOne(req.params.id!);
      if (!e) throw httpError(404, 'no_encontrado', 'El evento no existe.');
      return e;
    });
    r.post('/events', { ...full, id: 'string' }, (req) => created(svc.create(req.body as EventInput)));
    r.patch('/events/:id', fields, (req) => svc.update(req.params.id!, req.body as Partial<EventInput>));
    r.delete('/events/:id', (req) => { svc.remove(req.params.id!); return noContent(); });
    r.put('/events/:id/occurrences/:date', full, (req) => svc.detachOccurrence(req.params.id!, req.params.date!, req.body as EventInput));
    r.delete('/events/:id/occurrences/:date', (req) => { svc.deleteOccurrence(req.params.id!, req.params.date!); return noContent(); });
  },
};
