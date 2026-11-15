import { useCallback, useEffect, useState } from 'react';
import { local } from './local.ts';
import { refreshWidgets } from './widgets.ts';

/** Texto de un error para mostrar: el de la app, o uno genérico que dice qué hacer. */
export const errMsg = (e: unknown): string => (e instanceof ApiError ? e.message : 'No se pudo completar. Probá de nuevo.');

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const reloadListeners = new Set<() => void>();
/** Pide recargar a todas las pantallas que usan useApi (p. ej. cuando llegaron cambios de otro dispositivo). */
export const reloadAll = (): void => reloadListeners.forEach((fn) => fn());
export function onReload(fn: () => void): () => void {
  reloadListeners.add(fn);
  return () => void reloadListeners.delete(fn);
}

/**
 * Fachada: las pantallas siguen pidiendo '/api/...' como siempre, pero se resuelve dentro de la app (sin red).
 * El sync con el servidor corre aparte (core/web/sync/auto.ts).
 */
export async function api<T>(method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const r = local().router.handle(method, path, body);
  if (r.status >= 400) {
    const e = (r.body as { error?: { code?: string; message?: string } } | undefined)?.error;
    throw new ApiError(r.status, e?.code ?? 'error', e?.message ?? 'No se pudo completar. Probá de nuevo.');
  }
  if (method !== 'GET') refreshWidgets();
  return r.body as T;
}

export function useApi<T>(path: string | null) {
  const [state, setState] = useState<{ data?: T; error?: ApiError; loading: boolean }>({ loading: path !== null });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (path === null) return;
    let live = true;
    setState((s) => ({ ...s, loading: true }));
    api<T>('GET', path).then(
      (data) => live && setState({ data, loading: false }),
      (error: ApiError) => live && setState((s) => ({ data: s.data, error, loading: false })),
    );
    return () => { live = false; };
  }, [path, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => onReload(reload), [reload]);
  return { ...state, reload };
}
