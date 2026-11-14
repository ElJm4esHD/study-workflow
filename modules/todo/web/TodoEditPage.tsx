import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { api, ApiError, useApi } from '../../../core/web/api.ts';
import { useBlock, useCore } from '../../../core/web/CoreContext.tsx';
import { isValidDate } from '../../../core/shared/dates.ts';
import { fmtDuration } from '../../../core/shared/duration.ts';
import { materiaVars } from '../../../core/web/MateriaChip.tsx';
import { TODO_CATEGORIES, type TodoCategory } from '../shared.ts';
import type { TodoItem } from '../server/service.ts';
import { keepSearch } from './views.ts';
import './todo.css';

const PRESETS = [15, 30, 45, 60, 90];
const msg = (e: unknown) => (e instanceof ApiError ? e.message : 'Algo salió mal.');

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
  const [focusOther, setFocusOther] = useState(false); // foco en Minutos solo si recién se tocó "Otra…"
  const { search } = useLocation();
  const back = () => volver?.startsWith('/') && !volver.startsWith('//') ? nav(volver, { replace: true }) : nav({ pathname: '/todo', search: keepSearch(search) }, { replace: true });

  async function save(e: FormEvent) {
    e.preventDefault();
    if (block()) return;
    const body = {
      title, notes: notes.trim() || null, dueDate: dueDate || null, dueTime: dueDate && dueTime ? dueTime : null,
      materiaId: materiaId || null, category, durationMin,
    };
    try {
      if (item) await api('PATCH', `/api/todo/${item.id}`, body); else await api('POST', '/api/todo', body);
      back();
    } catch (err) { notify(msg(err)); }
  }
  async function remove() {
    if (!item || block() || !confirm(`¿Borrar "${item.title}"?`)) return;
    try { await api('DELETE', `/api/todo/${item.id}`); back(); } catch (err) { notify(msg(err)); }
  }
  // Las archivadas no se ofrecen, salvo la que ya tiene el ítem, para no perderla al guardar.
  const options = materias.filter((m) => !m.archived || m.id === item?.materiaId);

  return (
    <form className="form" onSubmit={save}>
      <label>Título
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required autoFocus={!item && !embedded} />
      </label>
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
            <button type="button" key={c.id} className="pill" aria-pressed={category === c.id} onClick={() => setCategory(c.id)}>{c.label}</button>
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
    <div className="card">
      <div className="card-head"><h3>{id ? 'Editar tarea' : 'Nueva tarea'}</h3>{!embedded && <Link to={{ pathname: "/todo", search: keepSearch(useLocation().search) }} replace>Cerrar</Link>}</div>
      {id && loading && !data && <p className="muted">Cargando…</p>}
      {id && error && <p className="error" role="alert">{error.message} <button className="btn" onClick={reload}>Reintentar</button></p>}
      {(!id || data?.id === id) && <Form key={id ?? 'nueva'} item={data} embedded={embedded} />}
    </div>
  );
}
