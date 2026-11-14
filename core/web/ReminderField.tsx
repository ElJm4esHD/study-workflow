import { useState } from 'react';
import { REMINDER_MAX } from '../shared/reminder.ts';
import { askNotifications } from './widgets.ts';

const PRESETS: [number, string][] = [[0, 'A la hora'], [15, '15 min antes'], [60, '1 h antes'], [1440, '1 día antes']];
const UNITS: [number, string][] = [[1, 'minutos'], [60, 'horas'], [1440, 'días']];

type Props = { value: number | null; insistent: boolean; disabled?: boolean; onChange(value: number | null, insistent: boolean): void };

/** Selector de recordatorio compartido por tareas y eventos. `value` = minutos antes (null = sin recordatorio). */
export function ReminderField({ value, insistent, disabled, onChange }: Props) {
  const [other, setOther] = useState(value !== null && !PRESETS.some(([m]) => m === value));
  const [unit, setUnit] = useState(() => (value ? [1440, 60].find((u) => value % u === 0) ?? 1 : 1));
  const set = (v: number | null, ins = insistent) => { if (v !== null) askNotifications(); onChange(v, v === null ? false : ins); };
  if (disabled) return <div className="field"><span>Recordatorio</span><span>Poné una fecha para usar un recordatorio.</span></div>;
  return (
    <div className="field" role="group" aria-label="Recordatorio">
      <span>Recordatorio (suena en el celu)</span>
      <div className="pills">
        <button type="button" className="pill" aria-pressed={value === null && !other} onClick={() => { setOther(false); set(null); }}>Sin recordatorio</button>
        {PRESETS.map(([m, label]) => (
          <button type="button" key={m} className="pill" aria-pressed={!other && value === m} onClick={() => { setOther(false); set(m); }}>{label}</button>
        ))}
        <button type="button" className="pill" aria-pressed={other} onClick={() => { setOther(true); if (value === null) set(30); }}>Otro…</button>
      </div>
      {other && (
        <div className="two">
          <input type="number" inputMode="numeric" min={0} max={REMINDER_MAX / unit} step={1} aria-label="Cuánto antes" value={value === null ? '' : value / unit}
            onChange={(e) => set(Math.min(REMINDER_MAX, Math.max(0, Math.round(Number(e.target.value) || 0) * unit)))} />
          <select aria-label="Unidad" value={unit} onChange={(e) => { const u = Number(e.target.value); set(Math.min(REMINDER_MAX, Math.round((value ?? 0) / unit) * u)); setUnit(u); }}>
            {UNITS.map(([u, label]) => <option key={u} value={u}>{label} antes</option>)}
          </select>
        </div>
      )}
      {value !== null && (
        <label className="rem-check">
          <input type="checkbox" checked={insistent} onChange={(e) => set(value, e.target.checked)} />
          Insistente: sigue sonando hasta que la atiendas
        </label>
      )}
    </div>
  );
}
