import { useCallback, useEffect, useState } from 'react';
import { appendCopy, applyPending, enqueue, flush, isQueueable, lastCopyAt, mergeCopies, patchCopies, pending, readCopy, saveCopy } from './offline.ts';
import { apiBase, isNative } from './server.ts';

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export type Connection = { offline: boolean; pending: number; copyAt: string | null };

let offline = false;
const connListeners = new Set<(c: Connection) => void>();
const reloadListeners = new Set<() => void>();
export const getConnection = (): Connection => ({ offline, pending: pending().length, copyAt: lastCopyAt() });
const emit = () => connListeners.forEach((f) => f(getConnection()));
function setOffline(v: boolean) {
  offline = v;
  emit();
}
export function onConnection(fn: (c: Connection) => void): () => void {
  connListeners.add(fn);
  return () => void connListeners.delete(fn);
}
export function onReload(fn: () => void): () => void {
  reloadListeners.add(fn);
  return () => void reloadListeners.delete(fn);
}

// Lanza si no hay red (o vence el timeout); si no, devuelve status y JSON.
async function raw(method: string, path: string, body?: unknown): Promise<{ status: number; json: any }> {
  const res = await fetch(apiBase() + path, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(method === 'GET' ? 8000 : 30000),
  });
  return { status: res.status, json: res.status === 204 ? undefined : await res.json().catch(() => undefined) };
}

// Copia y cola solo en el APK; en la web cualquier falla de red es un error directo.
// Un PATCH encolado devuelve la copia parcheada, o undefined si esa pantalla nunca se cargó (los callers lo ignoran).
export async function api<T>(method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const native = isNative();
  const queueable = native && isQueueable(method, path, body);
  const blocked = () => new ApiError(0, 'sin_conexion', 'Sin conexión: solo podés tildar tareas.');
  const queue = (): T => {
    const id = path.split('/').pop()!;
    const { completed } = body as { completed: boolean };
    const at = new Date().toISOString();
    try {
      enqueue(id, completed, at);
    } catch {
      throw new ApiError(0, 'sin_conexion', 'No se pudo guardar el cambio sin conexión.');
    }
    patchCopies(id, completed, at);
    setOffline(true);
    return readCopy<T>(path)?.data as T;
  };
  if (native && method !== 'GET' && offline) {
    if (queueable) return queue();
    throw blocked();
  }
  let r: { status: number; json: any };
  try {
    r = await raw(method, path, body);
  } catch {
    if (!native) throw new ApiError(0, 'sin_conexion', 'No hay conexión con el servidor.');
    if (method === 'GET') {
      const copy = readCopy<T>(path);
      if (!copy) throw new ApiError(0, 'sin_conexion', 'Sin conexión y sin datos guardados para esta pantalla.');
      setOffline(true);
      return copy.data;
    }
    if (queueable) return queue();
    setOffline(true);
    throw blocked();
  }
  if (r.status >= 400) {
    throw new ApiError(r.status, r.json?.error?.code ?? 'error', r.json?.error?.message ?? 'Algo salió mal.');
  }
  if (native) {
    const j = r.json;
    if (method === 'GET' && j !== undefined) {
      applyPending(j);
      saveCopy(path, j, new Date().toISOString());
      if (offline) setOffline(false);
      if (pending().length > 0) void resync();
    } else if (method !== 'GET' && j && typeof j === 'object' && typeof j.id === 'string' && typeof j.updatedAt === 'string') {
      // Las copias no se enteran de los cambios online: mantenerlas al día evita bases viejas.
      mergeCopies(j.id, j);
      if (method === 'POST' && path === '/api/todo') appendCopy('/api/todo', j);
    }
  }
  return r.json as T;
}

// Al volver la red: sube los tildes pendientes, marca online y pide recargar las pantallas.
let inflight: Promise<void> | null = null;
export function resync(): Promise<void> {
  inflight ??= (async () => {
    try {
      if ((await raw('GET', '/api/health')).status !== 200) return;
      await flush(raw);
    } catch {
      return;
    }
    setOffline(false);
    reloadListeners.forEach((f) => f());
  })().finally(() => { inflight = null; });
  return inflight;
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
