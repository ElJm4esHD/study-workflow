import { buildLocalApp } from '../app/app.ts';
import type { LocalRouter } from '../app/router.ts';
import { appModules } from '../../modules/app.ts';
import { LocalDb } from './sync/db.ts';
import { isNative } from './server.ts';
import { nativeStore } from './sync/nativeStore.ts';
import { idbStore, memoryStore } from './sync/stores.ts';

/** La base local y el "server local" de este dispositivo. Se abren una vez al arrancar (`initLocal`). */
let state: { db: LocalDb; router: LocalRouter; volatile: boolean } | null = null;

export async function initLocal(): Promise<void> {
  if (state) return;
  let volatile = false;
  const store = await (isNative() ? nativeStore() : idbStore()).catch(() => { volatile = true; return memoryStore(); }); // modo privado u otro bloqueo: anda, pero no queda guardado en el dispositivo
  const db = await LocalDb.open(store);
  state = { db, ...buildLocalApp(db, appModules), volatile };
}

export const local = () => {
  if (!state) throw new Error('La base local todavía no se abrió.');
  return state;
};
