import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { api, errMsg } from '../../../core/web/api.ts';
import { useBlock, useCore } from '../../../core/web/CoreContext.tsx';
import { materiaVars } from '../../../core/web/MateriaChip.tsx';
import { addDays, formatDate, weekdayOf } from '../../../core/shared/dates.ts';
import { NEUTRAL } from '../../../core/shared/palette.ts';
import { CheckIcon, PlusIcon } from '../../../core/web/icons.tsx';
import { vibrate } from '../../../core/web/haptics.ts';
import type { TodoItem } from '../../todo/server/service.ts';
import { EXAM_KINDS } from '../shared.ts';
import { DOWL, eventHref } from './DayDetail.tsx';
import type { AgendaData } from './summary.ts';
import { KIND_LABELS } from './views.ts';
import { dayItems, hourRange, type Timed } from './week.ts';

const DOW = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const nowFmt = new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', hour12: false });
const nowMin = () => { const [h, m] = nowFmt.format(new Date()).split(':'); return +h! % 24 * 60 + +m!; };

function useNow() {
  const [n, setN] = useState(nowMin);
  useEffect(() => { const t = setInterval(() => setN(nowMin()), 60_000); return () => clearInterval(t); }, []);
  return n;
}

/** Vista Semana: grilla horaria propia (como Mes). Celu: 3 días desde `start`; compu: 7 desde el lunes. */
export function WeekView({ start, days: n, today, data, reload, onDay }: {
  start: string; days: number; today: string; data: AgendaData; reload(): void; onDay(d: string): void;
}) {
  const { materias, notify } = useCore();
  const { block } = useBlock();
  const nav = useNavigate();
  const now = useNow();
  const [ghost, setGhost] = useState<{ d: string; m: number } | null>(null);
  const scrolled = useRef(false);
  const target = useRef<HTMLDivElement>(null);

  const dates = Array.from({ length: n }, (_, i) => addDays(start, i));
  const items = useMemo(() => dates.map((d) => dayItems(data, d)), [data, start, n]); // eslint-disable-line react-hooks/exhaustive-deps
  const [h0, h1] = hourRange(items);
  const mat = (id: string | null) => materias.find((m) => m.id === id);
  const vars = (id: string | null) => materiaVars(mat(id)?.color ?? NEUTRAL.hex);
  const cap = n > 3 ? 3 : 2;
  const showsToday = dates.includes(today);

  // Al abrir, la grilla arranca en la hora actual (o a las 8 si hoy no está a la vista).
  useLayoutEffect(() => {
    if (scrolled.current || !target.current) return;
    scrolled.current = true;
    target.current.scrollIntoView({ block: 'center' });
  });
  useEffect(() => setGhost(null), [start]);

  async function toggle(t: TodoItem) {
    vibrate(t.completed ? 'tick' : 'success');
    try { await api('PATCH', `/api/todo/${t.id}`, { completed: !t.completed }); } catch (e) { notify(errMsg(e)); }
    reload();
  }
  function tapSlot(d: string, e: React.MouseEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return;
    const y = e.nativeEvent.offsetY / e.currentTarget.clientHeight;
    const m = Math.min(h1 * 60 - 30, h0 * 60 + Math.floor((y * (h1 - h0) * 60) / 30) * 30);
    setGhost(ghost?.d === d && ghost.m === m ? null : { d, m });
  }
  function create() {
    if (!ghost || block()) return;
    nav(`/calendario/evento/nuevo?${new URLSearchParams({ fecha: ghost.d, hora: hhmm(ghost.m) })}`);
  }

  const pos = (from: number, to: number) => ({ top: `calc(${(from - h0 * 60) / 60} * var(--hh) + 1px)`, height: `calc(${(to - from) / 60} * var(--hh) - 3px)` });
  function block_(t: Timed) {
    const style = { ...pos(Math.max(t.from, h0 * 60), t.to), left: `calc(${(t.lane / t.lanes) * 100}% + 2px)`, width: `calc(${100 / t.lanes}% - 4px)` };
    const short = t.to - t.from < 45;
    if (t.todo) {
      const td = t.todo;
      return (
        <div key={t.key} className={`wk-ev task${td.completed ? ' done' : ''}${short ? ' short' : ''}`} style={{ ...vars(td.materiaId), ...style }}>
          <button type="button" className="wk-box" aria-label={`${td.completed ? 'Destildar' : 'Completar'}: ${td.title}`} aria-pressed={td.completed} onClick={() => void toggle(td)}>
            {td.completed && <CheckIcon size={10} />}
          </button>
          <Link to={`/todo/${td.id}`}><b>{td.title}</b><small>{hhmm(t.from)}</small></Link>
        </div>
      );
    }
    const o = t.occ!;
    const exam = EXAM_KINDS.includes(o.kind);
    return (
      <Link key={t.key} to={eventHref(o)} className={`wk-ev${exam ? ' exam' : ''}${short ? ' short' : ''}`} style={{ ...vars(o.materiaId), ...style }}>
        {exam && <span className="wk-tag">{KIND_LABELS[o.kind]}</span>}
        <b>{o.title}</b><small>{hhmm(t.from)}{t.to - t.from >= 60 ? ` – ${hhmm(t.to)}` : ''}</small>
      </Link>
    );
  }

  return (
    <div className="wk" style={{ ['--n' as string]: n }}>
      <div className="wk-top">
        <div className="wk-head">
          <span />
          {dates.map((d) => (
            <button key={d} type="button" className={d === today ? 'today' : undefined} onClick={() => onDay(d)}
              aria-label={`${DOWL[weekdayOf(d) - 1]} ${formatDate(d).slice(0, 5)}: ver el día`}>
              {DOW[weekdayOf(d) - 1]}<b>{+d.slice(8)}</b>
            </button>
          ))}
        </div>
        <div className="wk-allday">
          <span className="wk-lbl">Todo el día</span>
          {items.map(({ allDay }, i) => (
            <div key={dates[i]}>
              {allDay.slice(0, cap).map(({ key, occ, todo }) => occ ? (
                <Link key={key} to={eventHref(occ)} className={`wk-chip${EXAM_KINDS.includes(occ.kind) ? ' exam' : ''}`} style={vars(occ.materiaId)}>
                  <span>{EXAM_KINDS.includes(occ.kind) ? `${KIND_LABELS[occ.kind]} · ` : ''}{occ.title}</span>
                </Link>
              ) : (
                <span key={key} className={`wk-chip task${todo!.completed ? ' done' : ''}`} style={vars(todo!.materiaId)}>
                  <button type="button" className="wk-box" aria-label={`${todo!.completed ? 'Destildar' : 'Completar'}: ${todo!.title}`} aria-pressed={todo!.completed} onClick={() => void toggle(todo!)}>
                    {todo!.completed && <CheckIcon size={10} />}
                  </button>
                  <Link to={`/todo/${todo!.id}`}>{todo!.title}</Link>
                </span>
              ))}
              {allDay.length > cap && <button type="button" className="wk-more" onClick={() => onDay(dates[i]!)}>+{allDay.length - cap} más</button>}
            </div>
          ))}
        </div>
      </div>
      <div className="wk-body" style={{ height: `calc(${h1 - h0} * var(--hh))`, ['--h0' as string]: h0 }}>
        <div className="wk-hours" aria-hidden="true">
          {Array.from({ length: h1 - h0 - 1 }, (_, i) => <span key={i} style={{ top: `calc(${i + 1} * var(--hh))` }}>{h0 + i + 1}</span>)}
        </div>
        {dates.map((d, i) => (
          <div key={d} className={d === today ? 'wk-col today' : 'wk-col'} onClick={(e) => tapSlot(d, e)}>
            {items[i]!.timed.filter((t) => t.to > h0 * 60).map(block_)}
            {d === today && now >= h0 * 60 && now < h1 * 60 && (
              <div className="wk-now" style={{ top: `calc(${(now - h0 * 60) / 60} * var(--hh))` }} ref={target}><span>{hhmm(now)}</span></div>
            )}
            {ghost?.d === d && (
              <button type="button" className="wk-ghost" style={pos(ghost.m, ghost.m + 60)} onClick={create} autoFocus>
                <PlusIcon size={14} />{hhmm(ghost.m)}
              </button>
            )}
          </div>
        ))}
        {!showsToday && <div ref={target} className="wk-anchor" style={{ top: `calc(${Math.max(0, 12 - h0)} * var(--hh))` }} />}
      </div>
    </div>
  );
}
