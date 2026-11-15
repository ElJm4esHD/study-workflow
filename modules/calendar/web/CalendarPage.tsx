import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import type { DatesSetInfo, EventDisplayInfo, EventInput } from '@fullcalendar/react';
import { onReload, errMsg } from '../../../core/web/api.ts';
import { loadAgenda } from './agenda.ts';
import { useBlock, useCore } from '../../../core/web/CoreContext.tsx';
import { materiaVars } from '../../../core/web/MateriaChip.tsx';
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon } from '../../../core/web/icons.tsx';
import { AnimatePresence, m } from 'motion/react';
import { useMotion } from '../../../core/web/motion.tsx';
import { Floating, PullToRefresh, Segmented, Sheet, ErrorState, Skeleton } from '../../../core/web/ui.tsx';
import { addDays, formatDate, isValidDate, weekdayOf } from '../../../core/shared/dates.ts';
import { NEUTRAL, strongOf } from '../../../core/shared/palette.ts';
import type { TodoItem } from '../../todo/server/service.ts';
import type { Occurrence } from '../server/recurrence.ts';
import { EXAM_KINDS } from '../shared.ts';
import { dayCell, examColor, type AgendaData } from './summary.ts';
import { DayDetail, DOWL, eventHref } from './DayDetail.tsx';
import { KIND_LABELS, VIEWS } from './views.ts';
import { useSwipe } from './useSwipe.ts';
import type { WeekApi } from './WeekView.tsx';
import './calendar.css';

const WeekView = lazy(() => import('./WeekView.tsx'));
import { useToday } from '../../../core/web/useToday.ts';

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
  const week = useRef<WeekApi>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<AgendaData>({ events: [], todos: [] });
  const [fcTitle, setFcTitle] = useState('');
  const [fcRange, setFcRange] = useState('');
  const [loadError, setLoadError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const seq = useRef(0);
  const pushed = useRef(false); // el detalle se abrió con push: cerrarlo es volver atrás
  const { spring } = useMotion();

  const today = useToday();
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
  const prev = () => (month ? moveMonth(-1) : week.current?.prev());
  const next = () => (month ? moveMonth(1) : week.current?.next());
  const toToday = () => (month ? go({ fecha: today, dia: null }) : week.current?.today());
  function pick(d: string) {
    if (!dia) pushed.current = true;
    go({ dia: d }, !dia);
  }
  function close() {
    if (pushed.current) nav(-1); else go({ dia: null });
  }
  const sheet = month && !!dia && !wide;
  const lastDia = useRef(dia); // la hoja sigue mostrando el día mientras se va
  if (dia) lastDia.current = dia;
  useEffect(() => { if (!dia) pushed.current = false; }, [dia]);
  // Dirección del cambio de mes para la animación (adelante entra desde la derecha).
  const prevFirst = useRef(first);
  const dir = first > prevFirst.current ? 1 : first < prevFirst.current ? -1 : 0;
  useEffect(() => { prevFirst.current = first; }, [first]);

  useSwipe(wrap, { onLeft: next, onRight: prev });

  async function load() {
    if (!range) return;
    const me = ++seq.current; // ignora respuestas viejas si el usuario sigue deslizando
    try {
      const r = await loadAgenda(...range.match(/\d{4}-\d{2}-\d{2}/g) as [string, string]);
      if (me === seq.current) { setData(r); setLoadError(''); setLoaded(true); }
    } catch (e) {
      if (me === seq.current) setLoadError(errMsg(e));
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
    if (todo) return <span className="fc-todo">{todo.completed ? <CheckIcon size={12} /> : <i className="fc-box" />}{i.timeText} {todo.title}</span>;
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
        {!loaded && !loadError && <Skeleton w="60%" h={10} />}
        <span className="dots" aria-hidden="true">{c.chips.filter((ch) => !ch.exam).slice(0, 4).map((ch) => <i key={ch.materiaId ?? '-'} style={materiaVars(ch.color)} className={ch.allDone && d < today ? 'past' : undefined} />)}</span>
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
    <PullToRefresh>
    <div className={month ? 'cal-page month' : 'cal-page'}>
      <div className="cal-main">
        <div className="cal-bar">
          <h1 className="cal-title" aria-live="polite">{month ? monthTitle(first) : fcTitle}</h1>
          <Segmented name="cal-view" label="Vista" value={vista} options={VIEWS.map((v) => [v.id, v.label] as const)} onChange={(v) => go({ vista: v, dia: null })} />
          <button type="button" className="btn cal-today" onClick={toToday}>Hoy</button>
          <button type="button" className="icon-btn" onClick={prev} aria-label="Anterior"><ChevronLeftIcon /></button>
          <button type="button" className="icon-btn" onClick={next} aria-label="Siguiente"><ChevronRightIcon /></button>
        </div>
        {loadError && <ErrorState error={{ message: loadError }} onRetry={() => void load()} />}
        <div ref={wrap} className="cal-wrap" aria-busy={!loaded && !loadError}>
          {month ? (
            <div className="cal-month">
              <div className="cal-dow" aria-hidden="true">{['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((x) => <span key={x}>{x}</span>)}</div>
              <AnimatePresence mode="popLayout" initial={false} custom={dir}>
                <m.div className="cal-grid" key={first} custom={dir}
                  initial={{ opacity: 0, x: dir * 28 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir * -20 }} transition={spring('gentle')}>
                  {Array.from({ length: 42 }, (_, i) => cell(addDays(gridStart, i)))}
                </m.div>
              </AnimatePresence>
            </div>
          ) : (
            <Suspense fallback={<div className="card" role="status" aria-label="Cargando"><Skeleton h={320} /></div>}>
              <WeekView key={vista} api={week} view={VIEWS.find((v) => v.id === vista)!.fc} date={fecha} wide={wide} events={events} content={content} onDates={onDatesSet}
                onDateClick={(i) => {
                  if (block()) return;
                  const q = new URLSearchParams({ fecha: i.dateStr.slice(0, 10) });
                  if (!i.allDay) q.set('hora', i.dateStr.slice(11, 16));
                  nav(`/calendario/evento/nuevo?${q}`);
                }}
                onEventClick={(i) => {
                  const { occ, todo } = i.event.extendedProps as Extra;
                  if (todo) nav(`/todo/${todo.id}`);
                  else if (occ) nav(eventHref(occ));
                }} />
            </Suspense>
          )}
        </div>
        {month && (
          <div className="cal-legend" role="group" aria-label="Materias">
            {materias.filter((m) => !m.archived).map((m) => (
              <span key={m.id} style={materiaVars(m.color)}><i className="dot" aria-hidden="true" />{m.sigla} {m.name}</span>
            ))}
          </div>
        )}
      </div>
      {month && wide && <aside className="cal-panel" aria-label="Detalle del día"><DayDetail data={data} date={selected} reload={() => void load()} /></aside>}
      {!wide && <Sheet open={sheet} onClose={close} label="Detalle del día">{lastDia.current && <DayDetail data={data} date={lastDia.current} reload={() => void load()} />}</Sheet>}
      {!(month && wide) && (
        <Floating><nav aria-label="Acción rápida"><Link to={`/calendario/evento/nuevo?fecha=${fecha}`} className="cal-fab" aria-label="Nuevo evento" aria-disabled={off} onClick={(e) => { if (block()) e.preventDefault(); }}><PlusIcon /></Link></nav></Floating>
      )}
    </div>
    </PullToRefresh>
  );
}
