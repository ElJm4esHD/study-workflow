import { useEffect, useState } from 'react';
import { getSyncStatus, onSyncStatus, reconnectDrive } from './sync/auto.ts';
import { local } from './local.ts';

export function useSyncStatus() {
  const [s, setS] = useState(getSyncStatus);
  useEffect(() => onSyncStatus(setS), []);
  return s;
}

/** Aviso arriba solo cuando hay algo para saber: cambios sin subir, un fallo de sincronización o que el navegador no deja guardar. */
export function SyncBar() {
  const s = useSyncStatus();
  const msg = s.saveError ? 'No se pudo guardar en este dispositivo. Exportá un backup en Ajustes › Datos.'
    : local().volatile ? 'Este navegador no deja guardar datos acá: se mantienen solo mientras la pestaña está abierta.'
    : s.error && s.enabled ? `${s.error}${s.pending ? ` ${s.pending} ${s.pending === 1 ? 'cambio' : 'cambios'} sin subir.` : ''}`
    : '';
  const [err, setErr] = useState('');
  const reconnect = () => { setErr(''); reconnectDrive().catch((e) => setErr(e instanceof Error ? e.message : 'No se pudo reconectar.')); };
  return msg ? (
    <div className="offline-bar" role="status">
      {msg}{s.needsAuth && <> <button type="button" className="btn" onClick={reconnect}>Reconectar</button></>}{err && <> {err}</>}
    </div>
  ) : null;
}

const rtf = new Intl.RelativeTimeFormat('es-AR', { numeric: 'auto' });
export function syncLabel(s: ReturnType<typeof getSyncStatus>): string {
  if (!s.enabled) return 'Sin sincronizar: los datos quedan solo en este dispositivo.';
  if (s.syncing) return 'Sincronizando…';
  const pend = s.pending ? `Sin sincronizar (${s.pending}). ` : '';
  if (!s.lastSync) return `${pend}Todavía no se sincronizó.`;
  const min = Math.round((Date.now() - Date.parse(s.lastSync)) / 60000);
  return `${pend}Sincronizado ${min < 1 ? 'hace instantes' : rtf.format(-min, 'minute')}.`;
}
