import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { onReload, errMsg } from '../../../core/web/api.ts';
import { loadAgenda } from './agenda.ts';
import { useBlock, useCore } from '../../../core/web/CoreContext.tsx';
import { materiaVars } from '../../../core/web/MateriaChip.tsx';
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from '../../../core/web/icons.tsx';
import { AnimatePresence, m } from 'motion/react';
import { useMotion } from '../../../core/web/motion.tsx';
import { Floating, PullToRefresh, Segmented, Sheet, ErrorState, Skeleton } from '../../../core/web/ui.tsx';
import { addDays, formatDate, isValidDate, weekdayOf } from '../../../core/shared/dates.ts';
import { EXAM_KINDS } from '../shared.ts';
import { dayCell, examColor, type AgendaData } from './summary.ts';
import { DayDetail, DOWL } from './DayDetail.tsx';
import { KIND_LABELS, VIEWS } from './views.ts';
import { useSwipe } from './useSwipe.ts';
import { WeekView } from './WeekView.tsx';
import { windowStart } from './week.ts';
import './calendar.css';
import { useToday } from '../../../core/web/useToday.ts';

const shiftMonth = (first: string, n: number) => new Date(Date.UTC(+first.slice(0, 4), +first.slice(5, 7) - 1 + n, 1)).toISOString().slice(0, 10);
const monthName = new Intl.DateTimeFormat('es-AR', { month: 'long', timeZone: 'UTC' });
const monthTitle = (first: string) => {
  const m = monthName.format(new Date(`${first}T00:00:00Z`));
  return `${m[0]!.toUpperCase()}${m.slice(1)} ${first.slice(0, 4)}`;
};
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
/** "16 al 22 de noviembre", "30 de noviembre al 6 de diciembre" o "Noviembre 2026" (celu). */
function weekTitle(from: string, to: string, wide: boolean) {
  if (!wide) return monthTitle(`${from.slice(0, 8)}01`);
  const mo = (d: string) => MONTHS[+d.slice(5, 7) - 1];
  return from.slice(5, 7) === to.slice(5, 7) ? `${+from.slice(8)} al ${+to.slice(8)} de ${mo(to)}` : `${+from.slice(8)} de ${mo(from)} al ${+to.slice(8)} de ${mo(to)}`;
}

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

export function CalendarPage() {
  const { materias, settings } = useCore();
  const { off, block } = useBlock();
  const nav = useNavigate();
  const wide = useWide();
  const [params, setParams] = useSearchParams();
  const wrap = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<AgendaData>({ events: [], todos: [] });
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
  const nDays = wide ? 7 : 3;
  const wStart = windowStart(fecha, weekdayOf(fecha), wide);
  const wEnd = addDays(wStart, nDays - 1);
  const range = month ? `from=${gridStart}&to=${addDays(gridStart, 41)}` : `from=${wStart}&to=${wEnd}`;

  // Junta los cambios con el URL actual para no perder vista/fecha/dia.
  function go(next: Record<string, string | null>, push = false) {
    const q = new URLSearchParams({ vista, fecha, ...(dia ? { dia } : {}) });
    for (const [k, v] of Object.entries(next)) if (v === null) q.delete(k); else q.set(k, v);
    setParams(q, { replace: !push });
  }
  const moveMonth = (n: number) => go({ fecha: shiftMonth(first, n), dia: null });
  const prev = () => (month ? moveMonth(-1) : go({ fecha: addDays(wStart, -nDays), dia: null }));
  const next = () => (month ? moveMonth(1) : go({ fecha: addDays(wStart, nDays), dia: null }));
  const toToday = () => go({ fecha: today, dia: null });
  function pick(d: string) {
    if (!dia) pushed.current = true;
    go({ dia: d }, !dia);
  }
  function close() {
    if (pushed.current) nav(-1); else go({ dia: null });
  }
  const sheet = !!dia && (!wide || !month); // en Semana el detalle del día va en la hoja también en la compu
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
          <h1 className="cal-title" aria-live="polite">{month ? monthTitle(first) : weekTitle(wStart, wEnd, wide)}</h1>
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
            <>
              {!wide && <WeekStrip start={wStart} today={today} data={data} onPick={(d) => go({ fecha: d })} />}
              <WeekView start={wStart} days={nDays} today={today} data={data} reload={() => void load()} onDay={pick} />
            </>
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
      {(!wide || !month) && <Sheet open={sheet} onClose={close} label="Detalle del día">{lastDia.current && <DayDetail data={data} date={lastDia.current} reload={() => void load()} />}</Sheet>}
      {!(month && wide) && (
        <Floating><nav aria-label="Acción rápida"><Link to={`/calendario/evento/nuevo?fecha=${fecha}`} className="cal-fab" aria-label="Nuevo evento" aria-disabled={off} onClick={(e) => { if (block()) e.preventDefault(); }}><PlusIcon /></Link></nav></Floating>
      )}
    </div>
    </PullToRefresh>
  );
}

/** Tira de la semana en el celu: puntos por materia, la ventana de 3 días resaltada; tocar un día lo pone primero. */
function WeekStrip({ start, today, data, onPick }: { start: string; today: string; data: AgendaData; onPick(d: string): void }) {
  const { materias } = useCore();
  const mon = addDays(start, 1 - weekdayOf(start));
  const [wk, setWk] = useState<AgendaData | null>(null);
  // La agenda cargada cubre solo los 3 días visibles: la tira pide su semana para los puntos.
  useEffect(() => { let on = true; loadAgenda(mon, addDays(mon, 6)).then((r) => on && setWk(r), () => {}); return () => { on = false; }; }, [mon, data]);
  const src = wk ?? data;
  return (
    <div className="wk-strip" role="group" aria-label="Semana">
      {Array.from({ length: 7 }, (_, i) => {
        const d = addDays(mon, i);
        const ids = [...new Set([...src.events.filter((e) => e.startDate <= d && d <= e.endDate).map((e) => e.materiaId), ...src.todos.filter((t) => t.dueDate === d).map((t) => t.materiaId)])].slice(0, 3);
        const inWin = d >= start && d <= addDays(start, 2);
        return (
          <button key={d} type="button" className={[inWin && 'win', d === today && 'today'].filter(Boolean).join(' ')} onClick={() => onPick(d)}
            aria-label={`${DOWL[i]} ${formatDate(d).slice(0, 5)}`} aria-pressed={d === start}>
            {['L', 'M', 'X', 'J', 'V', 'S', 'D'][i]}<b>{+d.slice(8)}</b>
            <i aria-hidden="true">{ids.map((id) => <s key={id ?? '-'} style={materiaVars(materias.find((m) => m.id === id)?.color ?? '#b6bcc8')} />)}</i>
          </button>
        );
      })}
    </div>
  );
}
