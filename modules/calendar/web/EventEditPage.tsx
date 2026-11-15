import { useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { api, reloadAll, useApi, errMsg } from '../../../core/web/api.ts';
import { useBlock, useCore } from '../../../core/web/CoreContext.tsx';
import { materiaVars } from '../../../core/web/MateriaChip.tsx';
import { todayAR, weekdayOf } from '../../../core/shared/dates.ts';
import type { CalendarEvent, EventInput } from '../server/service.ts';
import { KIND_LABELS } from './views.ts';
import { KIND_ICON } from './DayDetail.tsx';
import { PageHeader, Skeleton, ErrorState } from '../../../core/web/ui.tsx';
import { ReminderField } from '../../../core/web/ReminderField.tsx';
import { DateField, TimeField } from '../../../core/web/DateTime.tsx';
import { firstInvalid, useSubmit } from '../../../core/web/useSubmit.ts';
import { useUnsaved } from '../../../core/web/useUnsaved.tsx';
import './calendar.css';

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
  const { off, block } = useBlock();
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
  const [reminder, setReminder] = useState({ min: item?.reminderMin ?? null, insistent: item?.reminderInsistent ?? false });
  const [repeat, setRepeat] = useState(isSeries);
  const [weekdays, setWeekdays] = useState<number[]>(item?.repeatWeekdays ?? []);
  const [until, setUntil] = useState(item?.repeatUntil ?? '');
  const sub = useSubmit();
  const snap = () => JSON.stringify([title, kind, materiaId, allDay, startDate, startTime, endDate, endTime, notes, reminder, repeat, weekdays, until]);
  const init = useRef(snap());
  const unsaved = useUnsaved(snap() !== init.current);
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
    reminderMin: reminder.min, reminderInsistent: reminder.insistent,
  });

  async function run(fn: () => Promise<unknown>) {
    if (block()) return;
    if (await sub.run(fn)) { unsaved.release(); back(); }
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (block()) return;
    const bad = firstInvalid(e.currentTarget);
    if (bad) { sub.fail(bad); return; }
    if (asksScope && repChanged) { run(() => api('PATCH', url, seriesPatch())); return; }
    if (asksScope) { setAction('save'); dlg.current?.showModal(); return; }
    run(() => {
      const b = body(repeat);
      if (item) return api('PATCH', url, b);
      return api('POST', '/api/calendar/events', b);
    });
  }
  function remove() {
    if (block()) return;
    if (asksScope) { setAction('delete'); dlg.current?.showModal(); return; }
    // Sin pregunta: avisa y deja "Deshacer", que lo vuelve a crear.
    void sub.run(() => api('DELETE', url)).then((ok) => {
      if (!ok) return;
      unsaved.release(); back();
      notify(`Evento borrado: ${item!.title}`, () => { api('POST', '/api/calendar/events', body(isSeries)).then(() => reloadAll()).catch((e) => notify(errMsg(e))); });
    });
  }
  // Toda la serie: la fecha solo se manda si el usuario la cambió (si no, correría el inicio de la serie a la ocurrencia).
  function seriesPatch() {
    const { startDate: s, endDate: _e, ...rest } = body(repeat);
    // Sin repetición la serie pasa a ser un evento común: se manda la fecha y el fin elegidos.
    if (!repeat) return { ...rest, startDate: s, endDate };
    return s === ocurrencia ? rest : { ...rest, startDate: s, endDate: s };
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
      <form className="card form cal-form" onSubmit={submit} noValidate>
        {unsaved.dialog}
        <label>Título
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required pattern=".*S.*" autoFocus={!item} />
        </label>
        <div className="cal-field" role="group" aria-label="Tipo">
          <span>Tipo</span>
          <div className="pills">
            {(Object.entries(KIND_LABELS) as [typeof kind, string][]).map(([k, l]) => (
              <button type="button" key={k} className="pill kind-pill" aria-pressed={kind === k} onClick={() => setKind(k)}>{(() => { const I = KIND_ICON[k]; return <I />; })()}{l}</button>
            ))}
          </div>
        </div>
        <div className="cal-field" role="group" aria-label="Materia">
          <span>Materia</span>
          <div className="pills">
            <button type="button" className="pill" aria-pressed={materiaId === ''} onClick={() => setMateriaId('')}>Sin materia</button>
            {options.map((m) => (
              <button type="button" key={m.id} className="pill" style={materiaVars(m.color)} title={m.name} aria-pressed={materiaId === m.id}
                onClick={() => setMateriaId(m.id)}><span className="dot" aria-hidden="true" />&nbsp;{m.sigla}</button>
            ))}
          </div>
        </div>
        <Switch label="Todo el día" checked={allDay} onChange={setAllDay} />
        <DateField label="Fecha de inicio" value={startDate} required
          onChange={(v) => { setStartDate(v); if (v && endDate < v) setEndDate(v); }} />
        {!allDay && <TimeField label="Hora de inicio" value={startTime} onChange={setStartTime} required />}
        {!repeat && <DateField label="Fecha de fin" value={endDate} min={startDate} onChange={setEndDate} required />}
        {!allDay && <TimeField label="Hora de fin (opcional)" value={endTime} onChange={setEndTime} />}
        <ReminderField value={reminder.min} insistent={reminder.insistent} onChange={(min, insistent) => setReminder({ min, insistent })} />
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
            <DateField label="Repetir hasta (opcional)" value={until} min={startDate} onChange={setUntil} />
          </>
        )}
        {sub.error && <p className="error" role="alert">{sub.error}</p>}
        <div className="row">
          {item && <button type="button" className="btn danger" onClick={remove} aria-disabled={off} disabled={sub.saving}>Borrar</button>}
          <button type="button" className="btn" onClick={back}>Cancelar</button>
          <button className="btn primary" aria-disabled={off} disabled={sub.saving}>{sub.saving ? 'Guardando…' : 'Guardar'}</button>
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
      <PageHeader title={id ? 'Editar evento' : 'Nuevo evento'} />
      {id && loading && <div className="card form" role="status" aria-label="Cargando"><Skeleton h={44} /><Skeleton w="50%" /><Skeleton h={44} /><Skeleton h={44} /></div>}
      {id && error && <ErrorState error={error} onRetry={reload} />}
      {(!id || data) && <Form item={data} ocurrencia={q.get('ocurrencia')} />}
    </>
  );
}
