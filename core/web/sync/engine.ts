import type { Rec } from '../../shared/sync.ts';
import type { LocalDb } from './db.ts';

/** Un destino de sincronización: dos operaciones. "Mi servidor" y (después) Drive implementan esto. */
export interface SyncTarget {
  push(records: Rec[]): Promise<void>;
  pull(cursor: string | null): Promise<{ records: Rec[]; cursor: string; more: boolean; reset?: boolean }>;
}

const BATCH = 500;

/** Un ciclo: sube los cambios locales y baja los remotos. Si algo falla, lo no subido sigue marcado para el próximo intento. */
export async function sync(db: LocalDb, target: SyncTarget): Promise<{ pushed: number; pulled: number }> {
  const dirty = db.dirtyRows().map(({ t, id, data, hlc }): Rec => ({ t, id, data, hlc }));
  for (let i = 0; i < dirty.length; i += BATCH) {
    const batch = dirty.slice(i, i + BATCH);
    await target.push(batch);
    db.markPushed(batch);
  }

  let cursor = db.getMeta('cursor') ?? null;
  let pulled = 0;
  let full: Set<string> | null = null; // reset: se baja todo y al final se saca lo que el destino ya no tiene
  for (;;) {
    const page = await target.pull(cursor);
    if (page.reset && !full) full = new Set();
    pulled += db.merge(page.records);
    if (full) for (const r of page.records) full.add(`${r.t}\0${r.id}`);
    cursor = page.cursor;
    if (!full) db.setMeta('cursor', cursor); // en un reset el cursor se guarda recién al terminar
    if (!page.more) break;
  }
  if (full) { db.dropUnseen(full); db.setMeta('cursor', cursor!); }
  db.purgeTombstones();
  db.setMeta('lastSync', new Date().toISOString());
  return { pushed: dirty.length, pulled };
}

/** Evita ciclos superpuestos: si ya hay uno corriendo, devuelve ese mismo. */
export function makeSyncer(db: LocalDb, target: SyncTarget): () => ReturnType<typeof sync> {
  let running: ReturnType<typeof sync> | null = null;
  return () => (running ??= sync(db, target).finally(() => { running = null; }));
}
