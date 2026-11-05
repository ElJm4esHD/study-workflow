import { useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { api, ApiError, useApi } from '../../../core/web/api.ts';
import { useCore } from '../../../core/web/CoreContext.tsx';
import { todayAR, weekdayOf } from '../../../core/shared/dates.ts';
import type { CalendarEvent, EventInput } from '../server/service.ts';
import { KIND_LABELS } from './views.ts';
import './calendar.css';

const msg = (e: unknown) => (e instanceof ApiError ? e.message : 'Algo salió mal.');
const DAYS = [[1, 'L', 'lunes'], [2, 'M', 'martes'], [3, 'X', 'miércoles'], [4, 'J', 'jueves'], [5, 'V', 'viernes'], [6, 'S', 'sábado'], [7, 'D', 'domingo']] as const;

function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange(v: boolean): void }) {
  return (
    <label className="cal-check">{label}
      <span className="switch">
        <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="track" aria-hidden="true" />
      </span>
    </label>
  );
}

function Form({ item, ocurrencia }: { item?: CalendarEvent; ocurrencia: string | null }) {
  const { materias, notify } = useCore();
  const nav = useNavigate();
  const [q] = useSearchParams();
  const isSeries = !!item?.repeatWeekdays;
  // Una serie se edita desde una ocurrencia: el formulario arranca con la fecha de esa ocurrencia.
  const date0 = (isSeries && ocurrencia) || item?.startDate || q.get('fecha') || todayAR();
  const [title, setTitle] = useState(item?.title ?? '');
  const [kind, setKind] = useState(item?.kind ?? 'evento');
  const [materiaId, setMateriaId] = useState(item?.materiaId ?? '');
  const [allDay, setAllDay] = useState(item?.allDay ?? false);
  const [startDate, setStartDate] = useState(date0);
  const [startTime, setStartTime] = useState(item ? (item.startTime ?? '') : (q.get('hora') ?? '09:00'));
  const [endDate, setEndDate] = useState(isSeries ? date0 : (item?.endDate ?? date0));
  const [endTime, setEndTime] = useState(item?.endTime ?? '');
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [repeat, setRepeat] = useState(isSeries);
  const [weekdays, setWeekdays] = useState<number[]>(item?.repeatWeekdays ?? []);
  const [until, setUntil] = useState(item?.repeatUntil ?? '');
  const rep0 = useRef({ repeat, weekdays: weekdays.join(), until });
  const [action, setAction] = useState<'save' | 'delete'>('save');
  const dlg = useRef<HTMLDialogElement>(null);
  // Sin ocurrencia no hay nada que separar: se edita la serie directo.
  const asksScope = isSeries && !!ocurrencia;
  // Si se tocó la repetición, el cambio solo tiene sentido para toda la serie: no se pregunta.
  const repChanged = repeat !== rep0.current.repeat || weekdays.join() !== rep0.current.weekdays || until !== rep0.current.until;
  const back = () => (window.history.state?.idx > 0 ? nav(-1) : nav('/calendario', { replace: true }));
  const url = `/api/calendar/events/${item?.id}`;
  const options = materias.filter((m) => !m.archived || m.id === item?.materiaId);

  const body = (series: boolean): EventInput => ({
    title, kind, materiaId: materiaId || null, allDay, startDate,
    startTime: allDay ? null : startTime || null, endDate: series || ocurrencia ? startDate : endDate,
    endTime: allDay ? null : endTime || null, notes: notes.trim() || null,
    repeatWeekdays: series ? weekdays : null, repeatUntil: series ? until || null : null,
  });

  async function run(fn: () => Promise<unknown>) {
    try { await fn(); back(); } catch (err) { notify(msg(err)); }
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    if (asksScope && repChanged) { run(() => api('PATCH', url, seriesPatch())); return; }
    if (asksScope) { setAction('save'); dlg.current?.showModal(); return; }
    run(() => {
      const b = body(repeat);
      if (item) return api('PATCH', url, b);
      return api('POST', '/api/calendar/events', b);
    });
  }
  function remove() {
    if (asksScope) { setAction('delete'); dlg.current?.showModal(); return; }
    if (confirm(`¿Borrar "${item!.title}"?`)) run(() => api('DELETE', url));
  }
  // Toda la serie: la fecha solo se manda si el usuario la cambió (si no, correría el inicio de la serie a la ocurrencia).
  function seriesPatch() {
    const { startDate: s, endDate: _e, ...rest } = body(repeat);
    return s === ocurrencia ? rest : { ...rest, startDate: s, endDate: repeat ? s : endDate };
  }
  function scoped(solo: boolean) {
    dlg.current?.close();
    const occ = `${url}/occurrences/${ocurrencia}`;
    run(() => {
      if (action === 'delete') return api('DELETE', solo ? occ : url);
      if (solo) return api('PUT', occ, body(false));
      return api('PATCH', url, seriesPatch());
    });
  }
  function toggleDay(d: number) {
    setWeekdays((w) => (w.includes(d) ? (w.length > 1 ? w.filter((x) => x !== d) : w) : [...w, d].sort()));
  }

  return (
    <>
      <form className="card form" onSubmit={submit}>
        <label>Título
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required autoFocus={!item} />
        </label>
        <label>Tipo
          <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            {Object.entries(KIND_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        <label>Materia
          <select value={materiaId} onChange={(e) => setMateriaId(e.target.value)}>
            <option value="">Sin materia</option>
            {options.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </label>
        <Switch label="Todo el día" checked={allDay} onChange={setAllDay} />
        <label>Fecha de inicio
          <input type="date" value={startDate} required
            onChange={(e) => { setStartDate(e.target.value); if (endDate < e.target.value) setEndDate(e.target.value); }} />
        </label>
        {!allDay && (
          <label>Hora de inicio
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
          </label>
        )}
        {!repeat && (
          <label>Fecha de fin
            <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} required />
          </label>
        )}
        {!allDay && (
          <label>Hora de fin
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </label>
        )}
        <label>Notas
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        </label>
        <Switch label="Repetir semanalmente" checked={repeat}
          onChange={(v) => { setRepeat(v); if (v && !weekdays.length) setWeekdays([weekdayOf(startDate)]); }} />
        {repeat && (
          <>
            <div className="cal-days" role="group" aria-label="Días de repetición">
              {DAYS.map(([d, short, long]) => (
                <button type="button" key={d} className="cal-day" aria-pressed={weekdays.includes(d)} aria-label={long} onClick={() => toggleDay(d)}>{short}</button>
              ))}
            </div>
            <label>Hasta (opcional)
              <input type="date" value={until} min={startDate} onChange={(e) => setUntil(e.target.value)} />
            </label>
          </>
        )}
        <div className="row">
          {item && <button type="button" className="btn danger" onClick={remove}>Borrar</button>}
          <button type="button" className="btn" onClick={back}>Cancelar</button>
          <button className="btn primary">Guardar</button>
        </div>
      </form>
      <dialog ref={dlg} className="cal-dialog" aria-labelledby="cal-scope">
        <h2 id="cal-scope">¿Solo este evento o toda la serie?</h2>
        <div className="row">
          <button className="btn" onClick={() => dlg.current?.close()}>Cancelar</button>
          <button className="btn" onClick={() => scoped(true)}>Solo este</button>
          <button className="btn primary" onClick={() => scoped(false)}>Toda la serie</button>
        </div>
      </dialog>
    </>
  );
}

export function EventEditPage() {
  const { id } = useParams();
  const [q] = useSearchParams();
  const { data, error, loading, reload } = useApi<CalendarEvent>(id ? `/api/calendar/events/${id}` : null);
  return (
    <>
      <h1>{id ? 'Editar evento' : 'Nuevo evento'}</h1>
      {id && loading && <p className="muted">Cargando…</p>}
      {id && error && <p className="error" role="alert">{error.message} <button className="btn" onClick={reload}>Reintentar</button></p>}
      {(!id || data) && <Form item={data} ocurrencia={q.get('ocurrencia')} />}
    </>
  );
}
