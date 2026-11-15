import type { DatabaseSync } from 'node:sqlite';
import type { FastifyInstance } from 'fastify';
import { isRec, newer, tombstoneExpired, type Rec } from '../shared/sync.ts';
import { httpError } from './errors.ts';

/** Destino "Mi servidor": guarda el registro de HLC mayor por (t, id) y devuelve lo que cambió desde un cursor. */

const metaGet = (db: DatabaseSync, k: string): string | undefined => (db.prepare('SELECT value FROM sync_meta WHERE key = ?').get(k) as { value: string } | undefined)?.value;
const metaSet = (db: DatabaseSync, k: string, v: string | number) => void db.prepare('INSERT INTO sync_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(k, String(v));
const epoch = (db: DatabaseSync): string => {
  let e = metaGet(db, 'epoch');
  if (!e) metaSet(db, 'epoch', (e = crypto.randomUUID()));
  return e;
};
// El cursor es "epoch:seq:purgado-al-emitirlo": así se distingue un cliente que se quedó atrás de una limpieza de uno que arrancó de cero.
const cursorOf = (db: DatabaseSync, seq: number) => `${epoch(db)}:${seq}:${Number(metaGet(db, 'purged') ?? 0)}`;

export function push(db: DatabaseSync, recs: Rec[]): void {
  db.exec('BEGIN IMMEDIATE');
  try {
    const cur = db.prepare('SELECT hlc FROM sync_records WHERE t = ? AND id = ?');
    const up = db.prepare('INSERT INTO sync_records (t, id, data, hlc, seq) VALUES (?, ?, ?, ?, ?) ON CONFLICT(t, id) DO UPDATE SET data = excluded.data, hlc = excluded.hlc, seq = excluded.seq');
    let seq = Number(metaGet(db, 'seq') ?? 0);
    for (const r of recs) {
      const old = cur.get(r.t, r.id) as { hlc: string } | undefined;
      if (old && !newer(r.hlc, old.hlc)) continue;
      up.run(r.t, r.id, r.data === null ? null : JSON.stringify(r.data), r.hlc, ++seq);
    }
    metaSet(db, 'seq', seq);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

export type Page = { records: Rec[]; cursor: string; more: boolean; reset?: true };

export function pull(db: DatabaseSync, cursor: string | null, limit: number): Page {
  let since = 0;
  let reset = false;
  if (cursor) {
    const [e, s, p] = cursor.split(':');
    since = Number(s);
    const purged = Number(metaGet(db, 'purged') ?? 0);
    if (e !== epoch(db) || !Number.isInteger(since) || since < 0) { since = 0; reset = true; }
    else if (since < purged && Number(p) < purged) { since = 0; reset = true; }
  }
  const rows = db.prepare('SELECT t, id, data, hlc, seq FROM sync_records WHERE seq > ? ORDER BY seq LIMIT ?').all(since, limit + 1) as (Omit<Rec, 'data'> & { data: string | null; seq: number })[];
  const page = rows.slice(0, limit);
  const last = page.length ? page[page.length - 1]!.seq : since;
  return {
    records: page.map(({ t, id, data, hlc }) => ({ t, id, data: data === null ? null : JSON.parse(data), hlc })),
    cursor: cursorOf(db, last),
    more: rows.length > limit,
    ...(reset ? { reset: true as const } : {}),
  };
}

/** Borra marcas de borrado viejas y recuerda hasta qué seq limpió (los clientes más atrasados hacen reset). */
export function purgeTombstones(db: DatabaseSync, nowMs: number): number {
  const old = (db.prepare('SELECT t, id, hlc, seq FROM sync_records WHERE data IS NULL').all() as { t: string; id: string; hlc: string; seq: number }[])
    .filter((r) => tombstoneExpired(r.hlc, nowMs));
  if (!old.length) return 0;
  const del = db.prepare('DELETE FROM sync_records WHERE t = ? AND id = ?');
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const r of old) del.run(r.t, r.id);
    metaSet(db, 'purged', Math.max(Number(metaGet(db, 'purged') ?? 0), ...old.map((r) => r.seq)));
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return old.length;
}

export function registerSync(app: FastifyInstance, db: DatabaseSync): void {
  purgeTombstones(db, Date.now());
  const daily = setInterval(() => purgeTombstones(db, Date.now()), 86_400_000);
  daily.unref();
  app.addHook('onClose', async () => clearInterval(daily));

  app.post('/api/sync/push', { bodyLimit: 8 * 1024 * 1024, schema: { body: { type: 'object', required: ['records'], properties: { records: { type: 'array', maxItems: 1000 } } } } }, async (req) => {
    const { records } = req.body as { records: unknown[] };
    if (!records.every(isRec)) throw httpError(400, 'registro_invalido', 'Hay registros con formato inválido.');
    push(db, records);
    return { ok: true };
  });
  app.get('/api/sync/pull', async (req) => {
    const q = req.query as { since?: string; limit?: string };
    const limit = Math.min(Math.max(Number(q.limit) || 1000, 1), 1000);
    return pull(db, q.since || null, limit);
  });
}
