import { Link } from 'react-router';
import { AnimatePresence, m } from 'motion/react';
import { api, ApiError, useApi } from '../../../core/web/api.ts';
import { useCore } from '../../../core/web/CoreContext.tsx';
import { materiaVars } from '../../../core/web/MateriaChip.tsx';
import { todayAR } from '../../../core/shared/dates.ts';
import { fmtDuration } from '../../../core/shared/duration.ts';
import { ChecklistIcon, ChevronRightIcon, PartyIcon } from '../../../core/web/icons.tsx';
import { vibrate } from '../../../core/web/haptics.ts';
import { useMotion } from '../../../core/web/motion.tsx';
import { EmptyState, Skeleton, TaskRow } from '../../../core/web/ui.tsx';
import type { TodoItem } from '../server/service.ts';
import { TaskMeta } from './TodoPage.tsx';
import { groupMinutes, hoyCardData } from './views.ts';
import './todo.css';

export function HoyCard() {
  const { materias, notify } = useCore();
  const { data, error, reload } = useApi<TodoItem[]>('/api/todo');
  const { spring } = useMotion();
  const today = todayAR();

  async function toggle(i: TodoItem) {
    vibrate(i.completed ? 'tick' : 'success');
    try { await api('PATCH', `/api/todo/${i.id}`, { completed: !i.completed }); } catch (e) { notify(e instanceof ApiError ? e.message : 'Algo salió mal.'); }
    reload();
  }

  const row = (i: TodoItem) => {
    const mat = materias.find((x) => x.id === i.materiaId);
    return (
      <TaskRow key={i.id} title={i.title} colorVars={mat ? materiaVars(mat.color) : undefined} to={`/todo/${i.id}`}
        meta={<TaskMeta item={i} today={today} sigla={mat?.sigla} showDate={false} />}
        duration={i.durationMin ? fmtDuration(i.durationMin) : ''}
        toggleLabel={`Completar: ${i.title}`} onToggle={() => void toggle(i)} />
    );
  };

  const head = <div className="card-head"><h3><ChecklistIcon size={18} />Hoy</h3><Link to="/todo?vista=hoy">To-do<ChevronRightIcon size={16} /></Link></div>;
  if (error && !data) return <section className="card">{head}<p className="error" role="alert">{error.message} <button className="btn" onClick={reload}>Reintentar</button></p></section>;
  if (!data) return <section className="card skel-card" role="status" aria-label="Cargando">{head}<Skeleton /><Skeleton w="70%" /><Skeleton w="80%" /></section>;

  const { late, lateMore, today: now } = hoyCardData(data, today);
  const all = data.filter((i) => i.dueDate === today);
  const done = all.filter((i) => i.completed).length;
  const left = groupMinutes(now), tot = groupMinutes(all);
  return (
    <section className="card hoy-card">
      {head}
      {all.length > 0 && <>
        <div className="hoy-sub">
          <span>{done} de {all.length} hechas</span>
          {(tot.minutes > 0 || tot.unestimated > 0) && <span>{fmtDuration(left.minutes)} pendientes{tot.unestimated > 0 && `, ${tot.unestimated} sin estimar`}</span>}
        </div>
        <div className="hoy-bar"><m.i initial={false} animate={{ scaleX: done / all.length }} transition={spring('sheet')} /></div>
      </>}
      {late.length + now.length === 0 && <EmptyState icon={PartyIcon} title="Nada pendiente para hoy">Buen momento para adelantar algo de la semana.</EmptyState>}
      <ul className="rows">
        <AnimatePresence initial={false}>
          {late.map(row)}
          {lateMore > 0 && <li key="more" className="row-wrap"><Link to="/todo?vista=hoy" className="hoy-more">Ver {lateMore} vencidas más</Link></li>}
          {now.map(row)}
        </AnimatePresence>
      </ul>
    </section>
  );
}
