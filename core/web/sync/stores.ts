import type { LocalStore, Row } from './db.ts';

/** En memoria: para los tests y como respaldo si el navegador no deja usar IndexedDB (modo privado). */
export function memoryStore(): LocalStore & { rows: Map<string, Row>; meta: Record<string, string> } {
  const rows = new Map<string, Row>();
  const meta: Record<string, string> = {};
  return {
    rows, meta,
    async load() { return { rows: [...rows.values()].map((r) => ({ ...r })), meta: { ...meta } }; },
    async apply(put, del, m) {
      for (const r of put) rows.set(`${r.t}\0${r.id}`, { ...r });
      for (const [t, id] of del) rows.delete(`${t}\0${id}`);
      Object.assign(meta, m);
    },
  };
}

const done = (tx: IDBTransaction) => new Promise<void>((ok, fail) => { tx.oncomplete = () => ok(); tx.onerror = tx.onabort = () => fail(tx.error); });
const result = <T,>(req: IDBRequest<T>) => new Promise<T>((ok, fail) => { req.onsuccess = () => ok(req.result); req.onerror = () => fail(req.error); });

/** IndexedDB sin librería: stores `records` (clave [t, id]) y `meta`. */
export async function idbStore(name = 'study-workflow'): Promise<LocalStore> {
  const db = await new Promise<IDBDatabase>((ok, fail) => {
    const open = indexedDB.open(name, 1);
    open.onupgradeneeded = () => {
      open.result.createObjectStore('records', { keyPath: ['t', 'id'] });
      open.result.createObjectStore('meta');
    };
    open.onsuccess = () => ok(open.result);
    open.onerror = () => fail(open.error);
  });
  void navigator.storage?.persist?.(); // que el navegador no borre los datos si falta espacio
  return {
    async load() {
      const tx = db.transaction(['records', 'meta']);
      const [rows, keys, vals] = await Promise.all([
        result(tx.objectStore('records').getAll() as IDBRequest<Row[]>),
        result(tx.objectStore('meta').getAllKeys() as IDBRequest<string[]>),
        result(tx.objectStore('meta').getAll() as IDBRequest<string[]>),
      ]);
      return { rows, meta: Object.fromEntries(keys.map((k, i) => [k, vals[i]!])) };
    },
    async apply(put, del, meta) {
      const tx = db.transaction(['records', 'meta'], 'readwrite');
      for (const r of put) tx.objectStore('records').put(r);
      for (const k of del) tx.objectStore('records').delete(k);
      for (const [k, v] of Object.entries(meta ?? {})) tx.objectStore('meta').put(v, k);
      await done(tx);
    },
  };
}
