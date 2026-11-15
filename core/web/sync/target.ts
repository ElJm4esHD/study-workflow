import type { SyncTarget } from './engine.ts';

/** Adaptador "Mi servidor". `call` hace la llamada HTTP (en la app: fetch con la dirección guardada; en los tests: inject). */
export type Call = (method: 'GET' | 'POST', path: string, body?: unknown) => Promise<any>;

export const serverTarget = (call: Call, pageSize = 1000): SyncTarget => ({
  push: (records) => call('POST', '/api/sync/push', { records }),
  pull: (cursor) => call('GET', `/api/sync/pull?limit=${pageSize}${cursor ? `&since=${encodeURIComponent(cursor)}` : ''}`),
});
