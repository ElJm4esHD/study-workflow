// Entrada para la prueba de IndexedDB en el navegador real (e2e/idb.spec.ts): expone lo mínimo en window.sw.
import { LocalDb } from '../core/web/sync/db.ts';
import { idbStore } from '../core/web/sync/stores.ts';

(window as unknown as { sw: object }).sw = { open: async (name: string) => LocalDb.open(await idbStore(name)), LocalDb };
