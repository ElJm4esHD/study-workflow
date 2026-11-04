import { useEffect, useRef, useState } from 'react';
import { api, ApiError, useApi } from '../../../core/web/api.ts';
import { useCore } from '../../../core/web/CoreContext.tsx';
import { formatDate, todayAR } from '../../../core/shared/dates.ts';
import type { PlanSummary } from '../server/index.ts';
import { deleteCounts } from './logic.ts';
import './import.css';

export function PlansPage() {
  const { notify } = useCore();
  const { data, error, reload } = useApi<PlanSummary[]>('/api/import/plans');
  const [target, setTarget] = useState<PlanSummary | null>(null);
  const [incl, setIncl] = useState(false);
  const [keep, setKeep] = useState(true);
  const dlg = useRef<HTMLDialogElement>(null);

  useEffect(() => { if (target) dlg.current?.showModal(); else dlg.current?.close(); }, [target]);

  function ask(p: PlanSummary) { setIncl(false); setKeep(true); setTarget(p); }
  async function remove() {
    if (!target) return;
    try {
      await api('DELETE', `/api/import/plans/${target.id}?includeCompleted=${incl}&keepExams=${keep}`);
      notify('Plan borrado.');
      setTarget(null);
      reload();
    } catch (e) { notify(e instanceof ApiError ? e.message : 'Algo salió mal.'); }
  }

  const c = target ? deleteCounts(target, keep) : null;
  return (
    <>
      <h1>Planes importados</h1>
      {error && <p className="error" role="alert">{error.message}</p>}
      {data?.length === 0 && <p className="muted">Todavía no importaste ningún plan.</p>}
      <div className="card-group">
        {data?.map((p) => (
          <div key={p.id} className="card">
            <h2 style={{ marginLeft: 0 }}>{p.title ?? `Plan del ${formatDate(todayAR(new Date(p.createdAt)))}`}</h2>
            <div className="imp-bar" role="progressbar" aria-valuemin={0} aria-valuemax={p.tasksTotal} aria-valuenow={p.tasksDone}>
              <div style={{ width: p.tasksTotal ? `${(100 * p.tasksDone) / p.tasksTotal}%` : 0 }} />
            </div>
            <p className="muted">{p.tasksDone}/{p.tasksTotal} tareas</p>
            <p className="muted">{p.eventsCount} eventos ({p.examsCount} exámenes)</p>
            <button className="btn" onClick={() => ask(p)}>Borrar</button>
          </div>
        ))}
      </div>
      <dialog ref={dlg} className="imp-dialog" onClose={() => setTarget(null)}>
        {target && c && (
          <>
            <p>Se van a borrar {c.pending} tareas pendientes y {c.events} eventos.</p>
            <label><input type="checkbox" checked={incl} onChange={(e) => setIncl(e.target.checked)} /> Borrar también las {target.tasksDone} tareas completadas</label>
            <label><input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} /> Mantener los exámenes (parcial/recuperatorio/final)</label>
            <div className="row">
              <button className="btn" onClick={() => setTarget(null)}>Cancelar</button>
              <button className="btn primary" onClick={remove}>Borrar</button>
            </div>
          </>
        )}
      </dialog>
    </>
  );
}
