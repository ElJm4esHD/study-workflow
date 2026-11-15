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
  return { saving, error, run, clear: () => setError('') };
}
