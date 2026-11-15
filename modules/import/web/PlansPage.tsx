import { useEffect, useRef, useState } from 'react';
import { m } from 'motion/react';
import { api, useApi, errMsg } from '../../../core/web/api.ts';
import { useBlock, useCore } from '../../../core/web/CoreContext.tsx';
import { formatDate, todayAR } from '../../../core/shared/dates.ts';
import { InboxIcon, TrashIcon } from '../../../core/web/icons.tsx';
import { useMotion } from '../../../core/web/motion.tsx';
import { vibrate } from '../../../core/web/haptics.ts';
import { EmptyState, PageHeader, Skeleton, ErrorState } from '../../../core/web/ui.tsx';
import type { PlanSummary } from '../server/index.ts';
import { deleteCounts } from './logic.ts';
import './import.css';

export function PlansPage() {
  const { notify } = useCore();
  const { off, block } = useBlock();
  const { spring } = useMotion();
  const { data, error, reload } = useApi<PlanSummary[]>('/api/import/plans');
  const [target, setTarget] = useState<PlanSummary | null>(null);
  const [incl, setIncl] = useState(false);
  const [keep, setKeep] = useState(true);
  const dlg = useRef<HTMLDialogElement>(null);

  useEffect(() => { if (target) dlg.current?.showModal(); else dlg.current?.close(); }, [target]);

  function ask(p: PlanSummary) { if (block()) return; setIncl(false); setKeep(true); setTarget(p); }
  async function remove() {
    if (!target) return;
    try {
      await api('DELETE', `/api/import/plans/${target.id}?includeCompleted=${incl}&keepExams=${keep}`);
      vibrate('warn');
      notify('Plan borrado.');
      setTarget(null);
      reload();
    } catch (e) { notify(errMsg(e)); }
  }

  const c = target ? deleteCounts(target, keep) : null;
  return (
    <>
      <PageHeader title="Planes importados" sub={data?.length ? `${data.length} ${data.length === 1 ? 'plan' : 'planes'}` : undefined} />
      {error && <ErrorState error={error} onRetry={reload} />}
      {!data && !error && <div className="card skel-card" role="status" aria-label="Cargando"><Skeleton w="50%" h={18} /><Skeleton h={8} /><Skeleton w="40%" /></div>}
      {data?.length === 0 && <EmptyState icon={InboxIcon} title="Sin planes">Los planes que importes desde Claude aparecen acá.</EmptyState>}
      <div className="cols imp-plans">
        {data?.map((p) => (
          <div key={p.id} className="card imp-plan">
            <h2>{p.title ?? `Plan del ${formatDate(todayAR(new Date(p.createdAt)))}`}</h2>
            <div className="imp-bar" role="progressbar" aria-valuemin={0} aria-valuemax={p.tasksTotal} aria-valuenow={p.tasksDone}>
              <m.div initial={{ scaleX: 0 }} animate={{ scaleX: p.tasksTotal ? p.tasksDone / p.tasksTotal : 0 }} transition={spring('sheet')} />
            </div>
            <p className="imp-plan-meta">{p.tasksDone} de {p.tasksTotal} tareas · {p.eventsCount} eventos ({p.examsCount} exámenes)</p>
            <button className="btn danger" onClick={() => ask(p)} aria-disabled={off}><TrashIcon size={18} />Borrar</button>
          </div>
        ))}
      </div>
      <dialog ref={dlg} className="imp-dialog" onClose={() => setTarget(null)}>
        {target && c && (
          <>
            <h2>¿Borrar el plan?</h2>
            <p className="muted">Se van a borrar {c.pending} tareas pendientes y {c.events} eventos.</p>
            <label><input type="checkbox" checked={incl} onChange={(e) => setIncl(e.target.checked)} /> Borrar también las {target.tasksDone} tareas completadas</label>
            <label><input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} /> Mantener los exámenes (parcial, recuperatorio, final)</label>
            <div className="row">
              <button className="btn" onClick={() => setTarget(null)}>Cancelar</button>
              <button className="btn primary danger-fill" onClick={remove}>Borrar</button>
            </div>
          </>
        )}
      </dialog>
    </>
  );
}
