import { Link, useLocation } from 'react-router';
import { api, ApiError } from '../../../core/web/api.ts';
import { useCore } from '../../../core/web/CoreContext.tsx';
import { materiaVars } from '../../../core/web/MateriaChip.tsx';
import { formatDate, todayAR, weekdayOf } from '../../../core/shared/dates.ts';
import { fmtDuration } from '../../../core/shared/duration.ts';
import { NEUTRAL } from '../../../core/shared/palette.ts';
import { TODO_CATEGORIES } from '../../todo/shared.ts';
import type { TodoItem } from '../../todo/server/service.ts';
import type { Occurrence } from '../server/recurrence.ts';
import { dayDetail, examColor, type AgendaData } from './summary.ts';
import { KIND_LABELS } from './views.ts';

export const DOWL = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
export const eventHref = (o: Occurrence) => `/calendario/evento/${o.eventId}${o.isRecurring ? `?ocurrencia=${o.occurrenceDate}` : ''}`;
const time = (o: Occurrence) => (o.allDay ? 'Todo el día' : o.startTime);

export function DayDetail({ data, date, reload }: { data: AgendaData; date: string; reload(): void }) {
  const { materias, notify, enabledModules } = useCore();
  const { pathname, search } = useLocation();
  const d = dayDetail(data, date);
  const mat = (id: string | null) => materias.find((m) => m.id === id);
  const dow = DOWL[weekdayOf(date) - 1]!;

  async function toggle(t: TodoItem) {
    try { await api('PATCH', `/api/todo/${t.id}`, { completed: !t.completed }); } catch (e) { notify(e instanceof ApiError ? e.message : 'Algo salió mal.'); }
    reload();
  }

  const total = d.total
    ? `${fmtDuration(d.minutes)} estimados, ${d.done} de ${d.total} hechas${d.unestimated ? `, ${d.unestimated} sin estimar` : ''}`
    : 'Sin tareas';
  return (
    <>
      <div className="dd-head">
        <h2>{dow[0]!.toUpperCase() + dow.slice(1)} {formatDate(date).slice(0, 5)}</h2>
        {date === todayAR() && <span className="tag">Hoy</span>}
      </div>
      <p className="dd-total">{total}</p>
      {d.total > 0 && <div className="dd-progress" aria-hidden="true"><i style={{ width: `${(d.done / d.total) * 100}%` }} /></div>}
      {d.exams.map((e) => {
        const c = examColor(materias, e.materiaId);
        return (
          <Link key={e.id} to={eventHref(e)} className="dd-exam" style={materiaVars(c.pastel)}>
            <div><strong>{KIND_LABELS[e.kind]}: {mat(e.materiaId)?.name ?? 'Sin materia'}</strong><span>{e.title}</span></div>
            <span className="time">{time(e)}</span>
          </Link>
        );
      })}
      {d.events.map((e) => (
        <Link key={e.id} to={eventHref(e)} className="dd-ev" style={materiaVars(mat(e.materiaId)?.color ?? NEUTRAL.hex)}>
          <span className="dot" aria-hidden="true" />{e.title}<span className="time">{time(e)}</span>
        </Link>
      ))}
      {d.groups.map((g) => {
        const m = mat(g.materiaId);
        return (
          <section key={g.materiaId ?? '-'} className="dd-group" style={materiaVars(m?.color ?? NEUTRAL.hex)}>
            <h3><span className="dot" aria-hidden="true" />{m?.name ?? 'Sin materia'}<span className="gt">{g.minutes ? fmtDuration(g.minutes) : ''}</span></h3>
            {g.todos.map((t) => (
              <div key={t.id} className={t.completed ? 'task-row done' : 'task-row'}>
                <button type="button" className="chk" role="checkbox" aria-checked={t.completed} aria-label={`Completar: ${t.title}`} onClick={() => void toggle(t)}><span /></button>
                <Link to={`/todo/${t.id}`} className="body">
                  <div className="title">{t.title}</div>
                  {(t.category !== 'tarea' || t.dueTime) && (
                    <div className="meta">
                      {t.dueTime && <span className="tag">{t.dueTime}</span>}
                      {t.category !== 'tarea' && <span className={`tag ${t.category}`}>{TODO_CATEGORIES.find((c) => c.id === t.category)?.label}</span>}
                    </div>
                  )}
                </Link>
                <span className="dur">{t.durationMin ? fmtDuration(t.durationMin) : ''}</span>
              </div>
            ))}
          </section>
        );
      })}
      {!d.total && !d.exams.length && !d.events.length && <p className="muted dd-empty">Nada para este día.</p>}
      <div className="row dd-add">
        {enabledModules.some((m) => m.id === 'todo') && (
          <Link className="btn" to={`/todo/nueva?fecha=${date}&volver=${encodeURIComponent(pathname + search)}`}>Agregar tarea</Link>
        )}
        <Link className="btn" to={`/calendario/evento/nuevo?fecha=${date}`}>Agregar evento</Link>
      </div>
    </>
  );
}
