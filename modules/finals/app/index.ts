import type { AppModule } from '../../../core/app/registry.ts';
import { created, noContent } from '../../../core/app/router.ts';
import { httpError } from '../../../core/shared/errors.ts';
import { isValidDate, isValidTime } from '../../../core/shared/dates.ts';
import { nameKey } from '../../../core/shared/normalize.ts';
import type { CalendarService } from '../../calendar/app/service.ts';
import { matchMateria, parseFinales, type Chosen, type FinalDate, type FinalsData } from '../shared.ts';

/** Una fecha posible por materia; y, por materia elegida, el evento del calendario que se creó (id = materiaId: dos dispositivos que eligen lo mismo caen en el mismo registro). */
type ChosenDoc = { id: string; materiaId: string; eventId: string };

// Nulos primero, como el orden ascendente de SQLite.
const cmp = (a: string | null, b: string | null) => (a === b ? 0 : a === null ? -1 : b === null ? 1 : a < b ? -1 : 1);

export const finals: AppModule = {
  id: 'finals',
  requires: ['calendar'],
  collections: ['finals_dates', 'finals_chosen'],
  routes(r, ctx) {
    const dates = ctx.col<FinalDate>('finals_dates');
    const chosenCol = ctx.col<ChosenDoc>('finals_chosen');
    const calendar = ctx.services.get<CalendarService>('calendar')!;

    function check(date: unknown, time: unknown) {
      if (!isValidDate(date)) throw httpError(400, 'fecha_invalida', 'La fecha no es válida.');
      if (time != null && !isValidTime(time)) throw httpError(400, 'hora_invalida', 'La hora no es válida.');
    }
    function data(): FinalsData {
      const links = chosenCol.all();
      // Si borraste el evento a mano en el calendario, deja de figurar como elegido.
      const events = new Map(calendar.getByIds(links.map((l) => l.eventId)).map((e) => [e.id, e]));
      const chosen = links.flatMap((l): Chosen[] => {
        const e = events.get(l.eventId);
        return e ? [{ materiaId: l.materiaId, eventId: l.eventId, date: e.startDate, time: e.startTime }] : [];
      });
      return { dates: dates.all().sort((a, b) => cmp(a.date, b.date) || cmp(a.time, b.time)), chosen };
    }
    function undo() {
      calendar.deleteByIds(chosenCol.all().map((c) => c.eventId));
      chosenCol.all().forEach((c) => chosenCol.remove(c.id));
    }

    r.get('/', () => data());

    r.post('/dates', { materiaId: 'string!', date: 'string!', time: 'string?' }, (req) => {
      const b = req.body as { materiaId: string; date: string; time?: string | null };
      check(b.date, b.time);
      if (!ctx.materias.get(b.materiaId)) throw httpError(400, 'materia_inexistente', 'La materia no existe.');
      const doc: FinalDate = { id: crypto.randomUUID(), materiaId: b.materiaId, date: b.date, time: b.time ?? null };
      dates.put(doc);
      return created(doc);
    });
    r.patch('/dates/:id', { materiaId: 'string', date: 'string!', time: 'string?' }, (req) => {
      const b = req.body as { date: string; time?: string | null };
      check(b.date, b.time);
      const cur = dates.get(req.params.id!);
      if (!cur) throw httpError(404, 'no_encontrado', 'La fecha no existe.');
      const doc = { ...cur, date: b.date, time: b.time ?? null };
      dates.put(doc);
      return doc;
    });
    r.delete('/dates/:id', (req) => { dates.remove(req.params.id!); return noContent(); });

    // `map`: nombre del JSON (nameKey) → id de materia, o null para saltearla. Lo que no está en el mapa se matchea solo.
    r.post('/import', { text: 'string!', map: 'object' }, (req) => {
      const { text, map = {} } = req.body as { text: string; map?: Record<string, string | null> };
      const parsed = parseFinales(text);
      if (!parsed.ok) throw httpError(400, 'finales_invalido', parsed.error);
      const materias = ctx.materias.list();
      let fechas = 0;
      const done = new Set<string>();
      ctx.transaction(() => {
        for (const m of parsed.materias) {
          if (!m.name || !m.fechas.length) continue;
          const k = nameKey(m.name);
          const id = Object.hasOwn(map, k) ? map[k] : matchMateria(m.name, materias)?.id;
          if (!id || done.has(id)) continue;
          if (!ctx.materias.get(id)) throw httpError(400, 'materia_inexistente', 'La materia no existe.');
          done.add(id);
          dates.all().filter((d) => d.materiaId === id).forEach((d) => dates.remove(d.id));
          for (const f of m.fechas) { dates.put({ id: crypto.randomUUID(), materiaId: id, date: f.fecha, time: f.hora }); fechas++; }
        }
      });
      return { materias: done.size, fechas };
    });

    // Elegir una combinación: una fecha por materia. Reemplaza la elegida anterior.
    r.put('/chosen', { dateIds: 'array!' }, (req) => {
      const ids = (req.body as { dateIds: unknown[] }).dateIds;
      const picks = ids.map((id) => (typeof id === 'string' ? dates.get(id) : undefined));
      if (!picks.length || picks.some((p) => !p) || new Set(picks.map((p) => p!.materiaId)).size !== picks.length) {
        throw httpError(400, 'combinacion_invalida', 'La combinación no es válida: tiene que haber una fecha por materia.');
      }
      ctx.transaction(() => {
        undo();
        const events = calendar.createMany(picks.map((p) => ({
          title: 'Final', kind: 'final' as const, materiaId: p!.materiaId, allDay: !p!.time, startDate: p!.date, startTime: p!.time,
        })));
        events.forEach((e, i) => chosenCol.put({ id: picks[i]!.materiaId, materiaId: picks[i]!.materiaId, eventId: e.id }));
      });
      return data();
    });
    r.delete('/chosen', () => { ctx.transaction(undo); return data(); });
  },
};
