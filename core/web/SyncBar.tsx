import { useEffect, useState } from 'react';
import { getSyncStatus, onSyncStatus } from './sync/auto.ts';
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
  return msg ? <div className="offline-bar" role="status">{msg}</div> : null;
}

const rtf = new Intl.RelativeTimeFormat('es-AR', { numeric: 'auto' });
export function syncLabel(s: ReturnType<typeof getSyncStatus>): string {
  if (!s.enabled) return 'Sin servidor: los datos quedan solo en este dispositivo.';
  if (s.syncing) return 'Sincronizando…';
  const pend = s.pending ? `Sin sincronizar (${s.pending}). ` : '';
  if (!s.lastSync) return `${pend}Todavía no se sincronizó.`;
  const min = Math.round((Date.now() - Date.parse(s.lastSync)) / 60000);
  return `${pend}Sincronizado ${min < 1 ? 'hace instantes' : rtf.format(-min, 'minute')}.`;
}
