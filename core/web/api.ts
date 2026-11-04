import { useCallback, useEffect, useState } from 'react';

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function api<T>(method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'sin_conexion', 'No hay conexión con el servidor.');
  }
  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => undefined);
  if (!res.ok) {
    throw new ApiError(res.status, json?.error?.code ?? 'error', json?.error?.message ?? 'Algo salió mal.');
  }
  return json as T;
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
  return { ...state, reload };
}
