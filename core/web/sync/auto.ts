import { isNative, getServerUrl, DEFAULT_SERVER } from '../server.ts';
import type { LocalDb } from './db.ts';
import { makeSyncer } from './engine.ts';
import { serverTarget, type Call } from './target.ts';

/** Cuándo y contra qué se sincroniza: al abrir, al volver la red o a primer plano, cada 5 min y 2 s después de un cambio. */
export type SyncStatus = { enabled: boolean; syncing: boolean; pending: number; lastSync: string | null; error: string | null; saveError: boolean };

/** Dirección del destino "Mi servidor": la web comparte origen con el server; el APK usa la guardada (si no hay, anda solo local). */
export const syncBase = (): string | null => (isNative() ? ((getServerUrl() ?? DEFAULT_SERVER).replace(/\/+$/, '') || null) : '');

const call: Call = async (method, path, body) => {
  const res = await fetch((syncBase() ?? '') + path, {
    method, headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`El servidor respondió ${res.status}.`);
  return res.json();
};

let status: SyncStatus = { enabled: false, syncing: false, pending: 0, lastSync: null, error: null, saveError: false };
const listeners = new Set<(s: SyncStatus) => void>();
export const getSyncStatus = () => status;
export function onSyncStatus(fn: (s: SyncStatus) => void): () => void { listeners.add(fn); return () => void listeners.delete(fn); }
const set = (p: Partial<SyncStatus>) => { status = { ...status, ...p }; listeners.forEach((f) => f(status)); };

let syncNow: () => Promise<void> = async () => {};
/** Sincroniza ya (Ajustes › "Sincronizar ahora"). */
export const syncNowNow = () => syncNow();

/** `onRemote`: se llama cuando llegaron cambios de otro dispositivo (para recargar las pantallas). */
export function startSync(db: LocalDb, onRemote: () => void): void {
  const run = makeSyncer(db, serverTarget(call));
  const refresh = () => set({ pending: db.pendingCount(), saveError: db.error !== null, lastSync: db.getMeta('lastSync') ?? null });
  syncNow = async () => {
    if (syncBase() === null) { set({ enabled: false }); return; }
    set({ enabled: true, syncing: true });
    try {
      const r = await run();
      set({ error: null });
      if (r.pulled > 0) onRemote();
    } catch (e) {
      set({ error: navigator.onLine === false ? 'Sin conexión: se sincroniza cuando vuelva.' : e instanceof Error ? e.message : 'No se pudo sincronizar.' });
    }
    set({ syncing: false });
    refresh();
  };
  refresh();
  set({ enabled: syncBase() !== null });
  let debounce: number | undefined;
  db.subscribe(() => {
    refresh();
    if (db.pendingCount() === 0) return;
    clearTimeout(debounce);
    debounce = window.setTimeout(() => void syncNow(), 2000);
  });
  window.addEventListener('online', () => void syncNow());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncNow();
    else void db.flushed(); // al pasar a segundo plano se espera a que lo escrito quede guardado
  });
  window.setInterval(() => void syncNow(), 5 * 60_000);
  void syncNow(); // al abrir
}

/** Primer arranque en un dispositivo sin datos: se espera (hasta 8 s) a bajar lo del servidor para no mostrar todo vacío. */
export async function firstSync(db: LocalDb): Promise<void> {
  if (db.getMeta('cursor') || syncBase() === null) return;
  await Promise.race([syncNow(), new Promise((r) => setTimeout(r, 8000))]);
}
