import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Materia } from '../server/registry.ts';
import { webModules } from '../../modules/web.ts';
import { api, getConnection, onConnection, resync, useApi, type Connection } from './api.ts';
import { prefetchUrls, resolveEnabled, type WebModule } from './registry.ts';
import { isNative } from './server.ts';
import { refreshWidgets } from './widgets.ts';

type Core = {
  materias: Materia[];
  settings: Record<string, unknown>;
  enabledModules: WebModule[];
  reloadMaterias(): void;
  patchSettings(p: Record<string, unknown>): Promise<void>;
  notify(msg: string): void;
  connection: Connection;
};
const Ctx = createContext<Core | null>(null);

export function useCore(): Core {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCore fuera de CoreProvider');
  return c;
}

export const BLOCKED = 'Sin conexión: solo podés tildar tareas.';

/** Para acciones que necesitan el servidor: `off` deshabilita (aria-disabled) y `block()` avisa y corta al tocar. */
export function useBlock() {
  const { connection, notify } = useCore();
  const off = connection.offline;
  return { off, block: () => { if (off) notify(BLOCKED); return off; } };
}

export function CoreProvider({ children }: { children: ReactNode }) {
  const m = useApi<Materia[]>('/api/materias');
  const s = useApi<Record<string, unknown>>('/api/settings');
  const [patched, setPatched] = useState<Record<string, unknown> | undefined>();
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const [connection, setConnection] = useState(getConnection);
  useEffect(() => onConnection(setConnection), []);

  // Reintentos de sincronización (solo en el APK): al volver la red, cada 30 s sin conexión y al volver a la app.
  // Con ops en cola y online (5xx persistente) la vuelta a la app es el reintento.
  useEffect(() => {
    if (!isNative()) return;
    const on = () => void resync();
    const vis = () => { if (document.visibilityState === 'hidden') refreshWidgets(); if (document.visibilityState === 'visible' && (getConnection().offline || getConnection().pending > 0)) void resync(); };
    window.addEventListener('online', on);
    document.addEventListener('visibilitychange', vis);
    const t = connection.offline ? window.setInterval(on, 30_000) : undefined;
    return () => { window.removeEventListener('online', on); document.removeEventListener('visibilitychange', vis); clearInterval(t); };
  }, [connection.offline]);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 4000);
  }, []);
  const patchSettings = useCallback(async (p: Record<string, unknown>) => {
    setPatched(await api<Record<string, unknown>>('PATCH', '/api/settings', p));
  }, []);

  const current = patched ?? s.data;
  const prefetched = useRef(false);
  const reloadMaterias = m.reload;
  const value = useMemo<Core | null>(() => {
    if (!m.data || !current) return null;
    const flags = (current['modules.enabled'] ?? {}) as Record<string, boolean>;
    return {
      materias: m.data, settings: current, reloadMaterias, patchSettings, notify,
      enabledModules: resolveEnabled(webModules, (id) => flags[id] ?? true), connection,
    };
  }, [m.data, current, reloadMaterias, patchSettings, notify, connection]);

  // Una vez, al primer arranque con conexión: deja copia de las pantallas para usarlas sin red.
  useEffect(() => {
    if (!value || connection.offline || prefetched.current || !isNative()) return;
    prefetched.current = true;
    prefetchUrls(value.enabledModules).forEach((u) => void api('GET', u).catch(() => {}));
  }, [value, connection.offline]);

  const err = m.error ?? s.error;
  return (
    <>
      {value ? <Ctx value={value}>{children}</Ctx> : (
        <div className="center-screen" role={err ? 'alert' : undefined}>
          {err ? (
            <>
              <h1>No se pudo cargar</h1>
              <p>{err.message}</p>
              <button className="btn primary" onClick={() => { m.reload(); s.reload(); }}>Reintentar</button>
            </>
          ) : <p>Cargando…</p>}
        </div>
      )}
      <div className="toast-zone" role="status">{toast && <div className="toast">{toast}</div>}</div>
    </>
  );
}
