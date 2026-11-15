import { Link, useLocation } from 'react-router';
import { AnimatePresence, m } from 'motion/react';
import { api, errMsg } from '../../../core/web/api.ts';
import { useBlock, useCore } from '../../../core/web/CoreContext.tsx';
import { materiaVars } from '../../../core/web/MateriaChip.tsx';
import { formatDate, weekdayOf } from '../../../core/shared/dates.ts';
import { fmtDuration } from '../../../core/shared/duration.ts';
import { NEUTRAL } from '../../../core/shared/palette.ts';
import { BookIcon, CalendarIcon, ClockIcon, EventIcon, FinalIcon, ParcialIcon, PlusIcon, RecuperatorioIcon, SubtasksIcon, UploadIcon } from '../../../core/web/icons.tsx';
import { vibrate } from '../../../core/web/haptics.ts';
import { useMotion } from '../../../core/web/motion.tsx';
import { EmptyState, TaskRow } from '../../../core/web/ui.tsx';
import { TODO_CATEGORIES } from '../../todo/shared.ts';
import type { TodoItem } from '../../todo/server/service.ts';
import type { Occurrence } from '../server/recurrence.ts';
import { dayDetail, examColor, type AgendaData } from './summary.ts';
import { KIND_LABELS } from './views.ts';
import { useToday } from '../../../core/web/useToday.ts';

export const DOWL = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
export const eventHref = (o: Occurrence) => `/calendario/evento/${o.eventId}${o.isRecurring ? `?ocurrencia=${o.occurrenceDate}` : ''}`;
export const KIND_ICON = { evento: EventIcon, parcial: ParcialIcon, recuperatorio: RecuperatorioIcon, final: FinalIcon } as const;
const time = (o: Occurrence) => (o.allDay ? 'Todo el día' : o.endTime && o.startDate === o.endDate ? `${o.startTime}–${o.endTime}` : o.startTime);

export function DayDetail({ data, date, reload }: { data: AgendaData; date: string; reload(): void }) {
  const { materias, notify, enabledModules } = useCore();
  const { off, block } = useBlock();
  const { pathname, search } = useLocation();
  const { spring } = useMotion();
  const today = useToday();
  const d = dayDetail(data, date);
  const mat = (id: string | null) => materias.find((x) => x.id === id);
  const dow = DOWL[weekdayOf(date) - 1]!;

  async function toggle(t: TodoItem) {
    vibrate(t.completed ? 'tick' : 'success');
    try { await api('PATCH', `/api/todo/${t.id}`, { completed: !t.completed }); } catch (e) { notify(errMsg(e)); }
    reload();
  }

  const total = d.total
    ? `${fmtDuration(d.minutes)} estimados · ${d.done} de ${d.total} hechas${d.unestimated ? ` · ${d.unestimated} sin estimar` : ''}`
    : d.exams.length + d.events.length ? `${d.exams.length + d.events.length} ${d.exams.length + d.events.length === 1 ? 'evento' : 'eventos'}` : 'Día libre';
  return (
    <div className="dd">
      <div className="dd-head">
        <h2>{dow[0]!.toUpperCase() + dow.slice(1)} {formatDate(date).slice(0, 5)}</h2>
        {date === today && <span className="chip dd-today">Hoy</span>}
      </div>
      <p className="dd-total">{total}</p>
      {d.total > 0 && <div className="dd-progress" aria-hidden="true"><m.i initial={false} animate={{ scaleX: d.done / d.total }} transition={spring('sheet')} /></div>}
      {d.exams.map((e) => {
        const c = examColor(materias, e.materiaId);
        const Icon = KIND_ICON[e.kind];
        return (
          <Link key={e.id} to={eventHref(e)} className="dd-exam" style={materiaVars(c.pastel)}>
            <Icon size={20} />
            <div><strong>{KIND_LABELS[e.kind]}: {mat(e.materiaId)?.name ?? 'Sin materia'}</strong><span>{e.title}</span></div>
            <span className="time">{time(e)}</span>
          </Link>
        );
      })}
      {d.events.map((e) => (
        <Link key={e.id} to={eventHref(e)} className="dd-ev" style={materiaVars(mat(e.materiaId)?.color ?? NEUTRAL.hex)}>
          <EventIcon size={18} /><span className="t">{e.title}</span><span className="time">{time(e)}</span>
        </Link>
      ))}
      {d.groups.map((g) => {
        const mt = mat(g.materiaId);
        return (
          <section key={g.materiaId ?? '-'} className="dd-group" style={materiaVars(mt?.color ?? NEUTRAL.hex)}>
            <h3><span className="dot" aria-hidden="true" />{mt?.name ?? 'Sin materia'}<span className="gt">{g.minutes ? fmtDuration(g.minutes) : ''}</span></h3>
            <ul className="rows">
              <AnimatePresence initial={false}>
                {g.todos.map((t) => (
                  <TaskRow key={t.id} title={t.title} done={t.completed} colorVars={materiaVars(mt?.color ?? NEUTRAL.hex)} to={`/todo/${t.id}`}
                    toggleLabel={`${t.completed ? 'Destildar' : 'Completar'}: ${t.title}`} onToggle={() => void toggle(t)}
                    duration={t.durationMin ? fmtDuration(t.durationMin) : ''}
                    meta={(t.category !== 'tarea' || t.dueTime || t.subtasks?.length > 0) && <>
                      {t.category !== 'tarea' && <span className={`tag mi-tag ${t.category}`}>{t.category === 'entrega' ? <UploadIcon /> : <BookIcon />}{TODO_CATEGORIES.find((c) => c.id === t.category)?.label}</span>}
                      {t.subtasks?.length > 0 && <span className="tag mi-tag"><SubtasksIcon />{t.subtasks.filter((s) => s.done).length}/{t.subtasks.length}</span>}
                      {t.dueTime && <span className="tag mi-tag"><ClockIcon />{t.dueTime}</span>}
                    </>} />
                ))}
              </AnimatePresence>
            </ul>
          </section>
        );
      })}
      {!d.total && !d.exams.length && !d.events.length && <EmptyState icon={CalendarIcon} title="Nada en este día">Agregá una tarea o un evento.</EmptyState>}
      <div className="dd-add">
        {enabledModules.some((x) => x.id === 'todo') && (
          <Link className="btn" to={`/todo/nueva?fecha=${date}&volver=${encodeURIComponent(pathname + search)}`} aria-disabled={off} onClick={(e) => { if (block()) e.preventDefault(); }}><PlusIcon size={18} />Tarea</Link>
        )}
        <Link className="btn" to={`/calendario/evento/nuevo?fecha=${date}`} aria-disabled={off} onClick={(e) => { if (block()) e.preventDefault(); }}><PlusIcon size={18} />Evento</Link>
      </div>
    </div>
  );
}
