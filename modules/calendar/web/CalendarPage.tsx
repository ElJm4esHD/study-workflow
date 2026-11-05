import { useEffect, useMemo, useRef, useState } from 'react';
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
import { ApiError, onReload } from '../../../core/web/api.ts';
import { loadAgenda } from './agenda.ts';
import { useBlock, useCore } from '../../../core/web/CoreContext.tsx';
import { materiaVars } from '../../../core/web/MateriaChip.tsx';
import { PlusIcon } from '../../../core/web/icons.tsx';
import { addDays, formatDate, isValidDate, todayAR, weekdayOf } from '../../../core/shared/dates.ts';
import { NEUTRAL, strongOf } from '../../../core/shared/palette.ts';
import type { TodoItem } from '../../todo/server/service.ts';
import type { Occurrence } from '../server/recurrence.ts';
import { EXAM_KINDS } from '../shared.ts';
import { dayCell, examColor, type AgendaData } from './summary.ts';
import { DayDetail, DOWL, eventHref } from './DayDetail.tsx';
import { KIND_LABELS, VIEWS } from './views.ts';
import { useSwipe } from './useSwipe.ts';
import './calendar.css';

// Las fechas son texto local y FullCalendar trabaja en la zona del dispositivo: no se convierte nada.
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const shiftMonth = (first: string, n: number) => new Date(Date.UTC(+first.slice(0, 4), +first.slice(5, 7) - 1 + n, 1)).toISOString().slice(0, 10);
const monthName = new Intl.DateTimeFormat('es-AR', { month: 'long', timeZone: 'UTC' });
const monthTitle = (first: string) => {
  const m = monthName.format(new Date(`${first}T00:00:00Z`));
  return `${m[0]!.toUpperCase()}${m.slice(1)} ${first.slice(0, 4)}`;
};
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const useWide = () => {
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 768px)').matches);
  useEffect(() => {
    const q = window.matchMedia('(min-width: 768px)');
    const f = () => setWide(q.matches);
    q.addEventListener('change', f);
    return () => q.removeEventListener('change', f);
  }, []);
  return wide;
};

type Extra = { occ?: Occurrence; todo?: TodoItem };

export function CalendarPage() {
  const { materias, settings } = useCore();
  const { off, block } = useBlock();
  const nav = useNavigate();
  const wide = useWide();
  const [params, setParams] = useSearchParams();
  const controller = useCalendarController();
  const wrap = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<AgendaData>({ events: [], todos: [] });
  const [fcTitle, setFcTitle] = useState('');
  const [fcRange, setFcRange] = useState('');
  const [loadError, setLoadError] = useState('');
  const seq = useRef(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  const pushed = useRef(false); // el detalle se abrió con push: cerrarlo es volver atrás

  const today = todayAR();
  const p = (k: string) => { const v = params.get(k); return isValidDate(v) ? v : null; };
  const dia = p('dia');
  const fecha = p('fecha') ?? dia ?? today;
  const vista = VIEWS.find((v) => v.id === (params.get('vista') ?? settings['calendar.initialView']))?.id ?? 'mes';
  const month = vista === 'mes';
  const first = `${fecha.slice(0, 8)}01`;
  const gridStart = addDays(first, 1 - weekdayOf(first));
  const range = month ? `from=${gridStart}&to=${addDays(gridStart, 41)}` : fcRange;

  // Junta los cambios con el URL actual para no perder vista/fecha/dia.
  function go(next: Record<string, string | null>, push = false) {
    const q = new URLSearchParams({ vista, fecha, ...(dia ? { dia } : {}) });
    for (const [k, v] of Object.entries(next)) if (v === null) q.delete(k); else q.set(k, v);
    setParams(q, { replace: !push });
  }
  const moveMonth = (n: number) => go({ fecha: shiftMonth(first, n), dia: null });
  const prev = () => (month ? moveMonth(-1) : controller.prev());
  const next = () => (month ? moveMonth(1) : controller.next());
  const toToday = () => (month ? go({ fecha: today, dia: null }) : controller.today());
  function pick(d: string) {
    if (!dia) pushed.current = true;
    go({ dia: d }, !dia);
  }
  function close() {
    if (pushed.current) nav(-1); else go({ dia: null });
  }
  const sheet = month && !!dia && !wide;
  useEffect(() => { if (!dia) pushed.current = false; }, [dia]);
  useEffect(() => { if (sheet) sheetRef.current?.focus(); }, [sheet]);

  useSwipe(wrap, { onLeft: next, onRight: prev });

  async function load() {
    if (!range) return;
    const me = ++seq.current; // ignora respuestas viejas si el usuario sigue deslizando
    try {
      const r = await loadAgenda(...range.match(/\d{4}-\d{2}-\d{2}/g) as [string, string]);
      if (me === seq.current) { setData(r); setLoadError(''); }
    } catch (e) {
      if (me === seq.current) setLoadError(e instanceof ApiError ? e.message : 'No se pudo cargar el calendario.');
    }
  }
  useEffect(() => { void load(); return onReload(() => void load()); }, [range]);

  function onDatesSet(i: DatesSetInfo) {
    setFcTitle(i.view.title);
    setFcRange(`from=${ymd(i.start)}&to=${addDays(ymd(i.end), -1)}`);
    const f = ymd(i.view.currentStart);
    if (f !== fecha) go({ fecha: f });
  }

  const events = useMemo<EventInput[]>(() => {
    if (month) return [];
    const color = new Map(materias.map((m) => [m.id, m.color]));
    const c = (id: string | null) => (id ? color.get(id) : undefined) ?? NEUTRAL.hex;
    const fromEvents = data.events.map((o): EventInput => {
      const exam = EXAM_KINDS.includes(o.kind);
      return {
        id: o.id, title: o.title, allDay: o.allDay,
        start: o.allDay ? o.startDate : `${o.startDate}T${o.startTime}`,
        // En todo el día el fin de FullCalendar es exclusivo.
        end: o.allDay ? addDays(o.endDate, 1) : o.endTime ? `${o.endDate}T${o.endTime}` : undefined,
        color: exam ? strongOf(c(o.materiaId)) : c(o.materiaId),
        class: exam ? 'cal-exam' : 'cal-soft', occ: o,
      };
    });
    const fromTodos = data.todos.map((t): EventInput => ({
      id: `todo:${t.id}`, title: t.title, allDay: !t.dueTime,
      start: t.dueTime ? `${t.dueDate}T${t.dueTime}` : t.dueDate!,
      color: c(t.materiaId),
      class: t.completed ? 'cal-todo cal-done' : 'cal-todo', todo: t,
    }));
    return [...fromEvents, ...fromTodos];
  }, [data, materias, month]);

  function content(i: EventDisplayInfo) {
    const { occ, todo } = i.event.extendedProps as Extra;
    if (todo) return <span>{todo.completed ? '☑' : '☐'} {i.timeText} {todo.title}</span>;
    if (occ && EXAM_KINDS.includes(occ.kind)) return <b>{KIND_LABELS[occ.kind].toUpperCase()} · {occ.title}</b>;
    return <span>{i.timeText} {occ?.title}</span>;
  }

  const max = wide ? 4 : 3;
  const selected = dia ?? (today >= gridStart && today <= addDays(gridStart, 41) ? today : first);
  function cell(d: string) {
    let c = dayCell(data, d, materias, max);
    if (c.exams.length) c = dayCell(data, d, materias, max - 1); // la etiqueta del examen ocupa un renglón
    const ex = c.exams[0];
    const todos = data.todos.filter((t) => t.dueDate === d).length;
    const others = data.events.filter((e) => e.startDate <= d && d <= e.endDate && !EXAM_KINDS.includes(e.kind)).length;
    const label = [
      ...c.exams.map((e) => `${KIND_LABELS[e.kind].toLowerCase()}${materias.find((m) => m.id === e.materiaId) ? ` de ${materias.find((m) => m.id === e.materiaId)!.name}` : ''}`),
      others && plural(others, 'evento', 'eventos'),
      todos && plural(todos, 'tarea', 'tareas'),
    ].filter(Boolean).join(', ');
    const cls = ['cal-cell', d.slice(0, 7) !== first.slice(0, 7) && 'out', d === today && 'today', (wide || dia) && d === selected && 'sel', ex && 'exam'];
    return (
      <button key={d} type="button" className={cls.filter(Boolean).join(' ')} style={ex ? materiaVars(examColor(materias, ex.materiaId).pastel) : undefined} onClick={() => pick(d)}
        aria-label={`${DOWL[weekdayOf(d) - 1]} ${formatDate(d).slice(0, 5)}${label ? `: ${label}` : ''}`} aria-pressed={d === selected && (wide || !!dia)}>
        <span className="n">{+d.slice(8)}</span>
        {ex && <span className="ex">{materias.find((m) => m.id === ex.materiaId)?.sigla ?? KIND_LABELS[ex.kind]}<small>{KIND_LABELS[ex.kind]}</small></span>}
        {c.chips.map((ch) => (
          <span key={`${ch.materiaId}:${ch.exam}`} className={`chip${ch.exam ? ' solid' : ''}${ch.allDone && d < today ? ' past' : ''}`} style={materiaVars(ch.color)}>
            <span>{ch.sigla}</span>{!ch.exam && <span>{ch.count}</span>}
          </span>
        ))}
        {c.more > 0 && <span className="more">+{c.more}</span>}
      </button>
    );
  }

  return (
    <div className={month ? 'cal-page month' : 'cal-page'}>
      <div className="cal-main">
        <div className="cal-bar">
          <h1 className="cal-title" aria-live="polite">{month ? monthTitle(first) : fcTitle}</h1>
          <div className="seg" role="group" aria-label="Vista">
            {VIEWS.map((v) => <button key={v.id} type="button" aria-pressed={vista === v.id} onClick={() => go({ vista: v.id, dia: null })}>{v.label}</button>)}
          </div>
          <button type="button" className="btn cal-today" onClick={toToday}>Hoy</button>
          <button type="button" className="icon-btn" onClick={prev} aria-label="Anterior">‹</button>
          <button type="button" className="icon-btn" onClick={next} aria-label="Siguiente">›</button>
        </div>
        {loadError && <p className="error" role="alert">{loadError} <button className="btn" onClick={() => void load()}>Reintentar</button></p>}
        <div ref={wrap} className="cal-wrap">
          {month ? (
            <div className="cal-month">
              <div className="cal-dow" aria-hidden="true">{['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((x) => <span key={x}>{x}</span>)}</div>
              <div className="cal-grid" key={first}>{Array.from({ length: 42 }, (_, i) => cell(addDays(gridStart, i)))}</div>
            </div>
          ) : (
            <FullCalendar
              key={vista}
              controller={controller}
              plugins={[classicTheme, dayGrid, timeGrid, list, interaction]}
              locale={es}
              firstDay={1}
              headerToolbar={false}
              initialView={VIEWS.find((v) => v.id === vista)!.fc}
              initialDate={fecha}
              views={{ agenda: { type: 'list', duration: { days: 30 } } }}
              height={wide ? '100%' : 'auto'}
              scrollTime="07:00:00"
              noEventsText="No hay nada en estas fechas."
              events={events}
              eventContent={content}
              datesSet={onDatesSet}
              dateClick={(i) => {
                if (block()) return;
                const q = new URLSearchParams({ fecha: i.dateStr.slice(0, 10) });
                if (!i.allDay) q.set('hora', i.dateStr.slice(11, 16));
                nav(`/calendario/evento/nuevo?${q}`);
              }}
              eventClick={(i) => {
                const { occ, todo } = i.event.extendedProps as Extra;
                if (todo) nav(`/todo/${todo.id}`);
                else if (occ) nav(eventHref(occ));
              }}
            />
          )}
        </div>
        {month && (
          <div className="cal-legend" aria-label="Materias">
            {materias.filter((m) => !m.archived).map((m) => (
              <span key={m.id} style={materiaVars(m.color)}><i className="dot" aria-hidden="true" />{m.sigla} {m.name}</span>
            ))}
          </div>
        )}
      </div>
      {month && wide && <aside className="cal-panel" aria-label="Detalle del día"><DayDetail data={data} date={selected} reload={() => void load()} /></aside>}
      {sheet && (
        <div className="cal-sheet-wrap" onClick={(e) => { if (e.target === e.currentTarget) close(); }} onKeyDown={(e) => { if (e.key === 'Escape') close(); }}>
          <div className="cal-sheet" role="dialog" aria-modal="true" aria-label="Detalle del día" tabIndex={-1} ref={sheetRef}>
            <div className="grab" aria-hidden="true" />
            <DayDetail data={data} date={dia!} reload={() => void load()} />
          </div>
        </div>
      )}
      {!(month && wide) && (
        <Link to={`/calendario/evento/nuevo?fecha=${fecha}`} className="cal-fab" aria-label="Nuevo evento" aria-disabled={off} onClick={(e) => { if (block()) e.preventDefault(); }}><PlusIcon /></Link>
      )}
    </div>
  );
}
