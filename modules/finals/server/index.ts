import { randomUUID } from 'node:crypto';
import type { ServerModule } from '../../../core/server/registry.ts';
import { httpError } from '../../../core/server/errors.ts';
import { isValidDate, isValidTime } from '../../../core/shared/dates.ts';
import { nameKey } from '../../../core/shared/normalize.ts';
import type { CalendarService } from '../../calendar/server/service.ts';
import { matchMateria, parseFinales, type Chosen, type FinalDate, type FinalsData } from '../shared.ts';

const SEL = 'SELECT id, materia_id AS materiaId, date, time FROM finals_dates';
const dateBody = { type: 'object', properties: { materiaId: { type: 'string' }, date: { type: 'string' }, time: { type: ['string', 'null'] } } };

export const finals: ServerModule = {
  id: 'finals',
  migrationsDir: new URL('./migrations/', import.meta.url),
  requires: ['calendar'],
  async routes(app, ctx) {
    const { db } = ctx;
    const calendar = ctx.services.get<CalendarService>('calendar')!;
    const idOf = (req: { params: unknown }) => (req.params as { id: string }).id;
    const one = (id: string) => db.prepare(`${SEL} WHERE id = ?`).get(id) as FinalDate | undefined;

    function check(date: unknown, time: unknown) {
      if (!isValidDate(date)) throw httpError(400, 'fecha_invalida', 'La fecha no es válida.');
      if (time != null && !isValidTime(time)) throw httpError(400, 'hora_invalida', 'La hora no es válida.');
    }
    function data(): FinalsData {
      const links = db.prepare('SELECT materia_id AS materiaId, event_id AS eventId FROM finals_chosen').all() as { materiaId: string; eventId: string }[];
      // Si borraste el evento a mano en el calendario, deja de figurar como elegido.
      const events = new Map(calendar.getByIds(links.map((l) => l.eventId)).map((e) => [e.id, e]));
      const chosen = links.flatMap((l): Chosen[] => {
        const e = events.get(l.eventId);
        return e ? [{ ...l, date: e.startDate, time: e.startTime }] : [];
      });
      return { dates: db.prepare(`${SEL} ORDER BY date, time`).all() as FinalDate[], chosen };
    }
    function undo() {
      const ids = (db.prepare('SELECT event_id AS id FROM finals_chosen').all() as { id: string }[]).map((r) => r.id);
      calendar.deleteByIds(ids);
      db.prepare('DELETE FROM finals_chosen').run();
    }

    app.get('/', async () => data());

    app.post('/dates', { schema: { body: { ...dateBody, required: ['materiaId', 'date'] } } }, async (req, reply) => {
      const b = req.body as { materiaId: string; date: string; time?: string | null };
      check(b.date, b.time);
      if (!ctx.materias.get(b.materiaId)) throw httpError(400, 'materia_inexistente', 'La materia no existe.');
      const id = randomUUID();
      db.prepare('INSERT INTO finals_dates (id, materia_id, date, time) VALUES (?, ?, ?, ?)').run(id, b.materiaId, b.date, b.time ?? null);
      return reply.status(201).send(one(id));
    });
    app.patch('/dates/:id', { schema: { body: { ...dateBody, required: ['date'] } } }, async (req) => {
      const b = req.body as { date: string; time?: string | null };
      check(b.date, b.time);
      if (db.prepare('UPDATE finals_dates SET date = ?, time = ? WHERE id = ?').run(b.date, b.time ?? null, idOf(req)).changes === 0) {
        throw httpError(404, 'no_encontrado', 'La fecha no existe.');
      }
      return one(idOf(req));
    });
    app.delete('/dates/:id', async (req, reply) => {
      db.prepare('DELETE FROM finals_dates WHERE id = ?').run(idOf(req));
      return reply.status(204).send();
    });

    // `map`: nombre del JSON (nameKey) → id de materia, o null para saltearla. Lo que no está en el mapa se matchea solo.
    app.post('/import', {
      schema: { body: { type: 'object', required: ['text'], properties: { text: { type: 'string' }, map: { type: 'object' } } } },
    }, async (req) => {
      const { text, map = {} } = req.body as { text: string; map?: Record<string, string | null> };
      const r = parseFinales(text);
      if (!r.ok) throw httpError(400, 'finales_invalido', r.error);
      const materias = ctx.materias.list();
      let fechas = 0;
      const done = new Set<string>();
      ctx.transaction(() => {
        for (const m of r.materias) {
          if (!m.name || !m.fechas.length) continue;
          const k = nameKey(m.name);
          const id = Object.hasOwn(map, k) ? map[k] : matchMateria(m.name, materias)?.id;
          if (!id || done.has(id)) continue;
          if (!ctx.materias.get(id)) throw httpError(400, 'materia_inexistente', 'La materia no existe.');
          done.add(id);
          db.prepare('DELETE FROM finals_dates WHERE materia_id = ?').run(id);
          const ins = db.prepare('INSERT INTO finals_dates (id, materia_id, date, time) VALUES (?, ?, ?, ?)');
          for (const f of m.fechas) { ins.run(randomUUID(), id, f.fecha, f.hora); fechas++; }
        }
      });
      return { materias: done.size, fechas };
    });

    // Elegir una combinación: una fecha por materia. Reemplaza la elegida anterior.
    app.put('/chosen', {
      schema: { body: { type: 'object', required: ['dateIds'], properties: { dateIds: { type: 'array', minItems: 1, items: { type: 'string' } } } } },
    }, async (req) => {
      const picks = (req.body as { dateIds: string[] }).dateIds.map((id) => one(id));
      if (picks.some((p) => !p) || new Set(picks.map((p) => p!.materiaId)).size !== picks.length) {
        throw httpError(400, 'combinacion_invalida', 'La combinación no es válida: tiene que haber una fecha por materia.');
      }
      ctx.transaction(() => {
        undo();
        const events = calendar.createMany(picks.map((p) => ({
          title: 'Final', kind: 'final' as const, materiaId: p!.materiaId, allDay: !p!.time, startDate: p!.date, startTime: p!.time,
        })));
        const ins = db.prepare('INSERT INTO finals_chosen (materia_id, event_id) VALUES (?, ?)');
        events.forEach((e, i) => ins.run(picks[i]!.materiaId, e.id));
      });
      return data();
    });
    app.delete('/chosen', async () => { ctx.transaction(undo); return data(); });
  },
};
