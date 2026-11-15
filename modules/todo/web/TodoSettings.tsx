import { errMsg } from '../../../core/web/api.ts';
import { useCore } from '../../../core/web/CoreContext.tsx';
import { Segmented } from '../../../core/web/ui.tsx';
import { TODO_CATEGORIES } from '../shared.ts';

/** Valores por defecto de las tareas nuevas y cuánto se muestran las completadas (se guardan en el servidor, valen para todos tus dispositivos). */
export const todoDefaults = (s: Record<string, unknown>) => ({
  durationMin: typeof s['todo.defaultDuration'] === 'number' ? (s['todo.defaultDuration'] as number) : null,
  category: TODO_CATEGORIES.find((c) => c.id === s['todo.defaultCategory'])?.id ?? 'tarea',
  hideCompletedDays: typeof s['todo.hideCompletedDays'] === 'number' ? (s['todo.hideCompletedDays'] as number) : null,
});

const DURATIONS = [[0, 'Ninguna'], [15, '15 min'], [30, '30 min'], [60, '1 h'], [90, '1 h 30']] as const;
const HIDE = [[0, 'Nunca'], [7, '7 días'], [30, '30 días'], [90, '90 días']] as const;

export function TodoSettings() {
  const { settings, patchSettings, notify } = useCore();
  const d = todoDefaults(settings);
  const save = (p: Record<string, unknown>) => patchSettings(p).catch((e) => notify(errMsg(e)));
  return (
    <div className="card set-card">
      <div className="set-row">
        <div className="set-label"><b>Duración por defecto</b><span>Se usa en las tareas nuevas; la podés cambiar en cada una.</span></div>
        <Segmented name="todo-dur" label="Duración por defecto" value={String(d.durationMin ?? 0)} options={DURATIONS.map(([v, l]) => [String(v), l] as const)}
          onChange={(v) => void save({ 'todo.defaultDuration': Number(v) || null })} />
      </div>
      <div className="set-row">
        <div className="set-label"><b>Categoría por defecto</b></div>
        <Segmented name="todo-cat" label="Categoría por defecto" value={d.category} options={TODO_CATEGORIES.map((c) => [c.id, c.label] as const)}
          onChange={(v) => void save({ 'todo.defaultCategory': v })} />
      </div>
      <div className="set-row">
        <div className="set-label"><b>Completadas</b><span>Las que completaste hace más de este tiempo dejan de verse en “Completadas”. No se borran.</span></div>
        <Segmented name="todo-hide" label="Ocultar completadas después de" value={String(d.hideCompletedDays ?? 0)} options={HIDE.map(([v, l]) => [String(v), l] as const)}
          onChange={(v) => void save({ 'todo.hideCompletedDays': Number(v) || null })} />
      </div>
    </div>
  );
}
