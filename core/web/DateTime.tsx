import { useEffect, useId, useRef, useState } from 'react';
import { addDays, formatDate, isValidDate, isValidTime, todayAR, weekdayOf } from '../shared/dates.ts';
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from './icons.tsx';

/** Selectores propios de fecha y hora: se tipea rápido (teclado numérico) y la fecha también se elige en un calendario. */

/** "930", "9:30", "9.30", "21" → "09:30", "21:00"; null si no es una hora. */
export function parseTime(text: string): string | null {
  const t = text.trim();
  let h: string, m: string;
  if (/^\d{1,2}[:.h]\d{1,2}$/.test(t)) [h, m] = t.split(/[:.h]/) as [string, string];
  else if (/^\d{1,2}$/.test(t)) [h, m] = [t, '0'];
  else if (/^\d{3,4}$/.test(t)) [h, m] = [t.slice(0, -2), t.slice(-2)];
  else return null;
  const v = `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
  return isValidTime(v) ? v : null;
}

/** "5/11/2026", "05112026", "5/11" (año actual), "5-11-26", "hoy", "mañana" → "2026-11-05"; null si no es una fecha. */
export function parseDate(text: string, today: string): string | null {
  const t = text.trim().toLowerCase();
  if (t === 'hoy') return today;
  if (t === 'mañana' || t === 'manana') return addDays(today, 1);
  let d: string, m: string, y: string | undefined;
  if (/^\d{1,2}[/.\- ]\d{1,2}([/.\- ]\d{2}|[/.\- ]\d{4})?$/.test(t)) [d, m, y] = t.split(/[/.\- ]/) as [string, string, string | undefined];
  else if (/^\d{4}$/.test(t)) [d, m] = [t.slice(0, 2), t.slice(2)] as [string, string];
  else if (/^\d{6}$/.test(t) || /^\d{8}$/.test(t)) [d, m, y] = [t.slice(0, 2), t.slice(2, 4), t.slice(4)] as [string, string, string];
  else return null;
  const year = y === undefined ? today.slice(0, 4) : y.length === 2 ? `20${y}` : y;
  const v = `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  return isValidDate(v) ? v : null;
}

const BAD_DATE = 'Escribí la fecha así: 05/11/2026, o “hoy” o “mañana”.';
const BAD_TIME = 'Escribí la hora así: 9:30 o 0930.';

type Common = { label: string; hideLabel?: boolean; required?: boolean; disabled?: boolean };

/** Texto editable: guarda lo tipeado, interpreta el valor y bloquea el envío del formulario si no se entiende. */
function useTextValue(value: string, parse: (t: string) => string | null, show: (v: string) => string, extra: (v: string) => string, invalid: string) {
  const [text, setText] = useState(show(value));
  const [touched, setTouched] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  // Cambio desde afuera (el calendario, otro campo): el texto lo sigue.
  useEffect(() => { if ((text.trim() ? parse(text) ?? '' : '') !== value) setText(show(value)); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  const parsed = text.trim() ? parse(text) : '';
  const problem = text.trim() && parsed === null ? invalid : parsed ? extra(parsed) : '';
  useEffect(() => { ref.current?.setCustomValidity(problem); }, [problem]);
  return { text, setText, touched, setTouched, ref, parsed, problem };
}

const rangeMsg = (min?: string) => (v: string) => (min && v < min ? `Tiene que ser el ${formatDate(min)} o después.` : '');

export function DateField({ label, hideLabel, value, onChange, required, disabled, min }: Common & { value: string; onChange(v: string): void; min?: string }) {
  const id = useId();
  const today = todayAR();
  const f = useTextValue(value, (t) => parseDate(t, today), (v) => (v ? formatDate(v) : ''), rangeMsg(min), BAD_DATE);
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const msg = f.touched ? f.problem : '';
  return (
    <div className="field dt">
      <label htmlFor={id} className={hideLabel ? 'sr-only' : undefined}>{label}</label>
      <div className="dt-row">
        <input id={id} ref={f.ref} type="text" inputMode="numeric" autoComplete="off" placeholder="dd/mm/aaaa" value={f.text} required={required} disabled={disabled}
          aria-invalid={!!msg} aria-describedby={msg ? `${id}-e` : undefined}
          onChange={(e) => { f.setText(e.target.value); onChange(e.target.value.trim() ? parseDate(e.target.value, today) ?? '' : ''); }}
          onBlur={() => { f.setTouched(true); if (f.parsed) f.setText(formatDate(f.parsed)); }} />
        <button ref={opener} type="button" className="icon-btn" disabled={disabled} aria-label={`Elegir en el calendario: ${label.toLowerCase()}`} aria-haspopup="dialog" onClick={() => setOpen(true)}><CalendarIcon /></button>
      </div>
      {msg && <small id={`${id}-e`} className="field-err" role="alert">{msg}</small>}
      {open && <Picker value={f.parsed || ''} min={min} required={required} label={label}
        onPick={(v) => { onChange(v); f.setText(v ? formatDate(v) : ''); setOpen(false); }} onClose={() => { setOpen(false); opener.current?.focus(); }} />}
    </div>
  );
}

export function TimeField({ label, hideLabel, value, onChange, required, disabled }: Common & { value: string; onChange(v: string): void }) {
  const id = useId();
  const f = useTextValue(value, parseTime, (v) => v, () => '', BAD_TIME);
  const msg = f.touched ? f.problem : '';
  return (
    <div className="field dt">
      <label htmlFor={id} className={hideLabel ? 'sr-only' : undefined}>{label}</label>
      <input id={id} ref={f.ref} type="text" inputMode="numeric" autoComplete="off" placeholder="hh:mm" maxLength={5} value={f.text} required={required} disabled={disabled}
        aria-invalid={!!msg} aria-describedby={msg ? `${id}-e` : undefined}
        onChange={(e) => { f.setText(e.target.value); onChange(e.target.value.trim() ? parseTime(e.target.value) ?? '' : ''); }}
        onBlur={() => { f.setTouched(true); if (f.parsed) f.setText(f.parsed); }} />
      {msg && <small id={`${id}-e`} className="field-err" role="alert">{msg}</small>}
    </div>
  );
}

const DOW = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const longDay = (d: string) => `${DOW[weekdayOf(d) - 1]} ${+d.slice(8)} de ${MONTHS[+d.slice(5, 7) - 1]} de ${d.slice(0, 4)}`;
const shiftMonth = (d: string, n: number) => {
  const t = new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1 + n, 1));
  const max = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  return `${t.toISOString().slice(0, 8)}${String(Math.min(+d.slice(8), max)).padStart(2, '0')}`;
};

/** Calendario en un `<dialog>` (foco atrapado, Esc, fondo inerte y foco de vuelta gratis). Flechas, Re Pág/Av Pág y Enter. */
function Picker({ value, min, required, label, onPick, onClose }: { value: string; min?: string; required?: boolean; label: string; onPick(v: string): void; onClose(): void }) {
  const today = todayAR();
  const [cursor, setCursor] = useState(value || (min && min > today ? min : today));
  const dlg = useRef<HTMLDialogElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  // Al abrir, el foco va al día elegido (no al botón de mes anterior).
  useEffect(() => { dlg.current?.showModal(); grid.current?.querySelector<HTMLElement>(`[data-d="${cursor}"]`)?.focus(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (moved.current) grid.current?.querySelector<HTMLElement>(`[data-d="${cursor}"]`)?.focus(); }, [cursor]);
  const first = `${cursor.slice(0, 8)}01`;
  const start = addDays(first, 1 - weekdayOf(first));
  const go = (d: string) => { moved.current = true; setCursor(d); };
  const key = (e: React.KeyboardEvent) => {
    const m: Record<string, string> = {
      ArrowLeft: addDays(cursor, -1), ArrowRight: addDays(cursor, 1), ArrowUp: addDays(cursor, -7), ArrowDown: addDays(cursor, 7),
      Home: addDays(cursor, 1 - weekdayOf(cursor)), End: addDays(cursor, 7 - weekdayOf(cursor)),
      PageUp: shiftMonth(cursor, -1), PageDown: shiftMonth(cursor, 1),
    };
    if (m[e.key]) { e.preventDefault(); go(m[e.key]!); }
  };
  return (
    <dialog ref={dlg} className="picker" aria-label={`Elegir fecha: ${label}`} onClose={onClose} onClick={(e) => { if (e.target === dlg.current) dlg.current?.close(); }}>
      <div className="picker-head">
        <button type="button" className="icon-btn" aria-label="Mes anterior" onClick={() => go(shiftMonth(cursor, -1))}><ChevronLeftIcon /></button>
        <h2 aria-live="polite">{MONTHS[+cursor.slice(5, 7) - 1]} {cursor.slice(0, 4)}</h2>
        <button type="button" className="icon-btn" aria-label="Mes siguiente" onClick={() => go(shiftMonth(cursor, 1))}><ChevronRightIcon /></button>
      </div>
      <div className="picker-dow" aria-hidden="true">{['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((x) => <span key={x}>{x}</span>)}</div>
      <div ref={grid} className="picker-grid" onKeyDown={key}>
        {Array.from({ length: 42 }, (_, i) => {
          const d = addDays(start, i);
          return (
            <button key={d} type="button" data-d={d} className={`picker-day${d.slice(0, 7) !== cursor.slice(0, 7) ? ' out' : ''}${d === today ? ' today' : ''}`}
              tabIndex={d === cursor ? 0 : -1} aria-label={longDay(d)} aria-pressed={d === value} aria-current={d === today ? 'date' : undefined}
              disabled={!!min && d < min} onClick={() => onPick(d)}>{+d.slice(8)}</button>
          );
        })}
      </div>
      <div className="row">
        {!required && value && <button type="button" className="btn" onClick={() => onPick('')}>Quitar fecha</button>}
        <button type="button" className="btn" disabled={!!min && today < min} onClick={() => onPick(today)}>Hoy</button>
        <button type="button" className="btn" onClick={() => dlg.current?.close()}>Cerrar</button>
      </div>
    </dialog>
  );
}
