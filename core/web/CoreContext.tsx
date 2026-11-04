import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Materia } from '../server/registry.ts';
import { webModules } from '../../modules/web.ts';
import { api, useApi } from './api.ts';
import { resolveEnabled, type WebModule } from './registry.ts';

type Core = {
  materias: Materia[];
  settings: Record<string, unknown>;
  enabledModules: WebModule[];
  reloadMaterias(): void;
  patchSettings(p: Record<string, unknown>): Promise<void>;
  notify(msg: string): void;
};
const Ctx = createContext<Core | null>(null);

export function useCore(): Core {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCore fuera de CoreProvider');
  return c;
}

export function CoreProvider({ children }: { children: ReactNode }) {
  const m = useApi<Materia[]>('/api/materias');
  const s = useApi<Record<string, unknown>>('/api/settings');
  const [patched, setPatched] = useState<Record<string, unknown> | undefined>();
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 4000);
  }, []);
  const patchSettings = useCallback(async (p: Record<string, unknown>) => {
    setPatched(await api<Record<string, unknown>>('PATCH', '/api/settings', p));
  }, []);

  const current = patched ?? s.data;
  const reloadMaterias = m.reload;
  const value = useMemo<Core | null>(() => {
    if (!m.data || !current) return null;
    const flags = (current['modules.enabled'] ?? {}) as Record<string, boolean>;
    return {
      materias: m.data, settings: current, reloadMaterias, patchSettings, notify,
      enabledModules: resolveEnabled(webModules, (id) => flags[id] ?? true),
    };
  }, [m.data, current, reloadMaterias, patchSettings, notify]);

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
