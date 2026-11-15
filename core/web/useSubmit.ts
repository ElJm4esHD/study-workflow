import { useRef, useState } from 'react';
import { errMsg } from './api.ts';

/** Guardar sin doble envío: ignora toques mientras corre y deja el error a mano para mostrarlo junto al botón. */
export function useSubmit() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  async function run(fn: () => Promise<unknown>): Promise<boolean> {
    if (busy.current) return false;
    busy.current = true; setSaving(true); setError('');
    try { await fn(); return true; } catch (e) { setError(errMsg(e)); return false; } finally { busy.current = false; setSaving(false); }
  }
  return { saving, error, run, fail: setError };
}

/** Valida el formulario con texto propio (el aviso nativo no sale en el WebView): enfoca el primer campo mal y devuelve qué hacer. */
export function firstInvalid(form: HTMLFormElement): string | null {
  const el = form.querySelector<HTMLInputElement>(':invalid');
  if (!el) return null;
  el.focus();
  const name = (el.labels?.[0]?.firstChild?.textContent ?? el.getAttribute('aria-label') ?? 'Un campo').trim();
  return el.validity.customError ? el.validationMessage : `Completá “${name}” para seguir.`;
}
