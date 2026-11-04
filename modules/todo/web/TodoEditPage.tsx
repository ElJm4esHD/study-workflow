import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { api, ApiError, useApi } from '../../../core/web/api.ts';
import { useCore } from '../../../core/web/CoreContext.tsx';
import type { TodoItem } from '../server/service.ts';
import './todo.css';

const msg = (e: unknown) => (e instanceof ApiError ? e.message : 'Algo salió mal.');

function Form({ item }: { item?: TodoItem }) {
  const { materias, notify } = useCore();
  const nav = useNavigate();
  const [title, setTitle] = useState(item?.title ?? '');
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [dueDate, setDueDate] = useState(item?.dueDate ?? '');
  const [dueTime, setDueTime] = useState(item?.dueTime ?? '');
  const [materiaId, setMateriaId] = useState(item?.materiaId ?? '');
  const back = () => nav('/todo', { replace: true });

  async function save(e: FormEvent) {
    e.preventDefault();
    const body = { title, notes: notes.trim() || null, dueDate: dueDate || null, dueTime: dueDate && dueTime ? dueTime : null, materiaId: materiaId || null };
    try {
      if (item) await api('PATCH', `/api/todo/${item.id}`, body); else await api('POST', '/api/todo', body);
      back();
    } catch (err) { notify(msg(err)); }
  }
  async function remove() {
    if (!item || !confirm(`¿Borrar "${item.title}"?`)) return;
    try { await api('DELETE', `/api/todo/${item.id}`); back(); } catch (err) { notify(msg(err)); }
  }
  // Las archivadas no se ofrecen, salvo la que ya tiene el ítem, para no perderla al guardar.
  const options = materias.filter((m) => !m.archived || m.id === item?.materiaId);

  return (
    <form className="card form" onSubmit={save}>
      <label>Título
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required autoFocus={!item} />
      </label>
      <label>Notas
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
      </label>
      <label>Fecha
        <input type="date" value={dueDate} onChange={(e) => { setDueDate(e.target.value); if (!e.target.value) setDueTime(''); }} />
      </label>
      <label>Hora
        <input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} disabled={!dueDate} />
      </label>
      <label>Materia
        <select value={materiaId} onChange={(e) => setMateriaId(e.target.value)}>
          <option value="">Sin materia</option>
          {options.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </label>
      <div className="row">
        {item && <button type="button" className="btn danger" onClick={remove}>Borrar</button>}
        <button type="button" className="btn" onClick={back}>Cancelar</button>
        <button className="btn primary">Guardar</button>
      </div>
    </form>
  );
}

export function TodoEditPage() {
  const { id } = useParams();
  const { data, error, loading, reload } = useApi<TodoItem>(id ? `/api/todo/${id}` : null);
  return (
    <>
      <h1>{id ? 'Editar tarea' : 'Nueva tarea'}</h1>
      {id && loading && <p className="muted">Cargando…</p>}
      {id && error && <p className="error" role="alert">{error.message} <button className="btn" onClick={reload}>Reintentar</button></p>}
      {(!id || data) && <Form item={data} />}
    </>
  );
}
