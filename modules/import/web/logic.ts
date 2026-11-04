import { nameKey } from '../../../core/shared/normalize.ts';
import type { Preview } from '../server/preview.ts';
import type { PlanSummary } from '../server/index.ts';

/** Materias sin resolver que usan los ítems tildados (las de ítems con error o destildados no bloquean). */
export function neededMaterias(p: Preview, checked: ReadonlySet<number>): { key: string; name: string }[] {
  const used = new Set(p.items.filter((i) => checked.has(i.index) && i.materiaName).map((i) => nameKey(i.materiaName!)));
  return p.unresolvedMaterias.filter((u) => used.has(u.key));
}

/** Lo que va a borrar DELETE /plans/:id según las casillas del diálogo. */
export function deleteCounts(p: PlanSummary, keepExams: boolean) {
  return { pending: p.tasksTotal - p.tasksDone, events: keepExams ? p.eventsCount : p.eventsCount + p.examsCount };
}
