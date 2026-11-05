import { Link } from 'react-router';
import type { ReactNode } from 'react';
import { useApi } from '../../../core/web/api.ts';
import { useCore } from '../../../core/web/CoreContext.tsx';
import { materiaVars } from '../../../core/web/MateriaChip.tsx';
import { addDays, formatDate, todayAR, weekdayOf } from '../../../core/shared/dates.ts';
import { fmtDuration } from '../../../core/shared/duration.ts';
import type { AgendaData } from './summary.ts';
import { cellLevel, countdownLabel, daysUntil, examColor, examWhat, nextExams, weekSummary, whenLabel } from './summary.ts';
import { KIND_LABELS } from './views.ts';
import './calendar.css';

const LETTER = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const DOW = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const dm = (d: string) => formatDate(d).slice(0, 5);

/** Tarjeta de Inicio con encabezado, carga y error con "Reintentar". */
function useCard(path: string, title: string, className: string) {
  const { data, error, reload } = useApi<AgendaData>(path);
  const wrap = (body: ReactNode, link = '/calendario?vista=mes') => (
    <section className={`card ${className}`}><div className="card-head"><h3>{title}</h3><Link to={link}>Calendario</Link></div>{body}</section>
  );
  const state = error && !data
    ? wrap(<p className="error" role="alert">{error.message} <button className="btn" onClick={reload}>Reintentar</button></p>)
    : !data ? wrap(<p className="muted">Cargando…</p>) : null;
  return { data, state, wrap };
}

export function ExamCard() {
  const { materias } = useCore();
  const today = todayAR();
  const { data, state, wrap } = useCard(`/api/calendar/agenda?from=${today}&to=${addDays(today, 120)}`, 'Próximo examen', 'exam-card');
  if (state || !data) return state;
  const [next, after] = nextExams(data.events, today);
  if (!next) return wrap(<p className="muted">Sin exámenes en los próximos 4 meses.</p>);

  const what = (o: typeof next) => examWhat(KIND_LABELS[o.kind], materias.find((m) => m.id === o.materiaId)?.name);
  const n = daysUntil(today, next.occurrenceDate);
  const row = n <= 28 ? weekSummary(data, today, n + 1).find((r) => r.materiaId === next.materiaId) : undefined;
  const dates = Array.from({ length: n + 1 }, (_, i) => addDays(today, i));
  const c = examColor(materias, next.materiaId);
  const nextC = after && examColor(materias, after.materiaId);
  return wrap(<>
    <div className="countdown" style={materiaVars(c.pastel)}><strong>{countdownLabel(n)}</strong></div>
    <div className="what">{what(next)}</div>
    <div className="when">{DOW[weekdayOf(next.occurrenceDate) - 1]} {dm(next.occurrenceDate)}, {next.startTime ?? 'todo el día'}</div>
    {n <= 28 && <div style={materiaVars(c.pastel)}>
      <div className="ruler">{dates.map((d, i) => {
        const p = row?.perDay[i];
        return <b key={d} className={`${i === n ? 'exam' : ''} ${i === 0 ? 'today' : ''}`} data-l={p ? cellLevel(p) : 0} title={dm(d)} />;
      })}</div>
      <div className="ruler-days">{dates.map((d) => <span key={d}>{LETTER[weekdayOf(d) - 1]}</span>)}</div>
    </div>}
    {after && nextC && <div className="then" style={materiaVars(nextC.pastel)}><span className="dot" />Después: {what(after).replace(/^./, (c) => c.toLowerCase())} {whenLabel(daysUntil(today, after.occurrenceDate))}</div>}
  </>, `/calendario?vista=mes&fecha=${next.occurrenceDate}&dia=${next.occurrenceDate}`);
}

export function WeekCard() {
  const { materias } = useCore();
  const today = todayAR();
  const from = addDays(today, 1);
  const { data, state, wrap } = useCard(`/api/calendar/agenda?from=${from}&to=${addDays(from, 6)}`, 'Próximos 7 días', '');
  if (state || !data) return state;
  const rows = weekSummary(data, from, 7);
  if (!rows.length) return wrap(<p className="muted">Nada en los próximos 7 días.</p>);

  const dates = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  return wrap(<>
    <div className="week-head"><span /><div className="ruler-days" style={{ margin: '0 0 4px' }}>{dates.map((d) => <span key={d}>{LETTER[weekdayOf(d) - 1]} {+d.slice(8)}</span>)}</div><span /></div>
    {rows.map((r) => {
      const c = examColor(materias, r.materiaId);
      return (
        <Link key={r.materiaId ?? 'none'} className="week-row" to={`/calendario?vista=semana&fecha=${from}`} style={materiaVars(c.pastel)}>
          <div className="name"><span className="dot" />{materias.find((m) => m.id === r.materiaId)?.name ?? 'Sin materia'}</div>
          <div className="ruler">{r.perDay.map((p, i) => <b key={dates[i]} className={p.exam ? 'exam' : ''} data-l={cellLevel(p)} />)}</div>
          <div className="tot">{r.count}{r.minutes ? ` · ${fmtDuration(r.minutes)}` : ''}</div>
        </Link>
      );
    })}
  </>);
}
