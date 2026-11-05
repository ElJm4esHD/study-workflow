import { ApiError } from '../../../core/web/api.ts';
import { useCore } from '../../../core/web/CoreContext.tsx';
import { VIEWS } from './views.ts';
import './calendar.css';

export function CalendarSettings() {
  const { settings, patchSettings, notify } = useCore();
  const current = (settings['calendar.initialView'] as string | undefined) ?? 'mes';
  async function pick(id: string) {
    try { await patchSettings({ 'calendar.initialView': id }); } catch (e) { notify(e instanceof ApiError ? e.message : 'Algo salió mal.'); }
  }
  return (
    <div className="card" role="radiogroup" aria-label="Vista inicial del calendario">
      {VIEWS.map((v) => (
        <label key={v.id} className="cal-radio">
          <input type="radio" name="cal-view" checked={current === v.id} onChange={() => pick(v.id)} />
          {v.label}
        </label>
      ))}
    </div>
  );
}
