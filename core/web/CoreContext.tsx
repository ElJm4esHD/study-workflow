import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Materia } from '../app/registry.ts';
import { webModules } from '../../modules/web.ts';
import { api, useApi } from './api.ts';
import { resolveEnabled, type WebModule } from './registry.ts';
import { AnimatePresence, m as mo } from 'motion/react'; // `m` ya es la lista de materias acá
import { useMotion } from './motion.tsx';
import { PageSkeleton } from './ui.tsx';

type Core = {
  materias: Materia[];
  settings: Record<string, unknown>;
  enabledModules: WebModule[];
  reloadMaterias(): void;
  patchSettings(p: Record<string, unknown>): Promise<void>;
  /** Aviso abajo; con `undo` muestra "Deshacer" (6 s). */
  notify(msg: string, undo?: () => void): void;
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
  const [toast, setToast] = useState<{ msg: string; undo?: () => void; id: number } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const { spring } = useMotion();


  const notify = useCallback((msg: string, undo?: () => void) => {
    setToast({ msg, undo, id: Date.now() });
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), undo ? 6000 : 4000);
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
        err ? (
          <div className="center-screen" role="alert">
            <h1>No se pudo cargar la app</h1>
            <p>{err.message}</p>
            <button className="btn primary" onClick={() => { m.reload(); s.reload(); }}>Reintentar</button>
          </div>
        ) : <div className="main"><PageSkeleton /></div>
      )}
      <div className="toast-zone" role="status">
        <AnimatePresence>
          {toast && (
            <mo.div key={toast.id} className="toast" initial={{ y: 24, opacity: 0, scale: 0.96 }} animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 12, opacity: 0 }} transition={spring('sheet')}>
              <span>{toast.msg}</span>
              {toast.undo && <button type="button" onClick={() => { toast.undo!(); setToast(null); }}>Deshacer</button>}
            </mo.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
