import { Link } from 'react-router';
import { api, ApiError, useApi } from '../../../core/web/api.ts';
import { useCore } from '../../../core/web/CoreContext.tsx';
import { materiaVars } from '../../../core/web/MateriaChip.tsx';
import { formatDate, todayAR } from '../../../core/shared/dates.ts';
import { fmtDuration } from '../../../core/shared/duration.ts';
import type { TodoItem } from '../server/service.ts';
import { groupMinutes, hoyCardData } from './views.ts';
import './todo.css';

export function HoyCard() {
  const { materias, notify } = useCore();
  const { data, error, reload } = useApi<TodoItem[]>('/api/todo');
  const today = todayAR();

  async function toggle(i: TodoItem) {
    try { await api('PATCH', `/api/todo/${i.id}`, { completed: !i.completed }); } catch (e) { notify(e instanceof ApiError ? e.message : 'Algo salió mal.'); }
    reload();
  }

  const row = (i: TodoItem) => {
    const m = materias.find((x) => x.id === i.materiaId);
    const late = i.dueDate !== null && i.dueDate < today;
    return (
      <li key={i.id} className="task-row" style={m ? materiaVars(m.color) : undefined}>
        <button type="button" className="chk" onClick={() => void toggle(i)} aria-label={`Completar: ${i.title}`}><span /></button>
        <Link to={`/todo/${i.id}`} className="body">
          <div className="title">{i.title}</div>
          <div className="meta">
            {m && <span className="chip">{m.sigla}</span>}
            {late && <span className="tag late">venció {formatDate(i.dueDate!).slice(0, 5)}</span>}
            {i.dueTime && <span className="tag">{i.dueTime}</span>}
          </div>
        </Link>
        <span className="dur">{i.durationMin ? fmtDuration(i.durationMin) : ''}</span>
      </li>
    );
  };

  const head = <div className="card-head"><h3>Hoy</h3><Link to="/todo?vista=hoy">To-do</Link></div>;
  if (error && !data) return <section className="card">{head}<p className="error" role="alert">{error.message} <button className="btn" onClick={reload}>Reintentar</button></p></section>;
  if (!data) return <section className="card">{head}<p className="muted">Cargando…</p></section>;

  const { late, lateMore, today: now } = hoyCardData(data, today);
  const all = data.filter((i) => i.dueDate === today);
  const left = groupMinutes(now), tot = groupMinutes(all);
  return (
    <section className="card">
      {head}
      {(tot.minutes > 0 || tot.unestimated > 0) && (
        <p className="hoy-sub">{fmtDuration(left.minutes)} pendientes de {fmtDuration(tot.minutes)}{tot.unestimated > 0 && `, ${tot.unestimated} sin estimar`}</p>
      )}
      {late.length + now.length === 0 && <p className="muted">Nada pendiente para hoy.</p>}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {late.map(row)}
        {lateMore > 0 && <li><Link to="/todo?vista=hoy" className="hoy-more">Ver {lateMore} más</Link></li>}
        {now.map(row)}
      </ul>
    </section>
  );
}
