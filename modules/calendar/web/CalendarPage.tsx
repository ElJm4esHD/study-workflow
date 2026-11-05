import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import FullCalendar, { useCalendarController } from '@fullcalendar/react';
import type { DatesSetInfo, EventDisplayInfo, EventInput } from '@fullcalendar/react';
import classicTheme from '@fullcalendar/react/themes/classic';
import dayGrid from '@fullcalendar/react/daygrid';
import timeGrid from '@fullcalendar/react/timegrid';
import list from '@fullcalendar/react/list';
import interaction from '@fullcalendar/react/interaction';
import es from '@fullcalendar/react/locales/es';
import '@fullcalendar/react/skeleton.css';
import '@fullcalendar/react/themes/classic/theme.css';
import '@fullcalendar/react/themes/classic/palette.css';
import { api, ApiError } from '../../../core/web/api.ts';
import { useCore } from '../../../core/web/CoreContext.tsx';
import { PlusIcon } from '../../../core/web/icons.tsx';
import { addDays, todayAR } from '../../../core/shared/dates.ts';
import type { TodoItem } from '../../todo/server/service.ts';
import type { Occurrence } from '../server/recurrence.ts';
import { EXAM_KINDS } from '../shared.ts';
import type { AgendaData } from './summary.ts';
import { KIND_LABELS, VIEWS } from './views.ts';
import { useSwipe } from './useSwipe.ts';
import './calendar.css';

const NEUTRAL = '#8b8d98';
// Las fechas son texto local y FullCalendar trabaja en la zona del dispositivo: no se convierte nada.
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
// Texto blanco o negro según la luminancia del color de la materia, para sostener el contraste sobre el fondo sólido.
function contrastOn(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.18 ? '#000' : '#fff';
}

type Extra = { occ?: Occurrence; todo?: TodoItem };

export function CalendarPage() {
  const { materias, settings } = useCore();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const controller = useCalendarController();
  const wrap = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<AgendaData>({ events: [], todos: [] });
  const [title, setTitle] = useState('');
  const [view, setView] = useState('');
  const [shown, setShown] = useState('');
  const [initial] = useState(() => ({
    vista: VIEWS.find((v) => v.id === (params.get('vista') ?? settings['calendar.initialView'])) ?? VIEWS[0],
    fecha: params.get('fecha') ?? todayAR(),
  }));
  const seq = useRef(0);
  const range = useRef('');
  const [loadError, setLoadError] = useState('');

  useSwipe(wrap, { onLeft: () => controller.next(), onRight: () => controller.prev() });

  async function onDatesSet(i: DatesSetInfo) {
    // Un tipo desconocido no debe romper la pantalla: se conserva la vista anterior.
    const vista = VIEWS.find((v) => v.fc === i.view.type)?.id ?? view;
    const fecha = ymd(i.view.currentStart);
    setTitle(i.view.title);
    setView(vista);
    setShown(fecha);
    setParams({ vista, fecha }, { replace: true });
    range.current = `from=${ymd(i.start)}&to=${addDays(ymd(i.end), -1)}`;
    await load();
  }

  async function load() {
    const me = ++seq.current; // ignora respuestas viejas si el usuario sigue deslizando
    try {
      const r = await api<AgendaData>('GET', `/api/calendar/agenda?${range.current}`);
      if (me === seq.current) { setData(r); setLoadError(''); }
    } catch (e) {
      if (me === seq.current) setLoadError(e instanceof ApiError ? e.message : 'No se pudo cargar el calendario.');
    }
  }

  const events = useMemo<EventInput[]>(() => {
    const color = new Map(materias.map((m) => [m.id, m.color]));
    const c = (id: string | null) => (id ? color.get(id) : undefined) ?? NEUTRAL;
    const fromEvents = data.events.map((o): EventInput => {
      const exam = EXAM_KINDS.includes(o.kind);
      const base = c(o.materiaId);
      return {
        id: o.id, title: o.title, allDay: o.allDay,
        start: o.allDay ? o.startDate : `${o.startDate}T${o.startTime}`,
        // En todo el día el fin de FullCalendar es exclusivo.
        end: o.allDay ? addDays(o.endDate, 1) : o.endTime ? `${o.endDate}T${o.endTime}` : undefined,
        color: base, contrastColor: exam ? contrastOn(base) : 'var(--text)',
        class: exam ? 'cal-exam' : 'cal-soft', occ: o,
      };
    });
    const fromTodos = data.todos.map((t): EventInput => ({
      id: `todo:${t.id}`, title: t.title, allDay: !t.dueTime,
      start: t.dueTime ? `${t.dueDate}T${t.dueTime}` : t.dueDate!,
      color: c(t.materiaId), contrastColor: 'var(--text)',
      class: t.completed ? 'cal-todo cal-done' : 'cal-todo', todo: t,
    }));
    return [...fromEvents, ...fromTodos];
  }, [data, materias]);

  function content(i: EventDisplayInfo) {
    const { occ, todo } = i.event.extendedProps as Extra;
    if (todo) return <span>{todo.completed ? '☑' : '☐'} {i.timeText} {todo.title}</span>;
    if (occ && EXAM_KINDS.includes(occ.kind)) return <b>{KIND_LABELS[occ.kind].toUpperCase()} · {occ.title}</b>;
    return <span>{i.timeText} {occ?.title}</span>;
  }

  return (
    <>
      <div className="cal-bar">
        <div className="cal-tabs" role="group" aria-label="Vista">
          {VIEWS.map((v) => (
            <button key={v.id} className="cal-tab" aria-pressed={view === v.id} onClick={() => controller.changeView(v.fc)}>{v.label}</button>
          ))}
        </div>
        <button className="btn" onClick={() => controller.today()}>Hoy</button>
      </div>
      <div className="cal-nav">
        <button className="btn cal-arrow" onClick={() => controller.prev()} aria-label="Anterior">‹</button>
        <h1 className="cal-title" aria-live="polite">{title}</h1>
        <button className="btn cal-arrow" onClick={() => controller.next()} aria-label="Siguiente">›</button>
      </div>
      {loadError && <p className="error" role="alert">{loadError} <button className="btn" onClick={load}>Reintentar</button></p>}
      <div ref={wrap} className="cal-wrap">
        <FullCalendar
          controller={controller}
          plugins={[classicTheme, dayGrid, timeGrid, list, interaction]}
          locale={es}
          firstDay={1}
          headerToolbar={false}
          initialView={initial.vista.fc}
          initialDate={initial.fecha}
          views={{ agenda: { type: 'list', duration: { days: 30 } } }}
          height="auto"
          scrollTime="07:00:00"
          noEventsText="No hay nada en estas fechas."
          events={events}
          eventContent={content}
          datesSet={onDatesSet}
          dateClick={(i) => {
            const q = new URLSearchParams({ fecha: i.dateStr.slice(0, 10) });
            if (!i.allDay) q.set('hora', i.dateStr.slice(11, 16));
            nav(`/calendario/evento/nuevo?${q}`);
          }}
          eventClick={(i) => {
            const { occ, todo } = i.event.extendedProps as Extra;
            if (todo) nav(`/todo/${todo.id}`);
            else if (occ) nav(`/calendario/evento/${occ.eventId}${occ.isRecurring ? `?ocurrencia=${occ.occurrenceDate}` : ''}`);
          }}
        />
      </div>
      <Link to={`/calendario/evento/nuevo?fecha=${shown || initial.fecha}`} className="cal-fab" aria-label="Nuevo evento"><PlusIcon /></Link>
    </>
  );
}
