import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { api, reloadAll, useApi, errMsg } from '../../../core/web/api.ts';
import { useBlock, useCore } from '../../../core/web/CoreContext.tsx';
import { vibrate } from '../../../core/web/haptics.ts';
import { isValidDate } from '../../../core/shared/dates.ts';
import { fmtDuration } from '../../../core/shared/duration.ts';
import { materiaVars } from '../../../core/web/MateriaChip.tsx';
import { TODO_CATEGORIES, type TodoCategory } from '../shared.ts';
import type { Subtask, TodoItem } from '../server/service.ts';
import { BookIcon, CheckIcon, CloseIcon, PlusIcon, UploadIcon } from '../../../core/web/icons.tsx';
import { Skeleton, ErrorState } from '../../../core/web/ui.tsx';
import { ReminderField } from '../../../core/web/ReminderField.tsx';
import { keepSearch } from './views.ts';
import './todo.css';

const PRESETS = [15, 30, 45, 60, 90];
const CAT_ICON: Record<TodoCategory, React.ReactNode> = { tarea: <CheckIcon />, entrega: <UploadIcon />, estudio: <BookIcon /> };

function Form({ item, embedded }: { item?: TodoItem; embedded?: boolean }) {
  const { materias, notify } = useCore();
  const { off, block } = useBlock();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const fecha = params.get('fecha');
  const volver = params.get('volver'); // ruta de origen (solo interna) // /todo/nueva?fecha=… (desde el detalle del calendario)
  const [title, setTitle] = useState(item?.title ?? '');
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [dueDate, setDueDate] = useState(item?.dueDate ?? (!item && isValidDate(fecha) ? fecha : ''));
  const [dueTime, setDueTime] = useState(item?.dueTime ?? '');
  const [materiaId, setMateriaId] = useState(item?.materiaId ?? '');
  const [category, setCategory] = useState<TodoCategory>(item?.category ?? 'tarea');
  const [durationMin, setDuration] = useState<number | null>(item?.durationMin ?? null);
  const [other, setOther] = useState(item?.durationMin != null && !PRESETS.includes(item.durationMin));
  const [reminder, setReminder] = useState({ min: item?.reminderMin ?? null, insistent: item?.reminderInsistent ?? false });
  const [subs, setSubs] = useState<Subtask[]>(item?.subtasks ?? []);
  const [newSub, setNewSub] = useState('');
  const [focusOther, setFocusOther] = useState(false); // foco en Minutos solo si recién se tocó "Otra…"
  const { search } = useLocation();
  const back = () => volver?.startsWith('/') && !volver.startsWith('//') ? nav(volver, { replace: true }) : nav({ pathname: '/todo', search: keepSearch(search) }, { replace: true });

  async function save(e: FormEvent) {
    e.preventDefault();
    if (block()) return;
    const body = {
      title, notes: notes.trim() || null, dueDate: dueDate || null, dueTime: dueDate && dueTime ? dueTime : null,
      materiaId: materiaId || null, category, durationMin, subtasks: cleanSubs(),
      reminderMin: dueDate ? reminder.min : null, reminderInsistent: !!dueDate && reminder.insistent,
    };
    try {
      if (item) await api('PATCH', `/api/todo/${item.id}`, body); else await api('POST', '/api/todo', body);
      back();
    } catch (err) { notify(errMsg(err)); }
  }
  // Las subtareas sin título (recién borrado el texto) se descartan al guardar.
  const cleanSubs = (list = subs) => list.filter((s) => s.title.trim());
  function addSub() {
    const t = newSub.trim();
    if (!t || subs.length >= 50) return;
    setSubs([...subs, { id: crypto.randomUUID(), title: t, done: false }]);
    setNewSub('');
  }
  // Tildar una subtarea se guarda al toque (sin "Guardar"); en una tarea nueva queda para cuando se guarde.
  async function toggleSub(id: string) {
    const next = subs.map((s) => (s.id === id ? { ...s, done: !s.done } : s));
    if (!item) { setSubs(next); return; }
    if (block()) return;
    setSubs(next);
    try { await api('PATCH', `/api/todo/${item.id}`, { subtasks: cleanSubs(next) }); reloadAll(); } catch (err) { setSubs(subs); notify(errMsg(err)); }
  }
  async function remove() {
    if (!item || block() || !confirm(`¿Borrar "${item.title}"?`)) return;
    try { await api('DELETE', `/api/todo/${item.id}`); vibrate('warn'); back(); } catch (err) { notify(errMsg(err)); }
  }
  // Las archivadas no se ofrecen, salvo la que ya tiene el ítem, para no perderla al guardar.
  const options = materias.filter((m) => !m.archived || m.id === item?.materiaId);

  return (
    <form className="form" onSubmit={save}>
      <label>Título
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required autoFocus={!item && !embedded} />
      </label>
      <div className="field" role="group" aria-label="Subtareas">
        <span>Subtareas{subs.length > 0 && ` · ${subs.filter((s) => s.done).length}/${subs.length}`}</span>
        {subs.map((s) => (
          <div key={s.id} className={s.done ? 'task-row done' : 'task-row'}>
            <button type="button" className="chk" role="checkbox" aria-checked={s.done} aria-label={`${s.done ? 'Destildar' : 'Completar'}: ${s.title}`} onClick={() => void toggleSub(s.id)}><span /></button>
            <input className="sub-title" value={s.title} maxLength={120} aria-label="Título de la subtarea"
              onChange={(e) => setSubs(subs.map((x) => (x.id === s.id ? { ...x, title: e.target.value } : x)))} />
            <button type="button" className="icon-btn" aria-label={`Borrar subtarea: ${s.title}`} onClick={() => setSubs(subs.filter((x) => x.id !== s.id))}><CloseIcon size={18} /></button>
          </div>
        ))}
        <div className="sub-add">
          <input value={newSub} onChange={(e) => setNewSub(e.target.value)} maxLength={120} placeholder="Agregar subtarea…" aria-label="Nueva subtarea" enterKeyHint="done"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSub(); } }} />
          <button type="button" className="icon-btn" aria-label="Agregar subtarea" onClick={addSub}><PlusIcon /></button>
        </div>
      </div>
      <div className="field" role="group" aria-label="Materia">
        <span>Materia</span>
        <div className="pills">
          <button type="button" className="pill" aria-pressed={materiaId === ''} onClick={() => setMateriaId('')}>Sin materia</button>
          {options.map((m) => (
            <button type="button" key={m.id} className="pill" style={materiaVars(m.color)} title={m.name} aria-pressed={materiaId === m.id}
              onClick={() => setMateriaId(m.id)}><span className="dot" aria-hidden="true" />&nbsp;{m.sigla}</button>
          ))}
        </div>
      </div>
      <div className="field" role="group" aria-label="Categoría">
        <span>Categoría</span>
        <div className="pills">
          {TODO_CATEGORIES.map((c) => (
            <button type="button" key={c.id} className="pill cat-pill" aria-pressed={category === c.id} onClick={() => setCategory(c.id)}>{CAT_ICON[c.id]}{c.label}</button>
          ))}
        </div>
      </div>
      <div className="field" role="group" aria-label="Duración estimada">
        <span>Duración estimada</span>
        <div className="pills">
          {PRESETS.map((m) => (
            <button type="button" key={m} className="pill" aria-pressed={!other && durationMin === m}
              onClick={() => { setOther(false); setDuration(durationMin === m ? null : m); }}>{fmtDuration(m)}</button>
          ))}
          <button type="button" className="pill" aria-pressed={other} onClick={() => { setOther(!other); setFocusOther(true); setDuration(null); }}>Otra…</button>
        </div>
        {other && (
          <input type="number" inputMode="numeric" min={1} max={1440} step={1} aria-label="Minutos" placeholder="Minutos" autoFocus={focusOther}
            value={durationMin ?? ''} onChange={(e) => setDuration(e.target.value ? Number(e.target.value) : null)} />
        )}
      </div>
      <div className="two">
        <label>Fecha
          <input type="date" value={dueDate} onChange={(e) => { setDueDate(e.target.value); if (!e.target.value) setDueTime(''); }} />
        </label>
        <label>Hora
          <input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} disabled={!dueDate} />
        </label>
      </div>
      <ReminderField value={reminder.min} insistent={reminder.insistent} disabled={!dueDate} onChange={(min, insistent) => setReminder({ min, insistent })} />
      <label>Notas
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
      </label>
      <div className="row">
        {item && <button type="button" className="btn danger" onClick={remove} aria-disabled={off}>Borrar</button>}
        <button type="button" className="btn" onClick={back}>Cancelar</button>
        <button className="btn primary" aria-disabled={off}>Guardar</button>
      </div>
    </form>
  );
}

export function TodoEditPage({ embedded }: { embedded?: boolean }) {
  const { id } = useParams();
  const { data, error, loading, reload } = useApi<TodoItem>(id ? `/api/todo/${id}` : null);
  return (
    <div className="card todo-edit">
      <div className="card-head"><h3>{id ? 'Editar tarea' : 'Nueva tarea'}</h3>{!embedded && <Link className="icon-btn" aria-label="Cerrar" to={{ pathname: "/todo", search: keepSearch(useLocation().search) }} replace><CloseIcon /></Link>}</div>
      {id && loading && !data && <div className="form" role="status" aria-label="Cargando"><Skeleton h={44} /><Skeleton w="40%" /><Skeleton h={44} /><Skeleton h={44} /></div>}
      {id && error && <ErrorState error={error} onRetry={reload} />}
      {(!id || data?.id === id) && <Form key={id ?? 'nueva'} item={data} embedded={embedded} />}
    </div>
  );
}
