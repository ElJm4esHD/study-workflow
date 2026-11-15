import { isRec, type Rec } from '../shared/sync.ts';
import { httpError } from '../shared/errors.ts';
import type { LocalDb } from '../web/sync/db.ts';
import { makeMaterias } from './materias.ts';
import { orderModules, type AppContext, type AppModule, type Collection, type SearchHit } from './registry.ts';
import { created, LocalRouter } from './router.ts';
import { makeSettings } from './settings.ts';

const BACKUP_FORMAT = 'study-workflow-backup';

/** Arma el "server local": el núcleo (materias, ajustes, búsqueda, backup) más las rutas y servicios de cada módulo, todo sobre la base local. */
export function buildLocalApp(db: LocalDb, modules: AppModule[]): { router: LocalRouter; ctx: AppContext } {
  const mods = orderModules(modules);
  const services = new Map<string, object>();
  const col = <T extends { id: string }>(t: string): Collection<T> => ({
    all: () => db.all<T>(t),
    get: (id) => db.get<T>(t, id),
    put: (doc) => db.put(t, doc.id, doc),
    remove: (id) => db.remove(t, id),
  });
  const settings = makeSettings(col('settings'));
  const ctx: AppContext = {
    db, col, settings,
    transaction: (fn) => db.transaction(fn),
    materias: makeMaterias(col('materias')),
    modules: { isEnabled: (id) => settings.get<Record<string, boolean>>('modules.enabled', {})[id] ?? true },
    services: { get: <T,>(id: string) => services.get(id) as T | undefined },
  };
  for (const m of mods) if (m.service) services.set(m.id, m.service(ctx));

  const r = new LocalRouter();
  r.get('/api/materias', () => ctx.materias.list());
  r.post('/api/materias', { name: 'string!', color: 'string!', sigla: 'string?', id: 'string' }, (req) => created(ctx.materias.create(req.body)));
  r.patch('/api/materias/:id', { name: 'string', color: 'string', sigla: 'string', archived: 'boolean' }, (req) => ctx.materias.update(req.params.id!, req.body));
  r.get('/api/settings', () => ctx.settings.getAll());
  r.patch('/api/settings', {}, (req) => {
    ctx.transaction(() => { for (const [k, v] of Object.entries(req.body)) ctx.settings.set(k, v); });
    return ctx.settings.getAll();
  });
  r.get('/api/health', () => ({ ok: true }));
  r.get('/api/search', (req) => {
    const q = (req.query.q ?? '').trim();
    if (q.length < 2) return [];
    const hits: SearchHit[] = [];
    for (const m of mods) if (m.search && ctx.modules.isEnabled(m.id)) hits.push(...m.search(ctx, q));
    return hits.slice(0, 40);
  });

  // Backup v2: todos los registros vivos. Restaurar reemplaza todo lo que hay (los borrados viajan como marcas, así que se sincroniza igual).
  const known = new Set(['materias', 'settings', ...mods.flatMap((m) => m.collections)]);
  r.get('/api/backup', () => ({
    format: BACKUP_FORMAT, version: 2, exportedAt: new Date().toISOString(),
    records: [...known].flatMap((t) => db.all<{ id: string }>(t).map((data): Pick<Rec, 't' | 'id' | 'data'> => ({ t, id: data.id, data }))),
  }));
  r.post('/api/backup', {}, (req) => {
    const b = req.body as { format?: string; version?: number; records?: unknown };
    if (b.format !== BACKUP_FORMAT) throw httpError(400, 'backup_invalido', 'Ese archivo no es un backup de Study Workflow.');
    if (b.version !== 2 || !Array.isArray(b.records)) throw httpError(400, 'backup_invalido', 'Ese backup es de una versión vieja o está dañado.');
    const recs = b.records.map((x) => ({ ...(x as object), hlc: '0000000000000-0000-x' })) as unknown[];
    if (!recs.every((x) => isRec(x) && known.has((x as Rec).t) && (x as Rec).data !== null)) throw httpError(400, 'backup_invalido', 'El backup tiene datos que esta versión no conoce o está dañado.');
    const keep = new Set((recs as Rec[]).map((x) => `${x.t}\0${x.id}`));
    ctx.transaction(() => {
      for (const t of known) for (const d of db.all<{ id: string }>(t)) if (!keep.has(`${t}\0${d.id}`)) db.remove(t, d.id);
      for (const x of recs as Rec[]) db.put(x.t, x.id, x.data!);
    });
    return { registros: recs.length };
  });

  for (const m of mods) m.routes(r.prefixed(`/api/${m.id}`), ctx);
  return { router: r, ctx };
}
